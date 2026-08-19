import { useState, useEffect } from 'react'
import { Search, Package, AlertTriangle, Scan, ClipboardList, PackageMinus, PackagePlus, Printer, RefreshCw, Edit3, Trash2, Plus, Save } from 'lucide-react'
import { getItems } from '../services/inventario'
import { db } from '../services/firebase'
import { collection, getDocs, query as firestoreQuery, orderBy, doc, writeBatch, increment, serverTimestamp } from 'firebase/firestore'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { PageLoader } from '../components/ui/Spinner'
import { useScannerQR, parsearQR } from '../hooks/useScannerQR'
import { useAuth } from '../context/AuthContext'
import { registrarAccion } from '../services/auditoria'
import { traducirAlChino } from '../services/traduccion'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const FUENTES_ES = { importacion:'Importación', compra:'Compra local', devolucion:'Devolución' }
const FUENTES_ZH = { importacion:'进口', compra:'本地采购', devolucion:'退货' }

// ── Reimpresión de Orden de Salida (mismo formato que OrdenSalida.jsx) ──
function imprimirOrdenSalida(o) {
  const fechaFmt = o.fecha ? format(new Date(o.fecha + 'T00:00:00'), 'dd/MM/yyyy') : ''
  const firmas = o.firmas || {}
  const filasHTML = (o.filas || []).map((f, i) => {
    const precioTotal = f.precioTotal ?? ((Number(f.cantidad) || 0) * (Number(f.precioUnitario) || 0))
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
<title>Orden Salida ${o.numSolicitud}</title>
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
.fc2 { flex:0 0 17%; display:flex; align-items:center; justify-content:center; }
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
    <div class="campo"><b>单据号码 Numero de solicitud:</b><span class="val">${o.numSolicitud||''}</span></div>
    <div class="campo"><b>单据日期 Fecha:</b><span class="val">${fechaFmt}</span></div>
  </div>
  <div class="row-campo">
    <div class="campo"><b>申请单位 Unidad Solicitante:</b><span class="val">${o.unidadSolicitante||''}</span></div>
    <div class="campo"><b>申请人 Solicitante:</b><span class="val">${o.solicitante||''}</span></div>
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
      <td style="text-align:center;border:1px solid #aaa">${(o.montoTotal||0).toLocaleString()}</td>
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
  <div class="fc fc2"><div class=""><br/><br/></div></div>
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

// ── Reimpresión de Orden de Entrada (mismo formato que OrdenEntrada.jsx) ──
function imprimirOrdenEntrada(o) {
  const fechaFmt = o.fecha ? format(new Date(o.fecha + 'T00:00:00'), 'dd/MM/yyyy') : ''
  const fuenteLabel = `${FUENTES_ES[o.fuente]||o.fuente||''} / ${FUENTES_ZH[o.fuente]||''}`
  const firmas = o.firmas || {}
  const filasHTML = (o.filas || []).map((f, i) => {
    const precioTotal = f.precioTotal ?? ((Number(f.cantidad) || 0) * (Number(f.precioUnitario) || 0))
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
<title>Orden Entrada ${o.numSolicitud}</title>
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
    <div class="campo"><b>单据号码 Número de entrada:</b><span class="val">${o.numSolicitud||''}</span></div>
    <div class="campo"><b>日期 Fecha:</b><span class="val">${fechaFmt}</span></div>
  </div>
  <div class="row-campo">
    <div class="campo"><b>来源 Fuente:</b><span class="val">${fuenteLabel}</span></div>
    <div class="campo"><b>供应商 Proveedor:</b><span class="val">${o.proveedor||''}</span></div>
  </div>
  <div class="row-campo">
    <div class="campo"><b>接收人 Recibido por:</b><span class="val">${o.recibidoPor||''}</span></div>
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
      <td style="text-align:center;border:1px solid #aaa">${(o.montoTotal||0).toLocaleString()}</td>
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
  <div class="fc fc2"><div class=><br/></div></div>
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

// ── Modal de Edición de Órdenes de Salida y Entrada ────────────────────
function ModalEditarOrden({ orden, tipo, itemsInventario, onCerrar, onGuardadoExitoso, perfil }) {
  const [fecha, setFecha] = useState(orden?.fecha || '')
  const [campo1, setCampo1] = useState(tipo === 'salida' ? (orden?.solicitante || '') : (orden?.proveedor || ''))
  const [campo2, setCampo2] = useState(tipo === 'salida' ? (orden?.unidadSolicitante || '') : (orden?.recibidoPor || ''))
  const [fuente, setFuente] = useState(orden?.fuente || 'compra')
  const [filas, setFilas] = useState(orden?.filas ? JSON.parse(JSON.stringify(orden.filas)) : [])
  const [guardando, setGuardando] = useState(false)

  const handleFilaChange = (idx, campo, valor) => {
    setFilas(prev => {
      const n = [...prev]
      n[idx] = { ...n[idx], [campo]: valor }
      if (campo === 'itemId' && valor) {
        const item = itemsInventario.find(i => i.id === valor)
        if (item) {
          n[idx].descEs = item.descripcion || ''
          n[idx].descZh = item.descripcionZh || ''
          n[idx].modelo = item.modelo || ''
          n[idx].serie = item.serie || ''
          n[idx].unidad = item.unidad || 'unidad'
          n[idx].precioUnitario = Number(item.precio) || n[idx].precioUnitario || 0
        }
      }
      return n
    })
  }

  const handleEliminarFila = (idx) => {
    setFilas(prev => prev.filter((_, i) => i !== idx))
  }

  const handleAgregarFilaLibre = () => {
    setFilas(prev => [
      ...prev,
      {
        itemId: '',
        descEs: '',
        descZh: '',
        modelo: '',
        serie: '',
        unidad: 'unidad',
        cantidad: 1,
        precioUnitario: 0,
        precioTotal: 0,
        nota: ''
      }
    ])
  }

  const handleAgregarItemInventario = (itemId) => {
    const item = itemsInventario.find(i => i.id === itemId)
    if (!item) return
    setFilas(prev => [
      ...prev,
      {
        itemId: item.id,
        descEs: item.descripcion || '',
        descZh: item.descripcionZh || '',
        modelo: item.modelo || '',
        serie: item.serie || '',
        unidad: item.unidad || 'unidad',
        cantidad: 1,
        precioUnitario: Number(item.precio) || 0,
        precioTotal: Number(item.precio) || 0,
        nota: ''
      }
    ])
  }

  const { escuchando, activar, desactivar } = useScannerQR(async (textoQR) => {
    const parsed = parsearQR(textoQR)
    if (!parsed) { toast.error('QR no reconocido'); return }

    const item = itemsInventario.find(i => String(i.codigo) === String(parsed.codigo) || (i.serie && i.serie === parsed.serie))

    let descZh = item?.descripcionZh || ''
    if (!descZh && parsed.descripcion && parsed.descripcion.length > 2) {
      try { descZh = await traducirAlChino(parsed.descripcion) } catch(e) { descZh = '' }
    }

    setFilas(prev => [
      ...prev,
      {
        itemId: item?.id || '',
        descEs: item?.descripcion || parsed.descripcion || '',
        descZh: descZh || item?.descripcionZh || '',
        modelo: item?.modelo || '',
        serie: item?.serie || parsed.serie || '',
        unidad: item?.unidad || 'unidad',
        cantidad: 1,
        precioUnitario: Number(item?.precio) || 0,
        precioTotal: Number(item?.precio) || 0,
        nota: ''
      }
    ])
    toast.success('QR leído: ' + (item?.descripcion || parsed.descripcion))
    desactivar()
  })

  const handleGuardar = async (e) => {
    e.preventDefault()
    if (filas.length === 0) {
      return toast.error('La orden debe tener al menos un ítem')
    }

    setGuardando(true)
    try {
      const origMap = {}
      ;(orden.filas || []).forEach(f => {
        if (f.itemId) origMap[f.itemId] = (origMap[f.itemId] || 0) + (Number(f.cantidad) || 0)
      })

      const newMap = {}
      const filasConTotal = filas.map(f => {
        const cant = Number(f.cantidad) || 0
        const pu = Number(f.precioUnitario) || 0
        if (f.itemId) newMap[f.itemId] = (newMap[f.itemId] || 0) + cant
        return { ...f, cantidad: cant, precioUnitario: pu, precioTotal: cant * pu }
      })

      const itemsTocados = new Set([...Object.keys(origMap), ...Object.keys(newMap)])

      if (tipo === 'salida') {
        for (const itemId of itemsTocados) {
          const cantAnterior = origMap[itemId] || 0
          const cantNueva = newMap[itemId] || 0
          const delta = cantNueva - cantAnterior
          if (delta > 0) {
            const itemInv = itemsInventario.find(i => i.id === itemId)
            if (itemInv && (itemInv.stock || 0) < delta) {
              toast.error(`Stock insuficiente para "${itemInv.descripcion}": disponible ${itemInv.stock || 0}, necesitas ${delta} más`)
              setGuardando(false)
              return
            }
          }
        }
      }

      const batch = writeBatch(db)
      const col = tipo === 'salida' ? 'ordenes_salida' : 'ordenes_entrada'
      const ordenRef = doc(db, col, orden.id)

      const montoTotal = filasConTotal.reduce((a, f) => a + f.precioTotal, 0)
      const totalCantidad = filasConTotal.reduce((a, f) => a + f.cantidad, 0)

      const datosOrden = {
        fecha,
        filas: filasConTotal,
        montoTotal,
        totalCantidad,
        actualizadoEn: serverTimestamp(),
        actualizadoPor: perfil?.nombre || 'Sistema'
      }

      if (tipo === 'salida') {
        datosOrden.solicitante = campo1
        datosOrden.unidadSolicitante = campo2
      } else {
        datosOrden.proveedor = campo1
        datosOrden.recibidoPor = campo2
        datosOrden.fuente = fuente
      }

      batch.update(ordenRef, datosOrden)

      itemsTocados.forEach(itemId => {
        const cantAnterior = origMap[itemId] || 0
        const cantNueva = newMap[itemId] || 0
        const delta = cantNueva - cantAnterior
        if (delta !== 0) {
          const invRef = doc(db, 'inventario', itemId)
          if (tipo === 'salida') {
            batch.update(invRef, {
              stock: increment(-delta),
              totalSalidas: increment(delta),
              actualizadoEn: serverTimestamp()
            })
          } else {
            batch.update(invRef, {
              stock: increment(delta),
              actualizadoEn: serverTimestamp()
            })
          }
        }
      })

      await batch.commit()

      await registrarAccion({
        usuario: perfil?.nombre, rol: perfil?.rol,
        modulo: tipo === 'salida' ? 'Orden de Salida' : 'Orden de Entrada',
        accion: 'EDITAR',
        detalle: `Editó ${tipo === 'salida' ? 'Salida' : 'Entrada'} N° ${orden.numSolicitud}`
      })

      toast.success(`Orden de ${tipo} actualizada y stock de inventario sincronizado`)
      onGuardadoExitoso()
    } catch (err) {
      console.error(err)
      toast.error('Error al actualizar la orden: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  const totalCalculado = filas.reduce((a, f) => a + ((Number(f.cantidad) || 0) * (Number(f.precioUnitario) || 0)), 0)

  return (
    <Modal open={true} onClose={onCerrar} title={`Editar Orden de ${tipo === 'salida' ? 'Salida' : 'Entrada'} N° ${orden.numSolicitud}`} size="xl">
      <form onSubmit={handleGuardar} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {tipo === 'salida' ? 'Solicitante' : 'Proveedor'}
            </label>
            <input type="text" value={campo1} onChange={e => setCampo1(e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {tipo === 'salida' ? 'Unidad Solicitante' : 'Recibido por'}
            </label>
            <input type="text" value={campo2} onChange={e => setCampo2(e.target.value)} className="input-field" required />
          </div>
        </div>

        {/* Controles para añadir ítems */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAgregarFilaLibre}
              className="btn-secondary btn-sm flex items-center gap-1.5"
            >
              <Plus size={14}/> Agregar ítem libre
            </button>
            <button
              type="button"
              onClick={escuchando ? desactivar : activar}
              className={`btn-sm flex items-center gap-1.5 ${escuchando ? 'btn-danger' : 'btn-secondary'}`}
              title="Escanear QR"
            >
              <Scan size={14} className={escuchando ? 'animate-pulse' : ''} />
              {escuchando ? 'Detener Scanner' : 'Escanear QR'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">Catálogo:</span>
            <select
              onChange={e => {
                if (e.target.value) {
                  handleAgregarItemInventario(e.target.value)
                  e.target.value = ''
                }
              }}
              className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none max-w-xs"
            >
              <option value="">-- Seleccionar ítem del inventario --</option>
              {itemsInventario.map(it => (
                <option key={it.id} value={it.id}>
                  {it.codigo} - {it.descripcion} (Stock: {it.stock || 0})
                </option>
              ))}
            </select>
          </div>
        </div>

        {escuchando && (
          <div className="bg-primary text-white rounded-lg px-3 py-2 flex items-center gap-2 text-xs">
            <Scan size={15} className="animate-pulse shrink-0"/>
            <span>Scanner QR activo — escanea el código del producto para agregarlo a la orden</span>
            <button type="button" onClick={desactivar} className="ml-auto text-white/70 hover:text-white underline">
              Cancelar
            </button>
          </div>
        )}

        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 border-b border-gray-200 font-semibold text-gray-700">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Descripción (ES / ZH)</th>
                <th className="py-2.5 px-3 w-20">Cant.</th>
                <th className="py-2.5 px-3 w-24">P. Unit (Bs)</th>
                <th className="py-2.5 px-3 w-24">Subtotal</th>
                <th className="py-2.5 px-3">Nota</th>
                <th className="py-2.5 px-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filas.map((f, idx) => {
                const sub = (Number(f.cantidad) || 0) * (Number(f.precioUnitario) || 0)
                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-500">{idx + 1}</td>
                    <td className="py-2 px-3">
                      {f.itemId ? (
                        <div>
                          <div className="font-medium text-gray-800 flex items-center justify-between">
                            <span>{f.descEs}</span>
                            <button
                              type="button"
                              onClick={() => handleFilaChange(idx, 'itemId', '')}
                              className="text-[10px] text-gray-400 hover:text-primary underline ml-2"
                              title="Editar texto libremente"
                            >
                              Editar libre
                            </button>
                          </div>
                          {f.descZh && <div className="text-[11px] text-gray-400">{f.descZh}</div>}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <input
                            type="text"
                            placeholder="Descripción en Español"
                            value={f.descEs || ''}
                            onChange={e => handleFilaChange(idx, 'descEs', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-medium"
                          />
                          <input
                            type="text"
                            placeholder="Descripción en Chino (中文)"
                            value={f.descZh || ''}
                            onChange={e => handleFilaChange(idx, 'descZh', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-[11px]"
                          />
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number" min="1" step="1"
                        value={f.cantidad}
                        onChange={e => handleFilaChange(idx, 'cantidad', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number" min="0" step="0.01"
                        value={f.precioUnitario}
                        onChange={e => handleFilaChange(idx, 'precioUnitario', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </td>
                    <td className="py-2 px-3 font-bold text-gray-800">
                      {sub.toLocaleString()} Bs
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={f.nota || ''}
                        onChange={e => handleFilaChange(idx, 'nota', e.target.value)}
                        placeholder="Nota u obs..."
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none"
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleEliminarFila(idx)}
                        className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                        title="Eliminar ítem"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="text-sm font-bold text-primary">
            Total Orden: {totalCalculado.toLocaleString()} Bs
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCerrar} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary flex items-center gap-1">
              <Save size={14}/> {guardando ? 'Guardando...' : 'Guardar y Sincronizar Stock'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default function Consultas() {
  const { perfil } = useAuth()
  const [tab, setTab] = useState('items')

  const [items,   setItems]   = useState([])
  const [query,   setQuery]   = useState('')
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [verFoto, setVerFoto] = useState(null)

  const [salidas,       setSalidas]       = useState([])
  const [entradas,      setEntradas]      = useState([])
  const [loadingOrdenes,setLoadingOrdenes]= useState(true)
  const [busquedaOrden, setBusquedaOrden] = useState('')

  const [ordenEditando, setOrdenEditando] = useState(null)
  const [tipoOrdenEditando, setTipoOrdenEditando] = useState('salida')

  const canEdit = ['administrador', 'gerencia', 'almacenero'].includes(perfil?.rol)

  const cargarDatos = async () => {
    getItems().then(i => setItems(i))
    try {
      const [snapSalidas, snapEntradas] = await Promise.all([
        getDocs(firestoreQuery(collection(db, 'ordenes_salida'), orderBy('creadoEn', 'desc'))),
        getDocs(firestoreQuery(collection(db, 'ordenes_entrada'), orderBy('creadoEn', 'desc'))),
      ])
      setSalidas(snapSalidas.docs.map(d => ({ id: d.id, ...d.data() })))
      setEntradas(snapEntradas.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingOrdenes(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    getItems().then(i => { setItems(i); setLoading(false) })
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [])

  const buscar = (termino) => {
    const q = (termino || query).trim().toLowerCase()
    if (!q) return

    const porCodigoExacto = items.find(i => String(i.codigo) === q)
    if (porCodigoExacto) { setResult(porCodigoExacto); return }

    const porSerieExacta = items.find(i => i.serie && i.serie.toLowerCase() === q)
    if (porSerieExacta) { setResult(porSerieExacta); return }

    const porDesc = items.filter(i =>
      i.descripcion?.toLowerCase().includes(q) ||
      i.descripcionZh?.toLowerCase().includes(q)
    )
    if (porDesc.length === 1) { setResult(porDesc[0]); return }
    if (porDesc.length > 1)   { setResult(porDesc);    return }

    const porModelo = items.filter(i => i.modelo?.toLowerCase().includes(q))
    if (porModelo.length === 1) { setResult(porModelo[0]); return }
    if (porModelo.length > 1)   { setResult(porModelo);    return }

    const porSerie = items.filter(i => i.serie?.toLowerCase().includes(q))
    if (porSerie.length === 1) { setResult(porSerie[0]); return }
    if (porSerie.length > 1)   { setResult(porSerie);    return }

    setResult('not_found')
  }

  const { escuchando, activar, desactivar } = useScannerQR((textoQR) => {
    const parsed = parsearQR(textoQR)
    if (!parsed) { toast.error('QR no reconocido'); return }

    const porSerie = items.find(i => i.serie && i.serie === parsed.serie)
    if (porSerie) {
      setQuery(parsed.serie)
      setResult(porSerie)
      toast.success('Producto encontrado: ' + porSerie.descripcion)
    } else {
      const q = parsed.descripcion.toLowerCase()
      const porDesc = items.find(i => i.descripcion?.toLowerCase().includes(q))
      if (porDesc) {
        setQuery(parsed.descripcion)
        setResult(porDesc)
        toast.success('Producto encontrado: ' + porDesc.descripcion)
      } else {
        setQuery(parsed.serie)
        setResult('not_found')
        toast.error('No encontrado: ' + parsed.descripcion)
      }
    }
    desactivar()
  })

  const handleKeyDown = (e) => { if (e.key === 'Enter') buscar() }
  const limpiar = () => { setQuery(''); setResult(null) }
  const esLista = Array.isArray(result)

  const filtrarOrdenes = (lista) => {
    const q = busquedaOrden.trim().toLowerCase()
    if (!q) return lista
    return lista.filter(o => {
      const enCabecera = (o.numSolicitud||'').toLowerCase().includes(q) ||
        (o.solicitante||'').toLowerCase().includes(q) ||
        (o.recibidoPor||'').toLowerCase().includes(q) ||
        (o.proveedor||'').toLowerCase().includes(q) ||
        (o.unidadSolicitante||'').toLowerCase().includes(q) ||
        (o.fecha||'').includes(q)
      const enFilas = (o.filas||[]).some(f =>
        (f.descEs||'').toLowerCase().includes(q) || (f.descZh||'').toLowerCase().includes(q)
      )
      return enCabecera || enFilas
    })
  }

  const salidasFiltradas  = filtrarOrdenes(salidas)
  const entradasFiltradas = filtrarOrdenes(entradas)

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1>Consultas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Consulta ítems del inventario y el historial de órdenes de salida y entrada
        </p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {[
          { key:'items',    label:'Ítems',             icon: Package       },
          { key:'salidas',  label:'Órdenes de Salida',  icon: PackageMinus },
          { key:'entradas', label:'Órdenes de Entrada', icon: PackagePlus  },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon size={15}/> {label}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <div className="space-y-5">
          <div className="card space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input className="input pl-9 text-base"
                  placeholder="Código, descripción, modelo o N° de serie..."
                  value={query}
                  onChange={e => { setQuery(e.target.value); setResult(null) }}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <button onClick={() => buscar()} className="btn-primary">Buscar</button>
              <button
                onClick={escuchando ? desactivar : activar}
                className={escuchando ? 'btn-danger' : 'btn-secondary'}
                title="Escanear QR">
                <Scan size={16}/>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-gray-400">
              <span>Buscar por:</span>
              {[
                ['Código', 'Ej: 4'],
                ['Descripción', 'Ej: filtro'],
                ['Modelo', 'Ej: 8PK1068'],
                ['N° Serie', 'Ej: 11212087'],
              ].map(([tipo, ej]) => (
                <span key={tipo} className="bg-gray-100 rounded px-2 py-0.5">
                  <b>{tipo}</b> — {ej}
                </span>
              ))}
            </div>

            {escuchando && (
              <div className="bg-primary text-white rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
                <Scan size={15} className="animate-pulse shrink-0"/>
                <span>Scanner activo — escanea el QR del producto</span>
                <button onClick={desactivar} className="ml-auto text-white/70 hover:text-white text-xs underline">
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {result === 'not_found' && (
            <div className="card border-red-100 bg-red-50 flex items-center gap-3">
              <AlertTriangle size={20} className="text-red-500 shrink-0"/>
              <div>
                <p className="font-semibold text-red-700">No se encontró ningún ítem</p>
                <p className="text-xs text-red-500 mt-0.5">
                  Verifica el código, descripción o número de serie e intenta de nuevo.
                </p>
              </div>
              <button onClick={limpiar} className="ml-auto btn-secondary btn-sm">Limpiar</button>
            </div>
          )}

          {esLista && (
            <div className="card space-y-2">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-700">{result.length} resultados encontrados</p>
                <button onClick={limpiar} className="btn-secondary btn-sm">Limpiar</button>
              </div>
              {result.map(item => (
                <div key={item.id}
                  onClick={() => setResult(item)}
                  className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-primary-pale hover:border-primary-light cursor-pointer transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    {item.fotoUrl
                      ? <img src={item.fotoUrl} alt="foto" className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0"/>
                      : <div className="w-10 h-10 bg-primary-pale rounded-lg flex items-center justify-center shrink-0">
                          <Package size={16} className="text-primary"/>
                        </div>
                    }
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{item.descripcion}</p>
                      {item.descripcionZh && <p className="text-xs text-gray-400 truncate">{item.descripcionZh}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        Cód: <b className="text-primary">{item.codigo}</b>
                        {item.serie && <> · S/N: <b>{item.serie}</b></>}
                        {item.modelo && <> · {item.modelo}</>}
                      </p>
                    </div>
                  </div>
                  <Badge tipo={item.stock > 0 ? 'green' : 'red'}>
                    {item.stock > 0 ? `${item.stock} ${item.unidad}` : 'Sin stock'}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {result && !esLista && result !== 'not_found' && (
            <div className="card space-y-4">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                {result.fotoUrl
                  ? <img src={result.fotoUrl} alt="foto"
                      onClick={() => setVerFoto(result)}
                      className="w-20 h-20 rounded-xl object-cover border border-gray-200 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"/>
                  : <div className="w-20 h-20 bg-primary-pale rounded-xl flex items-center justify-center shrink-0">
                      <Package size={28} className="text-primary"/>
                    </div>
                }
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold text-gray-800">{result.descripcion}</h2>
                      {result.descripcionZh && (
                        <p className="text-gray-500 text-base">{result.descripcionZh}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Código: <span className="font-mono font-bold text-primary">{result.codigo}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {result.stock > 0
                        ? <span className="text-3xl font-bold text-green-600">{result.stock}</span>
                        : <span className="text-3xl font-bold text-red-500">0</span>}
                      <p className="text-xs text-gray-400">{result.unidad} en stock</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Categoría',    result.categoria   || '—'],
                  ['Modelo',       result.modelo      || '—'],
                  ['N° de serie',  result.serie       || '—'],
                  ['Ubicación',    result.ubicacion   || '—'],
                  ['Stock mínimo', result.stockMin ? `${result.stockMin} ${result.unidad}` : '—'],
                  ['Precio',       result.precio ? `${Number(result.precio).toLocaleString()} Bs` : 'Sin precio'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-0.5">{k}</p>
                    <p className="font-medium text-gray-800">{v}</p>
                  </div>
                ))}
              </div>

              {result.notas && (
                <div className="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-800">
                  <p className="text-xs font-semibold mb-1">Notas:</p>
                  <p>{result.notas}</p>
                </div>
              )}

              {result.stock === 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
                  <AlertTriangle size={16}/> <b>Sin stock disponible.</b> Se requiere ingreso.
                </div>
              )}
              {result.stockMin && result.stock > 0 && result.stock <= result.stockMin && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2 text-yellow-700 text-sm">
                  <AlertTriangle size={16}/> <b>Stock bajo.</b> Actual ({result.stock}) ≤ mínimo ({result.stockMin}).
                </div>
              )}

              <button onClick={limpiar} className="btn-secondary btn-sm w-full">
                Nueva búsqueda
              </button>
            </div>
          )}

          {!result && !query && (
            <div className="card">
              <h3 className="mb-3">⚠️ Ítems con stock crítico</h3>
              <div className="space-y-2">
                {items
                  .filter(i => !i.stock || i.stock === 0 || (i.stockMin && i.stock <= i.stockMin))
                  .slice(0, 8)
                  .map(i => (
                    <div key={i.id}
                      onClick={() => { setQuery(String(i.codigo)); setResult(i) }}
                      className="flex items-center justify-between py-2 px-3 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer transition">
                      <div>
                        <span className="text-sm font-medium">{i.descripcion}</span>
                        {i.descripcionZh && <span className="text-xs text-gray-400 ml-2">{i.descripcionZh}</span>}
                      </div>
                      <Badge tipo={i.stock === 0 ? 'red' : 'yellow'}>
                        {i.stock === 0 ? 'Sin stock' : `Stock bajo: ${i.stock}`}
                      </Badge>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(tab === 'salidas' || tab === 'entradas') && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap gap-3">
            <div className="flex-1 min-w-48 relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input className="input pl-9" placeholder="Buscar por N°, solicitante, proveedor, fecha o ítem..."
                value={busquedaOrden} onChange={e => setBusquedaOrden(e.target.value)}/>
            </div>
            {busquedaOrden && (
              <button onClick={() => setBusquedaOrden('')} className="btn-secondary btn-sm">
                <RefreshCw size={13}/> Limpiar
              </button>
            )}
          </div>

          {loadingOrdenes ? <PageLoader/> : (
            <div className="card p-0 overflow-hidden">
              {tab === 'salidas' && (
                salidasFiltradas.length === 0 ? (
                  <div className="p-10 text-center text-gray-400">No hay órdenes de salida registradas</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table-auto w-full min-w-[650px]">
                      <thead><tr>
                        {['N°','Fecha','Solicitante','Unidad','Ítems','Total Bs','Por','Acciones'].map(h => (
                          <th key={h} className="th">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {salidasFiltradas.map(o => (
                          <tr key={o.id} className="tr-hover">
                            <td className="td font-mono text-xs">{o.numSolicitud}</td>
                            <td className="td text-xs text-gray-500">{o.fecha || '—'}</td>
                            <td className="td font-medium">{o.solicitante || '—'}</td>
                            <td className="td"><Badge tipo="blue">{o.unidadSolicitante || '—'}</Badge></td>
                            <td className="td text-gray-500">{o.filas?.length || 0}</td>
                            <td className="td font-bold text-primary">{(o.montoTotal||0).toLocaleString()} Bs</td>
                            <td className="td text-xs text-gray-400">{o.creadoPor}</td>
                            <td className="td">
                              <div className="flex items-center gap-1">
                                {canEdit && (
                                  <button onClick={() => { setOrdenEditando(o); setTipoOrdenEditando('salida'); }}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-primary transition-colors" title="Editar Orden">
                                    <Edit3 size={14}/>
                                  </button>
                                )}
                                <button onClick={() => imprimirOrdenSalida(o)}
                                  className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors" title="Reimprimir">
                                  <Printer size={14}/>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {tab === 'entradas' && (
                entradasFiltradas.length === 0 ? (
                  <div className="p-10 text-center text-gray-400">No hay órdenes de entrada registradas</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table-auto w-full min-w-[650px]">
                      <thead><tr>
                        {['N°','Fecha','Proveedor','Fuente','Recibido por','Ítems','Total Bs','Por','Acciones'].map(h => (
                          <th key={h} className="th">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {entradasFiltradas.map(o => (
                          <tr key={o.id} className="tr-hover">
                            <td className="td font-mono text-xs">{o.numSolicitud}</td>
                            <td className="td text-xs text-gray-500">{o.fecha || '—'}</td>
                            <td className="td font-medium">{o.proveedor || '—'}</td>
                            <td className="td"><Badge tipo="blue">{FUENTES_ES[o.fuente] || o.fuente || '—'}</Badge></td>
                            <td className="td text-gray-500">{o.recibidoPor || '—'}</td>
                            <td className="td text-gray-500">{o.filas?.length || 0}</td>
                            <td className="td font-bold text-success">{(o.montoTotal||0).toLocaleString()} Bs</td>
                            <td className="td text-xs text-gray-400">{o.creadoPor}</td>
                            <td className="td">
                              <div className="flex items-center gap-1">
                                {canEdit && (
                                  <button onClick={() => { setOrdenEditando(o); setTipoOrdenEditando('entrada'); }}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-primary transition-colors" title="Editar Orden">
                                    <Edit3 size={14}/>
                                  </button>
                                )}
                                <button onClick={() => imprimirOrdenEntrada(o)}
                                  className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors" title="Reimprimir">
                                  <Printer size={14}/>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {ordenEditando && (
        <ModalEditarOrden
          orden={ordenEditando}
          tipo={tipoOrdenEditando}
          itemsInventario={items}
          perfil={perfil}
          onCerrar={() => setOrdenEditando(null)}
          onGuardadoExitoso={() => {
            setOrdenEditando(null)
            cargarDatos()
          }}
        />
      )}

      <Modal open={!!verFoto} onClose={() => setVerFoto(null)} title={verFoto?.descripcion || ''} size="sm">
        {verFoto?.fotoUrl && (
          <img src={verFoto.fotoUrl} alt="foto" className="w-full rounded-xl object-contain max-h-96" />
        )}
      </Modal>
    </div>
  )
}