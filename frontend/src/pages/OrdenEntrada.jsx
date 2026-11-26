import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const { perfil } = useAuth()
  const [items,       setItems]   = useState([])
  const [loading,     setLoading] = useState(true)
  const [numSolicitud,setNum]     = useState('')
  const numRef = useRef('')
  const docIdRef = useRef(null)
  const filasPersistidasRef = useRef({})
  const [fecha,       setFecha]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [fuente,      setFuente]  = useState('importacion')
  const [proveedor,   setProv]    = useState('')
  const [recibidoPor, setRecibe]  = useState('')
  const [firmas,      setFirmas]  = useState(firmasVacias())
  const [guardando,   setGuardando] = useState(false)
  const [guardadoUnaVez, setGuardadoUnaVez] = useState(false)
  const [filaActiva,  setFilaActiva] = useState(0)
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

  // ── Scanner QR integrado en la tabla ─────────────────────────────
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
    if (perfil?.nombre) setRecibe(perfil.nombre)
  }, [perfil])

  const totalCantidad = filas.reduce((a, f) => a + (Number(f.cantidad) || 0), 0)
  const montoTotal = filas.reduce((a, f) => a + ((Number(f.cantidad) || 0) * (Number(f.precioUnitario) || 0)), 0)

  const actualizarFila = (idx, campo, valor) => {
    setFilas(prev => {
      const n = [...prev]
      n[idx] = { ...n[idx], [campo]: valor }

      const valTrim = (valor || '').toString().trim().toLowerCase()

      if (campo === 'itemId' && valor) {
        const it = items.find(i => i.id === valor)
        if (it) {
          n[idx].descEs = it.descripcion || ''
          n[idx].descZh = it.descripcionZh || ''
          n[idx].modelo = it.modelo || ''
          n[idx].serie = it.serie || ''
          n[idx].unidad = it.unidad || ''
          n[idx].precioUnitario = it.precio || n[idx].precioUnitario || ''
        }
      } else if (campo === 'serie' && valTrim) {
        const it = items.find(i =>
          (i.serie && String(i.serie).trim().toLowerCase() === valTrim) ||
          (i.codigo && String(i.codigo).trim().toLowerCase() === valTrim)
        )
        if (it) {
          n[idx].itemId = it.id
          n[idx].descEs = it.descripcion || n[idx].descEs || ''
          n[idx].descZh = it.descripcionZh || n[idx].descZh || ''
          n[idx].modelo = it.modelo || n[idx].modelo || ''
          n[idx].unidad = it.unidad || n[idx].unidad || ''
          n[idx].precioUnitario = it.precio || n[idx].precioUnitario || ''
        }
      } else if (campo === 'modelo' && valTrim) {
        const it = items.find(i => i.modelo && String(i.modelo).trim().toLowerCase() === valTrim)
        if (it) {
          n[idx].itemId = it.id
          n[idx].descEs = it.descripcion || n[idx].descEs || ''
          n[idx].descZh = it.descripcionZh || n[idx].descZh || ''
          n[idx].serie = it.serie || n[idx].serie || ''
          n[idx].unidad = it.unidad || n[idx].unidad || ''
          n[idx].precioUnitario = it.precio || n[idx].precioUnitario || ''
        }
      } else if (campo === 'descEs' && valTrim) {
        const it = items.find(i =>
          (i.descripcion && String(i.descripcion).trim().toLowerCase() === valTrim) ||
          (i.codigo && String(i.codigo).trim().toLowerCase() === valTrim)
        )
        if (it) {
          n[idx].itemId = it.id
          n[idx].descZh = it.descripcionZh || n[idx].descZh || ''
          n[idx].modelo = it.modelo || n[idx].modelo || ''
          n[idx].serie = it.serie || n[idx].serie || ''
          n[idx].unidad = it.unidad || n[idx].unidad || ''
          n[idx].precioUnitario = it.precio || n[idx].precioUnitario || ''
        }
      }

      return n
    })
  }

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

      const isDevolucion = fuente === 'devolucion'

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
          const itemUpdates = {
            stock: increment(delta),
            actualizadoEn: serverTimestamp(),
          }
          // Si la orden de entrada es por Devolución, decrementar automáticamente el total de salidas acumuladas
          if (isDevolucion) {
            itemUpdates.totalSalidas = increment(-delta)
          }
          batch.update(doc(db, 'inventario', itemId), itemUpdates)
        }
      })

      await batch.commit()

      await registrarAccion({
        usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Orden de Entrada',
        accion: esNueva ? 'CREAR' : 'EDITAR',
        detalle: `Entrada ${numero} (${fuente}): ${filasValidas.length} ítem(s), total ${totalCantidad} unidades, ${montoTotal.toLocaleString()} Bs`,
      })

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
.header { display:flex; align-items:center; gap:10px; margin-bottom:6px; border-bottom:2px solid #15803D; padding-bottom:6px; }
.logo { width:56px; height:56px; border-radius:8px; overflow:hidden; border:1px solid #16241F; display:flex; align-items:center; justify-content:center; flex-shrink:0; background:#FDE200; }
.logo img { width:100%; height:100%; object-fit:cover; }
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
.fc2 { flex:0 0 17%; }
.fc3 { flex:1; }
.lf { border-bottom:1px solid #aaa; margin:6px 0 2px 0; min-height:14px; padding:1px 2px; font-weight:400; }
.lbl { font-weight:700; margin-top:8px; }
.nota { color:#1d7044; font-size:7.5pt; margin-top:5px; }
@page { size: landscape; size: A4 landscape; margin: 8mm; }
@media print { body{padding:0} }
</style></head><body>
<div class="header">
  <div class="logo"><img src="${window.location.origin}/logo-sajama.jpg" alt="Sajama 4x4" /></div>
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
    <th style="width:16%">Descripción En Chino</th>
    <th style="width:16%">Descripción En Español</th>
    <th style="width:10%">Modelo, Tipo</th>
    <th style="width:8%">Serie</th>
    <th style="width:7%">Unidad</th>
    <th style="width:6%">Cantidad</th>
    <th style="width:8%">P. Unitario</th>
    <th style="width:8%">P. Total</th>
    <th style="width:15%">Nota</th>
  </tr></thead>
  <tbody>
    ${filasHTML}
    <tr class="total-row">
      <td colspan="8" style="text-align:right;padding-right:8px;border:1px solid #aaa">Monto Total (Bs):</td>
      <td style="text-align:center;border:1px solid #aaa">${montoTotal.toLocaleString()}</td>
      <td style="border:1px solid #aaa"></td>
    </tr>
  </tbody>
</table>
<div class="firmas">
  <div class="fc fc1">
    <div class="lbl">Firma del solicitante:</div>
    <div class="lf">${firmas.firmaSolicitante||''}</div>
    <div class="lbl" style="margin-top:12px">Aprobado Por (GERENCIA):</div>
    <div class="lf">${firmas.aprobadoGerencia||''}</div>
  </div>
  <div class="fc fc2"></div>
  <div class="fc fc3">
    <div class="lbl">Entregado por:</div><div class="lf">${firmas.entregadoPor||''}</div>
    <div class="lbl" style="margin-top:10px">Recibido Por:</div><div class="lf">${firmas.recibidoPor||''}</div>
    <div class="lbl" style="margin-top:10px">Observaciones:</div><div class="lf">${firmas.observaciones||''}</div>
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

    const w = window.open('','_blank','width=1100,height=750')
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
    setFilaActiva(0)
    setFirmas(firmasVacias())
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Datalists para autocompletado y filtrado por nombre, serie y modelo */}
      <datalist id="datalist-oe-desc">
        {items.map(i => (
          <option key={i.id} value={i.descripcion}>
            {i.codigo ? `[${i.codigo}] ` : ''}{i.descripcion} {i.modelo ? `| Mod: ${i.modelo}` : ''} {i.serie ? `| Serie: ${i.serie}` : ''} (Stock: {i.stock ?? 0})
          </option>
        ))}
      </datalist>
      <datalist id="datalist-oe-serie">
        {items.filter(i => i.serie).map(i => (
          <option key={i.id} value={i.serie}>
            {i.serie} — {i.descripcion} {i.modelo ? `(Mod: ${i.modelo})` : ''}
          </option>
        ))}
      </datalist>
      <datalist id="datalist-oe-modelo">
        {items.filter(i => i.modelo).map(i => (
          <option key={i.id} value={i.modelo}>
            {i.modelo} — {i.descripcion} {i.serie ? `(Serie: ${i.serie})` : ''}
          </option>
        ))}
      </datalist>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1>{isZh ? '入库单 / Orden de Entrada' : 'Orden de Entrada / 入库单'}</h1>
          <p className="text-sm text-gray-500">{isZh ? '入库收料单表' : 'Formulario de confirmación de ingreso oficial de materiales'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={nuevaOrden} className="btn-secondary btn-sm"><FilePlus size={14}/> {isZh ? '新建' : 'Nueva'}</button>
          <button onClick={guardar} disabled={guardando} className="btn-secondary btn-sm">
            <Save size={14}/> {guardando ? t('common.guardando') : (docIdRef.current ? t('common.actualizar') : t('common.guardar'))}
          </button>
          <button onClick={scannerActivo ? desactivarScanner : () => { setFilaActiva(0); activarScanner() }}
            className={scannerActivo ? 'btn-danger btn-sm' : 'btn-secondary btn-sm'}>
            <Scan size={14}/> {scannerActivo ? (isZh ? '取消扫描' : 'Cancelar scan') : (isZh ? '二维码扫描' : 'Scanner QR')}
          </button>
          <button onClick={imprimir} disabled={guardando} className="btn-success btn-sm">
            <Printer size={14}/> {guardando ? t('common.guardando') : t('common.imprimir')}
          </button>
        </div>
      </div>

      {scannerActivo && (
        <div className="bg-success text-white rounded-xl px-4 py-3 flex items-center gap-3">
          <Scan size={18} className="animate-pulse shrink-0"/>
          <p className="text-sm font-medium flex-1">
            {isZh ? `扫描仪就绪 — 第 ${filaActiva + 1} 行。请扫描产品二维码。` : `Scanner activo — Fila ${filaActiva + 1} lista. Escanea el QR del producto.`}
          </p>
          <button onClick={desactivarScanner} className="text-white/70 hover:text-white text-xs underline">{t('common.cancelar')}</button>
        </div>
      )}

      <div className="card space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">{isZh ? '入库单号' : 'Número de entrada'}</label>
            <input className="input font-mono" value={numSolicitud}
              placeholder={isZh ? '保存时自动生成' : 'Se asignará al guardar'}
              onChange={e=>{ numRef.current = e.target.value; setNum(e.target.value) }}/></div>
          <div><label className="label">{isZh ? '日期' : 'Fecha'}</label>
            <input className="input" type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></div>
          <div><label className="label">{isZh ? '入库来源' : 'Fuente de ingreso'}</label>
            <select className="input" value={fuente} onChange={e=>setFuente(e.target.value)}>
              {Object.entries(FUENTES_ES).map(([k,v])=>(
                <option key={k} value={k}>{isZh ? FUENTES_ZH[k] : `${v} / ${FUENTES_ZH[k]}`}</option>
              ))}
            </select></div>
          <div><label className="label">{isZh ? '供应商 / 来源' : 'Proveedor / Origen'}</label>
            <input className="input" placeholder={isZh ? '供应商名称' : 'Nombre / 供应商名称'} value={proveedor} onChange={e=>setProv(e.target.value)}/></div>
          <div><label className="label">{isZh ? '签收人' : 'Recibido por'}</label>
            <input className="input" value={recibidoPor} onChange={e=>setRecibe(e.target.value)}/></div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-green-50">
                <th className="th w-10 text-center">No.</th>
                <th className="th">Desc. Chino</th>
                <th className="th">Desc. Español</th>
                <th className="th">Modelo</th>
                <th className="th">Serie</th>
                <th className="th">Unidad</th>
                <th className="th w-16">Cant.</th>
                <th className="th w-20">P. Unit. (Bs)</th>
                <th className="th w-20">P. Total (Bs)</th>
                <th className="th">Nota</th>
                <th className="th w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, idx) => {
                const precioTotal = (Number(f.cantidad) || 0) * (Number(f.precioUnitario) || 0)
                return (
                <tr key={idx} className={`border-b border-gray-100 ${filaActiva === idx && scannerActivo ? 'bg-green-50' : ''}`}>
                  <td className="td p-1 text-center">
                    <button type="button"
                      onClick={() => { setFilaActiva(idx); activarScanner() }}
                      className={"w-7 h-7 rounded-full flex items-center justify-center mx-auto transition-all " + (filaActiva === idx && scannerActivo ? 'bg-success text-white' : 'bg-gray-100 hover:bg-green-50 text-gray-500 hover:text-success')}
                      title="Escanear QR en esta fila">
                      {filaActiva === idx && scannerActivo ? <Scan size={12}/> : idx+1}
                    </button>
                  </td>
                  <td className="td p-1">
                    <input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.descZh} onChange={e=>actualizarFila(idx,'descZh',e.target.value)}/>
                  </td>
                  <td className="td p-1">
                    <select className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-green-400"
                      value={f.itemId} onChange={e=>actualizarFila(idx,'itemId',e.target.value)}>
                      <option value="">— Catálogo —</option>
                      {items.map(i=> (
                        <option key={i.id} value={i.id}>
                          {i.codigo ? `[${i.codigo}] ` : ''}{i.descripcion || i.descripcionZh} {i.serie ? `| S:${i.serie}` : ''} {i.modelo ? `| M:${i.modelo}` : ''} (stock: {i.stock ?? 0})
                        </option>
                      ))}
                    </select>
                    <input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 mt-1 focus:outline-none focus:ring-1 focus:ring-green-400"
                      placeholder="Descripción en Español (escribir o buscar en catálogo)..."
                      list="datalist-oe-desc"
                      value={f.descEs} onChange={e=>actualizarFila(idx,'descEs',e.target.value)} />
                  </td>
                  <td className="td p-1">
                    <input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none"
                      placeholder="Modelo..."
                      list="datalist-oe-modelo"
                      value={f.modelo} onChange={e=>actualizarFila(idx,'modelo',e.target.value)}/>
                  </td>
                  <td className="td p-1">
                    <input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none font-mono"
                      placeholder="Serie..."
                      list="datalist-oe-serie"
                      value={f.serie} onChange={e=>actualizarFila(idx,'serie',e.target.value)}/>
                  </td>
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
                <td colSpan={8} className="td text-right font-bold text-xs pr-3">{isZh ? '金额合计 Monto Total (Bs):' : 'Monto Total (Bs):'}</td>
                <td className="td text-center font-bold text-success">{montoTotal.toLocaleString()}</td>
                <td className="td" colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-gray-100">
          <button type="button" onClick={agregarFila} className="btn-secondary btn-sm">
            <Plus size={14}/> {isZh ? '添加行' : 'Agregar fila'}
          </button>
        </div>
      </div>

      {guardadoUnaVez && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-sm text-green-700">
          {isZh
            ? `💾 入库单 ${numSolicitud} 已保存。库存和累计入库量已同步更新。`
            : `💾 Orden N° ${numSolicitud} guardada. Se actualizó el stock y las salidas acumuladas si corresponde.`}
        </div>
      )}

      <div className="card">
        <h3 className="mb-3 text-sm text-gray-500">{isZh ? '签名区域' : 'Sección de firmas'}</h3>
        <div className="grid grid-cols-3 gap-0 border border-gray-300 rounded-lg overflow-hidden text-xs">
          <div className="p-3 border-r border-gray-300 space-y-3">
            <div>
              <p className="font-bold">Firma del solicitante:</p>
              <input className="w-full border-b border-gray-400 mt-2 text-sm py-1 focus:outline-none focus:border-success"
                placeholder="Nombre" value={firmas.firmaSolicitante} onChange={e=>actualizarFirma('firmaSolicitante', e.target.value)}/>
            </div>
            <div>
              <p className="font-bold">Aprobado Por (GERENCIA):</p>
              <input className="w-full border-b border-gray-400 mt-2 text-sm py-1 focus:outline-none focus:border-success"
                placeholder="Nombre" value={firmas.aprobadoGerencia} onChange={e=>actualizarFirma('aprobadoGerencia', e.target.value)}/>
            </div>
          </div>
          <div className="flex items-center justify-center border-r border-gray-300 p-4">
          </div>
          <div className="p-3 space-y-3">
            <div>
              <p className="font-bold">Entregado por:</p>
              <input className="w-full border-b border-gray-400 mt-2 text-sm py-1 focus:outline-none focus:border-success"
                placeholder="Nombre" value={firmas.entregadoPor} onChange={e=>actualizarFirma('entregadoPor', e.target.value)}/>
            </div>
            <div>
              <p className="font-bold">Recibido Por:</p>
              <input className="w-full border-b border-gray-400 mt-2 text-sm py-1 focus:outline-none focus:border-success"
                placeholder="Nombre" value={firmas.recibidoPor} onChange={e=>actualizarFirma('recibidoPor', e.target.value)}/>
            </div>
            <div>
              <p className="font-bold">Observaciones:</p>
              <input className="w-full border-b border-gray-400 mt-2 text-sm py-1 focus:outline-none focus:border-success"
                placeholder="Observaciones" value={firmas.observaciones} onChange={e=>actualizarFirma('observaciones', e.target.value)}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
