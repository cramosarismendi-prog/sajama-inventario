import { useState, useEffect, useRef } from 'react'
import { getItems } from '../services/inventario'
import { useAuth } from '../context/AuthContext'
import { PageLoader } from '../components/ui/Spinner'
import { Printer, FilePlus, Save, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { collection, addDoc, updateDoc, serverTimestamp, doc, runTransaction, writeBatch, increment } from 'firebase/firestore'
import { db } from '../services/firebase'
import { registrarAccion } from '../services/auditoria'
import toast from 'react-hot-toast'

const FILAS_INICIALES = 5
const FUENTES_ES = { importacion:'Importación', compra:'Compra local', devolucion:'Devolución' }
const FUENTES_ZH = { importacion:'进口', compra:'本地采购', devolucion:'退货' }

async function obtenerSiguienteNumeroEntrada() {
  const refContador = doc(db, 'contadores', 'ordenEntrada')
  const nuevoNumero = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(refContador)
    const actual = snap.exists() ? (snap.data().ultimo || 0) : 0
    const siguiente = actual + 1
    transaction.set(refContador, { ultimo: siguiente }, { merge: true })
    return siguiente
  })
  return 'OE-' + String(nuevoNumero).padStart(6, '0')
}

const firmasVacias = () => ({
  firmaSolicitante: '',
  aprobadoGerencia: '',
  entregadoPor: '',
  recibidoPor: '',
  observaciones: '',
})

const filaVacia = () => ({ itemId:'', descZh:'', descEs:'', modelo:'', serie:'', unidad:'', cantidad:'', precioUnitario:'', nota:'' })

