import { useState, useEffect, useRef } from 'react'
import { getItems } from '../services/inventario'
import { useAuth } from '../context/AuthContext'
import { PageLoader } from '../components/ui/Spinner'
import { Printer, FilePlus, Save, Plus, Trash2, Scan } from 'lucide-react'
import { format } from 'date-fns'
import { collection, addDoc, updateDoc, serverTimestamp, doc, runTransaction, writeBatch, increment } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useScannerQR, parsearQR } from '../hooks/useScannerQR'
import { traducirAlChino } from '../services/traduccion'
import { registrarAccion } from '../services/auditoria'
import toast from 'react-hot-toast'

const FILAS_INICIALES = 5

const UNIDADES = [
  'UNIDAD', 'PIEZA', 'PAR', 'JUEGO',
  'TORNILLO', 'CENTENA', 'MILLAR', 'CAJA', 'PAQUETE', 'BOLSA',
  'LITRO', 'GALÓN', 'BALDE', 'TAMBOR', 'BARRIL', 'CILINDRO',
  'KILOGRAMO', 'GRAMO', 'TONELADA', 'QUINTAL', 'LIBRA',
  'METRO', 'METRO²', 'ROLLO', 'BARRA', 'PLANCHA', 'BOBINA',
  'FRASCO', 'LATA', 'SACO', 'CARTÓN', 'PALLET',
  'OTRO',
]

async function obtenerSiguienteNumero() {
  const refContador = doc(db, 'contadores', 'ordenSalida')
  const nuevoNumero = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(refContador)
    const actual = snap.exists() ? (snap.data().ultimo || 0) : 0
    const siguiente = actual + 1
    transaction.set(refContador, { ultimo: siguiente }, { merge: true })
    return siguiente
  })
  return 'OS-' + String(nuevoNumero).padStart(6, '0')
}

const firmasVacias = () => ({
  firmaSolicitante: '',
  aprobadoJefeArea: '',
  fechaJefeArea: '',
  aprobadoGerencia: '',
  fechaGerencia: '',
  entregadoPor: '',
  recibidoPor: '',
  observaciones: '',
})

const filaVacia = () => ({ itemId:'', descZh:'', descEs:'', modelo:'', serie:'', unidad:'', cantidad:'', precioUnitario:'', nota:'' })

export default function OrdenSalida() {
  const { perfil } = useAuth()
  const [items,        setItems]       = useState([])
  const [loading,      setLoading]     = useState(true)
  const [numSolicitud, setNum]         = useState('')
  const numRef = useRef('')
  const docIdRef = useRef(null)               // ID del documento ya guardado en Firestore (null = aún no existe)
  const filasPersistidasRef = useRef({})       // { itemId: cantidad } — lo último que quedó descontado en inventario
  const [fecha,        setFecha]       = useState(format(new Date(), 'yyyy-MM-dd'))
  const [unidadSolic,  setUnidad]      = useState('')
  const [solicitante,  setSolic]       = useState('')
  const [filaActiva,   setFilaActiva]  = useState(0)
  const [firmas,       setFirmas]      = useState(firmasVacias())
  const [guardando,    setGuardando]   = useState(false)
  const [guardadoUnaVez, setGuardadoUnaVez] = useState(false)
  const [filas, setFilas] = useState(Array.from({length: FILAS_INICIALES}, filaVacia))

  const asegurarNumero = async () => {
    if (numRef.current) return numRef.current
    const nuevo = await obtenerSiguienteNumero().catch(() => 'OS-ERROR')
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

  const { escuchando: scannerActivo, activar: activarScanner, desactivar: desactivarScanner } = useScannerQR(async (textoQR) => {
    const parsed = parsearQR(textoQR)
    if (!parsed) { toast.error('QR no reconocido'); return }

    const item = items.find(i => String(i.codigo) === String(parsed.codigo))

    let descZh = item?.descripcionZh || ''
    if (!descZh && parsed.descripcion && parsed.descripcion.length > 2) {
      try { descZh = await traducirAlChino(parsed.descripcion) } catch(e) { descZh = '' }
    }

    setFilas(prev => {
      const n = [...prev]
      n[filaActiva] = {
        ...n[filaActiva],
        itemId: item?.id || '',
        descZh: descZh || item?.descripcionZh || '',
        descEs: item?.descripcion || parsed.descripcion,
        modelo: item?.modelo || '',
        serie:  item?.serie  || parsed.serie || '',
        unidad: item?.unidad || '',
        precioUnitario: item?.precio || n[filaActiva]?.precioUnitario || '',
      }
      return n
    })
    toast.success('QR leído fila ' + (filaActiva+1) + ': ' + (item?.descripcion || parsed.descripcion))

    setFilaActiva(prev => {
      const siguiente = prev + 1
      setFilas(f => (siguiente >= f.length ? [...f, filaVacia()] : f))
      return siguiente
    })
  })

  useEffect(() => {
    getItems().then(i => { setItems(i); setLoading(false) })
    if (perfil?.nombre) setSolic(perfil.nombre)
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
  // respecto a lo que ya se había descontado antes.
  const guardarOrden = async (numero) => {
    const filasValidas = filas.filter(f => f.descEs || f.descZh || f.cantidad)
    if (filasValidas.length === 0) {
      toast.error('Agrega al menos un ítem antes de guardar')
      return false
    }
    const filasConTotal = filasValidas.map(f => ({
      ...f,
      precioTotal: (Number(f.cantidad) || 0) * (Number(f.precioUnitario) || 0),
    }))

    // Validar stock suficiente considerando solo la DIFERENCIA respecto a lo ya descontado
    for (const f of filasConTotal) {
      if (f.itemId) {
        const it = items.find(i => i.id === f.itemId)
        const cantNueva = Number(f.cantidad) || 0
        const cantAnterior = filasPersistidasRef.current[f.itemId] || 0
        const delta = cantNueva - cantAnterior
        if (it && delta > (it.stock || 0)) {
          toast.error(`Stock insuficiente para "${it.descripcion}": disponible ${it.stock || 0}, necesitas ${delta} más`)
          return false
        }
      }
    }

    try {
      const batch = writeBatch(db)
      const esNueva = !docIdRef.current
      const ordenRef = esNueva ? doc(collection(db, 'ordenes_salida')) : doc(db, 'ordenes_salida', docIdRef.current)

      const datosOrden = {
        tipo:'salida', numSolicitud: numero, fecha,
        unidadSolicitante: unidadSolic,
        solicitante: solicitante || perfil?.nombre,
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
      // Ítems que ya no están en la orden (se borraron) también devuelven su stock.
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
            stock: increment(-delta),
            totalSalidas: increment(delta),
            actualizadoEn: serverTimestamp(),
          })
        }
      })

      await batch.commit()

      await registrarAccion({
        usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Orden de Salida',
        accion: esNueva ? 'CREAR' : 'EDITAR',
        detalle: `Orden ${numero}: ${filasValidas.length} ítem(s), total ${totalCantidad} unidades, ${montoTotal.toLocaleString()} Bs`,
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
    if (ok) toast.success(docIdRef.current ? 'Orden actualizada correctamente' : 'Orden guardada correctamente')
    setGuardando(false)
  }

  const imprimir = async () => {
    const numero = await asegurarNumero()

    setGuardando(true)
    const ok = await guardarOrden(numero)
    setGuardando(false)
    if (!ok) return

    const fechaFmt = fecha ? format(new Date(fecha + 'T00:00:00'), 'dd/MM/yyyy') : ''
    const filasHTML = filas.map((f, i) => {
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
<title>Orden Salida ${numero}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans SC','Microsoft YaHei',Arial,sans-serif; font-size:9.5pt; color:#111; padding:10mm; }
.header { display:flex; align-items:center; gap:10px; margin-bottom:6px; border-bottom:2px solid #1a3c6e; padding-bottom:6px; }
.logo { width:55px; height:50px; border:1px solid #ccc; display:flex; align-items:center; justify-content:center; font-size:7pt; text-align:center; background:#e8eef7; flex-shrink:0; }
.htxt { flex:1; text-align:center; }
.empresa { font-size:16pt; font-weight:700; }
.dir { font-size:7.5pt; color:#555; margin:2px 0; }
.titzh { font-size:12pt; font-weight:700; margin-top:3px; }
.tites { font-size:8.5pt; }
.campos { margin:6px 0; }
.row-campo { display:flex; gap:20px; margin-bottom:4px; font-size:8.5pt; }
.campo { display:flex; align-items:center; gap:4px; flex:1; }
.campo b { white-space:nowrap; font-size:8pt; }
.val { border-bottom:1px solid #777; flex:1; padding:1px 3px; min-height:13px; }
table { width:100%; border-collapse:collapse; margin:6px 0; font-size:8.5pt; }
th { background:#d3ddf0; border:1px solid #888; padding:3px 4px; text-align:center; font-weight:700; white-space:pre-line; line-height:1.4; }
td { border:1px solid #aaa; padding:2px 4px; height:15px; }
.total-row td { font-weight:700; background:#f2f2f2; }
.firmas { display:flex; border:1px solid #999; margin-top:8px; }
.fc { border-right:1px solid #999; padding:5px 6px; font-size:8pt; }
.fc:last-child { border-right:none; }
.fc1 { flex:0 0 38%; }
.fc2 { flex:0 0 17%; }
.fc3 { flex:1; }
.sello { width:54px; height:54px; border-radius:50%; border:2px solid #3355aa; display:flex; align-items:center; justify-content:center; text-align:center; font-size:7.5pt; font-weight:700; color:#3355aa; line-height:1.3; }
.lf { border-bottom:1px solid #aaa; margin:6px 0 2px 0; min-height:14px; padding:1px 2px; font-weight:400; }
.lbl { font-weight:700; margin-top:8px; }
.nota { color:red; font-size:7.5pt; margin-top:5px; }
@page { size:A4 landscape; margin:10mm; }
@media print { body{padding:0} }
</style></head><body>
<div class="header">
  <div class="logo">Sajama.SRL</div>
  <div class="htxt">
    <div class="empresa">Sajama.SRL &nbsp; 萨哈马</div>
    <div class="dir">El Alto, avenida 6 de marzo (carretera a Oruro) cerca cruce Achocalla</div>
    <div class="titzh">材料/服务发布申请批准表</div>
    <div class="tites">Formulario de aprobacion de solicitud de salida de materiales / servicio</div>
  </div>
</div>
<div class="campos">
  <div class="row-campo">
    <div class="campo"><b>单据号码 Numero de solicitud:</b><span class="val">${numero}</span></div>
    <div class="campo"><b>单据日期 Fecha:</b><span class="val">${fechaFmt}</span></div>
  </div>
  <div class="row-campo">
    <div class="campo"><b>申请单位 Unidad Solicitante:</b><span class="val">${unidadSolic}</span></div>
    <div class="campo"><b>申请人 Solicitante:</b><span class="val">${solicitante}</span></div>
  </div>
</div>
<table>
  <thead><tr>
    <th style="width:6%">序号\nNo.</th>
    <th style="width:16%">中文名称\nDescripcion En Chino</th>
    <th style="width:16%">西语名称\nDescripcion En Espanol</th>
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
    <div class="lbl" style="margin-top:10px">区域负责人批准:</div><div>Aprobado Por (JEFE DE AREA):</div>
    <div class="lf">${firmas.aprobadoJefeArea||''}</div><div style="font-size:7.5pt;color:#555">日 Fecha: ${firmas.fechaJefeArea||'年___  月___'}</div>
    <div class="lbl" style="margin-top:8px">仓库管理层批准:</div><div>Aprobado Por (GERENCIA):</div>
    <div class="lf">${firmas.aprobadoGerencia||''}</div><div style="font-size:7.5pt;color:#555">日 Fecha: ${firmas.fechaGerencia||'年___  月___'}</div>
  </div>
  <div class="fc fc2"></div>
  <div class="fc fc3">
    <div class="lbl">交付者:</div><div>Entregado por:</div><div class="lf">${firmas.entregadoPor||''}</div>
    <div class="lbl" style="margin-top:10px">接收人:</div><div>Recibido Por:</div><div class="lf">${firmas.recibidoPor||''}</div>
    <div class="lbl" style="margin-top:10px">备注:</div><div>Observaciones:</div><div class="lf">${firmas.observaciones||''}</div>
  </div>
</div>
<div class="nota">Nota: Esta solicitud debe tener la aprobacion del Gerente o Jefe de area, no debe tener borrones o sobrescrituras.</div>
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
    setUnidad('')
    setSolic(perfil?.nombre || '')
    setFilas(Array.from({length: FILAS_INICIALES}, filaVacia))
    setFilaActiva(0)
    setFirmas(firmasVacias())
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1>Orden de Salida / 出库单</h1>
          <p className="text-sm text-gray-500">材料/服务发布申请批准表</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={nuevaOrden} className="btn-secondary btn-sm"><FilePlus size={14}/> Nueva</button>
          <button onClick={guardar} disabled={guardando} className="btn-secondary btn-sm">
            <Save size={14}/> {guardando ? 'Guardando...' : (docIdRef.current ? 'Actualizar' : 'Guardar')}
          </button>
          <button onClick={scannerActivo ? desactivarScanner : () => { setFilaActiva(0); activarScanner() }}
            className={scannerActivo ? 'btn-danger btn-sm' : 'btn-secondary btn-sm'}>
            <Scan size={14}/> {scannerActivo ? 'Cancelar scan' : 'Scanner QR'}
          </button>
          <button onClick={imprimir} disabled={guardando} className="btn-primary btn-sm">
            <Printer size={14}/> {guardando ? 'Guardando...' : 'Imprimir / PDF'}
          </button>
        </div>
      </div>

      {scannerActivo && (
        <div className="bg-primary text-white rounded-xl px-4 py-3 flex items-center gap-3">
          <Scan size={18} className="animate-pulse shrink-0"/>
          <p className="text-sm font-medium flex-1">
            Scanner activo — Fila {filaActiva + 1} lista. Escanea el QR del producto.
          </p>
          <button onClick={desactivarScanner} className="text-white/70 hover:text-white text-xs underline">Cancelar</button>
        </div>
      )}

      <div className="card space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">单据号码 Numero de solicitud</label>
            <input className="input font-mono" value={numSolicitud}
              placeholder="Se asignará al guardar"
              onChange={e=>{ numRef.current = e.target.value; setNum(e.target.value) }}/></div>
          <div><label className="label">单据日期 Fecha</label>
            <input className="input" type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></div>
          <div><label className="label">申请单位 Unidad Solicitante</label>
            <input className="input" placeholder="Departamento" value={unidadSolic} onChange={e=>setUnidad(e.target.value)}/></div>
          <div><label className="label">申请人 Solicitante</label>
            <input className="input" value={solicitante} onChange={e=>setSolic(e.target.value)}/></div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-blue-50">
                <th className="th w-10 text-center">序号<br/>No.</th>
                <th className="th">中文名称<br/>Desc. Chino</th>
                <th className="th">西语名称<br/>Desc. Espanol</th>
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
                const itemSel = items.find(i => i.id === f.itemId)
                const cantAnterior = f.itemId ? (filasPersistidasRef.current[f.itemId] || 0) : 0
                const deltaFila = (Number(f.cantidad) || 0) - cantAnterior
                const stockInsuficiente = itemSel && deltaFila > (itemSel.stock || 0)
                return (
                <tr key={idx} className={`border-b border-gray-100 ${filaActiva === idx && scannerActivo ? 'bg-primary-pale' : ''} ${stockInsuficiente ? 'bg-red-50' : ''}`}>
                  <td className="td p-1 text-center">
                    <button type="button"
                      onClick={() => { setFilaActiva(idx); activarScanner() }}
                      className={"w-7 h-7 rounded-full flex items-center justify-center mx-auto transition-all " + (filaActiva === idx && scannerActivo ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-primary-pale text-gray-500 hover:text-primary')}
                      title="Escanear QR en esta fila">
                      {filaActiva === idx && scannerActivo ? <Scan size={12}/> : idx+1}
                    </button>
                  </td>
                  <td className="td p-1">
                    <input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.descZh} onChange={e=>actualizarFila(idx,'descZh',e.target.value)}/>
                  </td>
                  <td className="td p-1">
                    <select className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-light"
                      value={f.itemId} onChange={e=>actualizarFila(idx,'itemId',e.target.value)}>
                      <option value="">—</option>
                      {items.map(i=><option key={i.id} value={i.id}>{i.descripcion||i.descripcionZh} (stock: {i.stock ?? 0})</option>)}
                    </select>
                    {f.descEs && <div className="text-xs text-primary mt-0.5 px-1">{f.descEs}</div>}
                    {stockInsuficiente && <div className="text-xs text-red-500 mt-0.5 px-1">⚠️ Stock insuficiente</div>}
                  </td>
                  <td className="td p-1"><input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.modelo} onChange={e=>actualizarFila(idx,'modelo',e.target.value)}/></td>
                  <td className="td p-1"><input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.serie} onChange={e=>actualizarFila(idx,'serie',e.target.value)}/></td>
                  <td className="td p-1">
                    <select
                      className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-light"
                      value={UNIDADES.includes(f.unidad) ? f.unidad : (f.unidad ? 'OTRO' : '')}
                      onChange={e => {
                        if (e.target.value === 'OTRO') {
                          actualizarFila(idx, 'unidad', '')
                        } else {
                          actualizarFila(idx, 'unidad', e.target.value)
                        }
                      }}
                    >
                      <option value="">—</option>
                      {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    {(!UNIDADES.includes(f.unidad) && f.unidad !== '') && (
                      <input
                        className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 mt-1 focus:outline-none"
                        placeholder="Especificar..."
                        value={f.unidad}
                        onChange={e => actualizarFila(idx, 'unidad', e.target.value)}
                      />
                    )}
                  </td>
                  <td className="td p-1"><input type="number" min="0" className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 text-center focus:outline-none" value={f.cantidad} onChange={e=>actualizarFila(idx,'cantidad',e.target.value)}/></td>
                  <td className="td p-1"><input type="number" min="0" step="0.01" className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 text-center focus:outline-none" value={f.precioUnitario} onChange={e=>actualizarFila(idx,'precioUnitario',e.target.value)}/></td>
                  <td className="td p-1 text-center font-semibold text-primary">{precioTotal || '—'}</td>
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
                <td className="td text-center font-bold text-primary">{montoTotal.toLocaleString()}</td>
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
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-sm text-primary">
          💾 Orden N° {numSolicitud} guardada. Si seguís editando y volvés a tocar Guardar o Imprimir, se actualizará el mismo registro (no se duplica).
        </div>
      )}

      <div className="card">
        <h3 className="mb-3 text-sm text-gray-500">签名区域 / Seccion de firmas</h3>
        <div className="grid grid-cols-3 gap-0 border border-gray-300 rounded-lg overflow-hidden text-xs">
          <div className="p-3 border-r border-gray-300 space-y-3">
            <div>
              <p className="font-bold">申请人签名 / Firma del solicitante:</p>
              <input className="w-full border-b border-gray-400 mt-2 text-sm py-1 focus:outline-none focus:border-primary"
                placeholder="Nombre" value={firmas.firmaSolicitante} onChange={e=>actualizarFirma('firmaSolicitante', e.target.value)}/>
            </div>
            <div>
              <p className="font-bold">区域负责人批准 / Aprobado Por (JEFE DE AREA):</p>
              <input className="w-full border-b border-gray-400 mt-2 text-sm py-1 focus:outline-none focus:border-primary"
                placeholder="Nombre" value={firmas.aprobadoJefeArea} onChange={e=>actualizarFirma('aprobadoJefeArea', e.target.value)}/>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-400">日 Fecha:</span>
                <input type="date" className="text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none"
                  value={firmas.fechaJefeArea} onChange={e=>actualizarFirma('fechaJefeArea', e.target.value)}/>
              </div>
            </div>
            <div>
              <p className="font-bold">仓库管理层批准 / Aprobado Por (GERENCIA):</p>
              <input className="w-full border-b border-gray-400 mt-2 text-sm py-1 focus:outline-none focus:border-primary"
                placeholder="Nombre" value={firmas.aprobadoGerencia} onChange={e=>actualizarFirma('aprobadoGerencia', e.target.value)}/>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-400">日 Fecha:</span>
                <input type="date" className="text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none"
                  value={firmas.fechaGerencia} onChange={e=>actualizarFirma('fechaGerencia', e.target.value)}/>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center border-r border-gray-300 p-4">
            {/* Espacio reservado para el sello físico */}
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
        <p className="text-red-500 text-xs mt-2">Nota: Esta solicitud debe tener la aprobacion del Gerente o Jefe de area, no debe tener borrones o sobrescrituras.</p>
      </div>
    </div>
  )
}