export default function OrdenEntrada() {
  const { perfil } = useAuth()
  const [items,       setItems]   = useState([])
  const [loading,     setLoading] = useState(true)
  const [numSolicitud,setNum]     = useState('')
  const numRef = useRef('')
  const docIdRef = useRef(null)               // ID del documento ya guardado en Firestore (null = aún no existe)
  const filasPersistidasRef = useRef({})       // { itemId: cantidad } — lo último que quedó sumado en inventario
  const [fecha,       setFecha]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [fuente,      setFuente]  = useState('importacion')
  const [proveedor,   setProv]    = useState('')
  const [recibidoPor, setRecibe]  = useState('')
  const [firmas,      setFirmas]  = useState(firmasVacias())
  const [guardando,   setGuardando] = useState(false)
  const [guardadoUnaVez, setGuardadoUnaVez] = useState(false)
  const [filas, setFilas] = useState(Array.from({length: FILAS_INICIALES}, filaVacia))

  const asegurarNumero = async () => {
    if (numRef.current) return numRef.current
    const nuevo = await obtenerSiguienteNumeroEntrada().catch(() => 'OE-ERROR')
    numRef.current = nuevo
    setNum(nuevo)
    return nuevo
  }

  const actualizarFirma = (campo, valor) => {
    setFirmas(prev => ({ ...prev, [campo]: valor }))
  }

  const agregarFila = () => setFilas(prev => [...prev, filaVacia()])

  const eliminarFila = (idx) => {
    setFilas(prev => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== idx)
    })
  }

  useEffect(() => {
    getItems().then(i => { setItems(i); setLoading(false) })
    if (perfil?.nombre) setRecibe(perfil.nombre)
  }, [perfil])

  const totalCantidad = filas.reduce((a, f) => a + (Number(f.cantidad) || 0), 0)
  const montoTotal = filas.reduce((a, f) => a + ((Number(f.cantidad) || 0) * (Number(f.precioUnitario) || 0)), 0)

  const actualizarFila = (idx, campo, valor) => {
    setFilas(prev => {
      const n = [...prev]
      n[idx] = { ...n[idx], [campo]: valor }
      if (campo === 'itemId' && valor) {
        const it = items.find(i => i.id === valor)
        if (it) { n[idx].descEs = it.descripcion||''; n[idx].descZh = it.descripcionZh||''; n[idx].modelo = it.modelo||''; n[idx].serie = it.serie||''; n[idx].unidad = it.unidad||''; n[idx].precioUnitario = it.precio || n[idx].precioUnitario || '' }
      }
      return n
    })
  }

  // ── Lógica de guardado real, compartida entre "Guardar" e "Imprimir" ──
  // Crea el documento la primera vez; en llamadas posteriores lo ACTUALIZA
  // (no crea uno nuevo), y solo aplica al inventario la DIFERENCIA de stock
  // respecto a lo que ya se había sumado antes.
  const guardarOrden = async (numero) => {
    const filasValidas = filas.filter(f => f.descEs||f.descZh||f.cantidad)
    if (filasValidas.length === 0) {
      toast.error('Agrega al menos un ítem antes de guardar')
      return false
    }
    const filasConTotal = filasValidas.map(f => ({
      ...f,
      precioTotal: (Number(f.cantidad) || 0) * (Number(f.precioUnitario) || 0),
    }))

    try {
      const batch = writeBatch(db)
      const esNueva = !docIdRef.current
      const ordenRef = esNueva ? doc(collection(db, 'ordenes_entrada')) : doc(db, 'ordenes_entrada', docIdRef.current)

      const datosOrden = {
        tipo:'entrada', numSolicitud: numero, fecha, fuente, proveedor,
        recibidoPor: recibidoPor||perfil?.nombre,
        filas: filasConTotal,
        totalCantidad, montoTotal, estado:'emitida',
        firmas,
        actualizadoEn: serverTimestamp(),
        actualizadoPor: perfil?.nombre,
      }

      if (esNueva) {
        batch.set(ordenRef, {
          ...datosOrden,
          creadoPor: perfil?.nombre, creadoEn: serverTimestamp(),
        })
      } else {
        batch.update(ordenRef, datosOrden)
      }

      // Aplica solo la DIFERENCIA de stock respecto a lo persistido anteriormente.
      // Ítems que ya no están en la orden (se borraron) también revierten su suma.
      const itemsTocados = new Set([
        ...filasConTotal.filter(f => f.itemId).map(f => f.itemId),
        ...Object.keys(filasPersistidasRef.current),
      ])
      itemsTocados.forEach(itemId => {
        const filaActual = filasConTotal.find(f => f.itemId === itemId)
        const cantNueva = filaActual ? (Number(filaActual.cantidad) || 0) : 0
        const cantAnterior = filasPersistidasRef.current[itemId] || 0
        const delta = cantNueva - cantAnterior
        if (delta !== 0) {
          batch.update(doc(db, 'inventario', itemId), {
            stock: increment(delta),
            actualizadoEn: serverTimestamp(),
          })
        }
      })

      await batch.commit()

      await registrarAccion({
        usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Orden de Entrada',
        accion: esNueva ? 'CREAR' : 'EDITAR',
        detalle: `Entrada ${numero}: ${filasValidas.length} ítem(s), total ${totalCantidad} unidades, ${montoTotal.toLocaleString()} Bs`,
      })

      // Actualiza las referencias de control para la próxima edición
      docIdRef.current = ordenRef.id
      const nuevoMapa = {}
      filasConTotal.forEach(f => { if (f.itemId) nuevoMapa[f.itemId] = Number(f.cantidad) || 0 })
      filasPersistidasRef.current = nuevoMapa

      getItems().then(setItems)
      setGuardadoUnaVez(true)
      return true
    } catch(e) {
      toast.error('Error al guardar: ' + e.message)
      return false
    }
  }

  const guardar = async () => {
    setGuardando(true)
    const numero = await asegurarNumero()
    const ok = await guardarOrden(numero)
    if (ok) toast.success(docIdRef.current ? 'Orden de entrada actualizada correctamente' : 'Orden de entrada guardada correctamente')
    setGuardando(false)
  }

  const imprimir = async () => {
    const numero = await asegurarNumero()

    setGuardando(true)
    const ok = await guardarOrden(numero)
    setGuardando(false)
    if (!ok) return

    const fechaFmt   = fecha ? format(new Date(fecha + 'T00:00:00'), 'dd/MM/yyyy') : ''
    const fuenteLabel = `${FUENTES_ES[fuente]} / ${FUENTES_ZH[fuente]}`
    const filasHTML  = filas.map((f, i) => {
      const precioTotal = (Number(f.cantidad) || 0) * (Number(f.precioUnitario) || 0)
      return `
      <tr>
        <td style="text-align:center;border:1px solid #aaa;padding:2px 4px">${i+1}</td>
        <td style="border:1px solid #aaa;padding:2px 4px">${f.descZh||''}</td>
        <td style="border:1px solid #aaa;padding:2px 4px">${f.descEs||''}</td>
        <td style="border:1px solid #aaa;padding:2px 4px">${f.modelo||''}</td>
        <td style="border:1px solid #aaa;padding:2px 4px">${f.serie||''}</td>
        <td style="border:1px solid #aaa;padding:2px 4px">${f.unidad||''}</td>
        <td style="text-align:center;border:1px solid #aaa;padding:2px 4px">${f.cantidad||''}</td>
        <td style="text-align:center;border:1px solid #aaa;padding:2px 4px">${f.precioUnitario||''}</td>
        <td style="text-align:center;border:1px solid #aaa;padding:2px 4px">${precioTotal||''}</td>
        <td style="border:1px solid #aaa;padding:2px 4px">${f.nota||''}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Orden Entrada ${numero}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans SC','Microsoft YaHei','SimSun',Arial,sans-serif; font-size:9.5pt; color:#111; padding:10mm; }
.header { display:flex; align-items:center; gap:10px; margin-bottom:6px; border-bottom:2px solid #1d7044; padding-bottom:6px; }
.logo { width:55px; height:50px; border:1px solid #ccc; display:flex; align-items:center; justify-content:center; font-size:7pt; text-align:center; background:#d6efe0; flex-shrink:0; }
.htxt { flex:1; text-align:center; }
.empresa { font-size:16pt; font-weight:700; }
.dir { font-size:7.5pt; color:#555; margin:2px 0; }
.titzh { font-size:12pt; font-weight:700; margin-top:3px; color:#1d7044; }
.tites { font-size:8.5pt; }
.campos { margin:6px 0; }
.row-campo { display:flex; gap:20px; margin-bottom:4px; font-size:8.5pt; }
.campo { display:flex; align-items:center; gap:4px; flex:1; }
.campo b { white-space:nowrap; font-size:8pt; }
.val { border-bottom:1px solid #777; flex:1; padding:1px 3px; min-height:13px; font-size:8.5pt; }
table { width:100%; border-collapse:collapse; margin:6px 0; font-size:8.5pt; }
th { background:#d3eed9; border:1px solid #888; padding:3px 4px; text-align:center; font-weight:700; white-space:pre-line; line-height:1.4; }
td { border:1px solid #aaa; padding:2px 4px; height:15px; }
.total-row td { font-weight:700; background:#f2f2f2; }
.firmas { display:flex; border:1px solid #999; margin-top:8px; }
.fc { border-right:1px solid #999; padding:5px 6px; font-size:8pt; }
.fc:last-child { border-right:none; }
.fc1 { flex:0 0 38%; }
.fc2 { flex:0 0 17%; display:flex; align-items:center; justify-content:center; }
.fc3 { flex:1; }
.sello { width:54px; height:54px; border-radius:50%; border:2px solid #1d7044; display:flex; align-items:center; justify-content:center; text-align:center; font-size:7.5pt; font-weight:700; color:#1d7044; line-height:1.3; }
.lf { border-bottom:1px solid #aaa; margin:6px 0 2px 0; min-height:14px; padding:1px 2px; font-weight:400; }
.lbl { font-weight:700; margin-top:8px; }
.nota { color:#1d7044; font-size:7.5pt; margin-top:5px; }
@page { size:A4 landscape; margin:10mm; }
@media print { body{padding:0} }
</style></head><body>
<div class="header">
  <div class="logo">Sajama.SRL<br/>LOGO</div>
  <div class="htxt">
    <div class="empresa">SAJAMA &nbsp; 萨哈马</div>
    <div class="dir">El Alto, avenida 6 de marzo (carretera a Oruro) cerca cruce Achocalla</div>
    <div class="titzh">入库收料单表</div>
    <div class="tites">Formulario de registro de entrada de materiales / Orden de Entrada</div>
  </div>
</div>
<div class="campos">
  <div class="row-campo">
    <div class="campo"><b>单据号码 Número de entrada:</b><span class="val">${numero}</span></div>
    <div class="campo"><b>日期 Fecha:</b><span class="val">${fechaFmt}</span></div>
  </div>
  <div class="row-campo">
    <div class="campo"><b>来源 Fuente:</b><span class="val">${fuenteLabel}</span></div>
    <div class="campo"><b>供应商 Proveedor:</b><span class="val">${proveedor}</span></div>
  </div>
  <div class="row-campo">
    <div class="campo"><b>接收人 Recibido por:</b><span class="val">${recibidoPor}</span></div>
  </div>
</div>
<table>
  <thead><tr>
    <th style="width:6%">序号\nNo.</th>
    <th style="width:16%">中文名称\nDescripción En Chino</th>
    <th style="width:16%">西语名称\nDescripción En Español</th>
    <th style="width:10%">规格型号\nModelo, Tipo</th>
    <th style="width:8%">系列\nSerie</th>
    <th style="width:7%">单位\nUnidad</th>
    <th style="width:6%">数量\nCantidad</th>
    <th style="width:8%">单价(Bs)\nP. Unitario</th>
    <th style="width:8%">总价(Bs)\nP. Total</th>
    <th style="width:15%">备注\nNota</th>
  </tr></thead>
  <tbody>
    ${filasHTML}
    <tr class="total-row">
      <td colspan="8" style="text-align:right;padding-right:8px;border:1px solid #aaa">金额合计 Monto Total (Bs):</td>
      <td style="text-align:center;border:1px solid #aaa">${montoTotal.toLocaleString()}</td>
      <td style="border:1px solid #aaa"></td>
    </tr>
  </tbody>
</table>
<div class="firmas">
  <div class="fc fc1">
    <div class="lbl">申请人签名:</div><div>Firma del solicitante:</div>
    <div class="lf">${firmas.firmaSolicitante||''}</div>
    <div class="lbl" style="margin-top:12px">仓库管理层批准:</div><div>Aprobado Por (GERENCIA):</div>
    <div class="lf">${firmas.aprobadoGerencia||''}</div>
  </div>
  <div class="fc fc2"><div class="sello">SELLO DE<br/>ALMACEN</div></div>
  <div class="fc fc3">
    <div class="lbl">交付者:</div><div>Entregado por:</div><div class="lf">${firmas.entregadoPor||''}</div>
    <div class="lbl" style="margin-top:10px">接收人:</div><div>Recibido Por:</div><div class="lf">${firmas.recibidoPor||''}</div>
    <div class="lbl" style="margin-top:10px">备注:</div><div>Observaciones:</div><div class="lf">${firmas.observaciones||''}</div>
  </div>
</div>
<div class="nota">Nota: Este documento confirma el ingreso oficial de materiales al almacén SAJAMA 4x4.</div>
<script>
window.onload = () => {
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => setTimeout(() => window.print(), 150));
  } else {
    setTimeout(() => window.print(), 600);
  }
};
<\/script>
</body></html>`

    const w = window.open('','_blank','width=900,height=700')
    w.document.write(html)
    w.document.close()
  }

  const nuevaOrden = () => {
    numRef.current = ''
    docIdRef.current = null
    filasPersistidasRef.current = {}
    setNum('')
    setGuardadoUnaVez(false)
    setFecha(format(new Date(), 'yyyy-MM-dd'))
    setFuente('importacion')
    setProv('')
    setRecibe(perfil?.nombre || '')
    setFilas(Array.from({length: FILAS_INICIALES}, filaVacia))
    setFirmas(firmasVacias())
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1>Orden de Entrada / 入库单</h1>
          <p className="text-sm text-gray-500">入库收料单表</p>
        </div>
        <div className="flex gap-2">
          <button onClick={nuevaOrden} className="btn-secondary btn-sm"><FilePlus size={14}/> Nueva</button>
          <button onClick={guardar} disabled={guardando} className="btn-secondary btn-sm">
            <Save size={14}/> {guardando ? 'Guardando...' : (docIdRef.current ? 'Actualizar' : 'Guardar')}
          </button>
          <button onClick={imprimir} disabled={guardando} className="btn-success btn-sm">
            <Printer size={14}/> {guardando ? 'Guardando...' : 'Imprimir / PDF'}
          </button>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">单据号码 Número de entrada</label>
            <input className="input font-mono" value={numSolicitud}
              placeholder="Se asignará al guardar"
              onChange={e=>{ numRef.current = e.target.value; setNum(e.target.value) }}/></div>
          <div><label className="label">日期 Fecha</label>
            <input className="input" type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></div>
          <div><label className="label">来源 Fuente de ingreso</label>
            <select className="input" value={fuente} onChange={e=>setFuente(e.target.value)}>
              {Object.entries(FUENTES_ES).map(([k,v])=>(
                <option key={k} value={k}>{v} / {FUENTES_ZH[k]}</option>
              ))}
            </select></div>
          <div><label className="label">供应商 Proveedor</label>
            <input className="input" placeholder="Nombre / 供应商名称" value={proveedor} onChange={e=>setProv(e.target.value)}/></div>
          <div><label className="label">接收人 Recibido por</label>
            <input className="input" value={recibidoPor} onChange={e=>setRecibe(e.target.value)}/></div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-green-50">
                <th className="th w-8">序号<br/>No.</th>
                <th className="th">中文名称<br/>Desc. Chino</th>
                <th className="th">西语名称<br/>Desc. Español</th>
                <th className="th">规格型号<br/>Modelo</th>
                <th className="th">系列<br/>Serie</th>
                <th className="th">单位<br/>Unidad</th>
                <th className="th w-16">数量<br/>Cant.</th>
                <th className="th w-20">单价<br/>P. Unit. (Bs)</th>
                <th className="th w-20">总价<br/>P. Total (Bs)</th>
                <th className="th">备注<br/>Nota</th>
                <th className="th w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, idx) => {
                const precioTotal = (Number(f.cantidad) || 0) * (Number(f.precioUnitario) || 0)
                return (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="td text-center text-gray-400 font-bold">{idx+1}</td>
                  <td className="td p-1">
                    <input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.descZh} onChange={e=>actualizarFila(idx,'descZh',e.target.value)}/>
                  </td>
                  <td className="td p-1">
                    <select className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-green-400"
                      value={f.itemId} onChange={e=>actualizarFila(idx,'itemId',e.target.value)}>
                      <option value="">—</option>
                      {items.map(i=><option key={i.id} value={i.id}>{i.descripcion||i.descripcionZh}</option>)}
                    </select>
                    {f.descEs && <div className="text-xs text-green-700 mt-0.5 px-1">{f.descEs}</div>}
                  </td>
                  <td className="td p-1"><input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.modelo} onChange={e=>actualizarFila(idx,'modelo',e.target.value)}/></td>
                  <td className="td p-1"><input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.serie} onChange={e=>actualizarFila(idx,'serie',e.target.value)}/></td>
                  <td className="td p-1"><input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.unidad} onChange={e=>actualizarFila(idx,'unidad',e.target.value)}/></td>
                  <td className="td p-1"><input type="number" min="0" className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 text-center focus:outline-none" value={f.cantidad} onChange={e=>actualizarFila(idx,'cantidad',e.target.value)}/></td>
                  <td className="td p-1"><input type="number" min="0" step="0.01" className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 text-center focus:outline-none" value={f.precioUnitario} onChange={e=>actualizarFila(idx,'precioUnitario',e.target.value)}/></td>
                  <td className="td p-1 text-center font-semibold text-success">{precioTotal || '—'}</td>
                  <td className="td p-1"><input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.nota} onChange={e=>actualizarFila(idx,'nota',e.target.value)}/></td>
                  <td className="td p-1 text-center">
                    {filas.length > 1 && (
                      <button type="button" onClick={() => eliminarFila(idx)}
                        className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors" title="Eliminar fila">
                        <Trash2 size={13}/>
                      </button>
                    )}
                  </td>
                </tr>
              )})}
              <tr className="bg-gray-50">
                <td colSpan={8} className="td text-right font-bold text-xs pr-3">金额合计 Monto Total (Bs):</td>
                <td className="td text-center font-bold text-success">{montoTotal.toLocaleString()}</td>
                <td className="td" colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-gray-100">
          <button type="button" onClick={agregarFila} className="btn-secondary btn-sm">
            <Plus size={14}/> Agregar fila
          </button>
        </div>
      </div>

      {guardadoUnaVez && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-sm text-green-700">
          💾 Orden N° {numSolicitud} guardada. Si seguís editando y volvés a tocar Guardar o Imprimir, se actualizará el mismo registro (no se duplica).
        </div>
      )}

      <div className="card">
        <h3 className="mb-3 text-sm text-gray-500">签名区域 / Sección de firmas</h3>
        <div className="grid grid-cols-3 gap-0 border border-gray-300 rounded-lg overflow-hidden text-xs">
          <div className="p-3 border-r border-gray-300 space-y-3">
            <div>
              <p className="font-bold">申请人签名 / Firma del solicitante:</p>
              <input className="w-full border-b border-gray-400 mt-2 text-sm py-1 focus:outline-none focus:border-primary"
                placeholder="Nombre" value={firmas.firmaSolicitante} onChange={e=>actualizarFirma('firmaSolicitante', e.target.value)}/>
            </div>
            <div>
              <p className="font-bold">仓库管理层批准 / Aprobado Por (GERENCIA):</p>
              <input className="w-full border-b border-gray-400 mt-2 text-sm py-1 focus:outline-none focus:border-primary"
                placeholder="Nombre" value={firmas.aprobadoGerencia} onChange={e=>actualizarFirma('aprobadoGerencia', e.target.value)}/>
            </div>
          </div>
          <div className="flex items-center justify-center border-r border-gray-300 p-4">
            <div className="w-20 h-20 rounded-full border-2 border-green-500 flex items-center justify-center text-center text-green-700 font-bold text-xs leading-tight">SELLO DE<br/>ALMACÉN</div>
          </div>
          <div className="p-3 space-y-3">
            <div>
              <p className="font-bold">交付者 / Entregado por:</p>
              <input className="w-full border-b border-gray-400 mt-2 text-sm py-1 focus:outline-none focus:border-primary"
                placeholder="Nombre" value={firmas.entregadoPor} onChange={e=>actualizarFirma('entregadoPor', e.target.value)}/>
            </div>
            <div>
              <p className="font-bold">接收人 / Recibido Por:</p>
              <input className="w-full border-b border-gray-400 mt-2 text-sm py-1 focus:outline-none focus:border-primary"
                placeholder="Nombre" value={firmas.recibidoPor} onChange={e=>actualizarFirma('recibidoPor', e.target.value)}/>
            </div>
            <div>
              <p className="font-bold">备注 / Observaciones:</p>
              <input className="w-full border-b border-gray-400 mt-2 text-sm py-1 focus:outline-none focus:border-primary"
                placeholder="Observaciones" value={firmas.observaciones} onChange={e=>actualizarFirma('observaciones', e.target.value)}/>
            </div>
          </div>
        </div>
        <p className="text-green-600 text-xs mt-2">Nota: Este documento confirma el ingreso oficial de materiales al almacén SAJAMA 4x4.</p>
      </div>
    </div>
  )
}