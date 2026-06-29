import { useState, useEffect, useRef } from 'react'
import { getItems } from '../services/inventario'
import { useAuth } from '../context/AuthContext'
import { PageLoader } from '../components/ui/Spinner'
import { Printer, FilePlus, Save } from 'lucide-react'
import { format } from 'date-fns'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import toast from 'react-hot-toast'

const MAX_FILAS = 9

export default function OrdenSalida() {
  const { perfil } = useAuth()
  const [items,       setItems]   = useState([])
  const [loading,     setLoading] = useState(true)
  const [numSolicitud,setNum]     = useState(() => 'OS-' + Date.now().toString().slice(-6))
  const [fecha,       setFecha]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [unidadSolic, setUnidad]  = useState('')
  const [solicitante, setSolic]   = useState('')

  const filaVacia = () => ({ itemId:'', descZh:'', descEs:'', modelo:'', serie:'', unidad:'', cantidad:'', nota:'' })
  const [filas, setFilas] = useState(Array.from({length: MAX_FILAS}, filaVacia))

  useEffect(() => {
    getItems().then(i => { setItems(i); setLoading(false) })
    if (perfil?.nombre) setSolic(perfil.nombre)
  }, [perfil])

  const total = filas.reduce((a, f) => a + (Number(f.cantidad) || 0), 0)

  const actualizarFila = (idx, campo, valor) => {
    setFilas(prev => {
      const n = [...prev]
      n[idx] = { ...n[idx], [campo]: valor }
      if (campo === 'itemId' && valor) {
        const it = items.find(i => i.id === valor)
        if (it) { n[idx].descEs = it.descripcion||''; n[idx].descZh = it.descripcionZh||''; n[idx].modelo = it.modelo||''; n[idx].serie = it.serie||''; n[idx].unidad = it.unidad||'' }
      }
      return n
    })
  }

  const guardar = async () => {
    try {
      await addDoc(collection(db, 'ordenes_salida'), {
        tipo:'salida', numSolicitud, fecha,
        unidadSolicitante: unidadSolic,
        solicitante: solicitante||perfil?.nombre,
        filas: filas.filter(f => f.descEs||f.descZh||f.cantidad),
        totalCantidad: total, estado:'emitida',
        creadoPor: perfil?.nombre, creadoEn: serverTimestamp(),
      })
      toast.success('Orden guardada correctamente')
    } catch(e) { toast.error('Error: ' + e.message) }
  }

  const imprimir = () => {
    const fechaFmt = fecha ? format(new Date(fecha + 'T00:00:00'), 'dd/MM/yyyy') : ''
    const filasHTML = filas.map((f, i) => `
      <tr>
        <td style="text-align:center;border:1px solid #aaa;padding:2px 4px">${i+1}</td>
        <td style="border:1px solid #aaa;padding:2px 4px">${f.descZh||''}</td>
        <td style="border:1px solid #aaa;padding:2px 4px">${f.descEs||''}</td>
        <td style="border:1px solid #aaa;padding:2px 4px">${f.modelo||''}</td>
        <td style="border:1px solid #aaa;padding:2px 4px">${f.serie||''}</td>
        <td style="border:1px solid #aaa;padding:2px 4px">${f.unidad||''}</td>
        <td style="text-align:center;border:1px solid #aaa;padding:2px 4px">${f.cantidad||''}</td>
        <td style="border:1px solid #aaa;padding:2px 4px">${f.nota||''}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Orden Salida ${numSolicitud}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans SC','Microsoft YaHei','SimSun',Arial,sans-serif; font-size:9pt; color:#111; padding:12mm; }
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
.val { border-bottom:1px solid #777; flex:1; padding:1px 3px; min-height:13px; font-size:8.5pt; }
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
.lf { border-bottom:1px solid #aaa; margin:13px 0 2px 0; }
.lbl { font-weight:700; margin-top:8px; }
.nota { color:red; font-size:7.5pt; margin-top:5px; }
@page { size:A4 portrait; margin:10mm; }
@media print { body{padding:0} .no-print{display:none} }
</style></head><body>
<div class="header">
  <div class="logo">SAJAMA 4x4<br/>LOGO</div>
  <div class="htxt">
    <div class="empresa">SAJAMA &nbsp; 萨哈马</div>
    <div class="dir">El Alto, avenida 6 de marzo (carretera a Oruro) cerca cruce Achocalla</div>
    <div class="titzh">材料/服务发布申请审批表</div>
    <div class="tites">Formulario de aprobación de solicitud de salida de materiales / servicio</div>
  </div>
</div>
<div class="campos">
  <div class="row-campo">
    <div class="campo"><b>单据号码 Número de solicitud:</b><span class="val">${numSolicitud}</span></div>
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
    <th style="width:20%">中文名称\nDescripción En Chino</th>
    <th style="width:20%">西语名称\nDescripción En Español</th>
    <th style="width:13%">规格型号\nModelo, Tipo</th>
    <th style="width:9%">系列\nSerie</th>
    <th style="width:8%">单位\nUnidad</th>
    <th style="width:8%">数量\nCantidad</th>
    <th style="width:16%">备注\nNota</th>
  </tr></thead>
  <tbody>
    ${filasHTML}
    <tr class="total-row">
      <td colspan="6" style="text-align:right;padding-right:8px;border:1px solid #aaa">总计 Total:</td>
      <td style="text-align:center;border:1px solid #aaa">${total||''}</td>
      <td style="border:1px solid #aaa"></td>
    </tr>
  </tbody>
</table>
<div class="firmas">
  <div class="fc fc1">
    <div class="lbl">申请人签名:</div><div>Firma del solicitante:</div>
    <div class="lf"></div>
    <div class="lbl" style="margin-top:10px">区域负责人批准:</div><div>Aprobado Por (JEFE DE AREA):</div>
    <div class="lf"></div><div style="font-size:7.5pt;color:#555">日 Fecha: 年___  月___</div>
    <div class="lbl" style="margin-top:8px">仓库管理层批准:</div><div>Aprobado Por (GERENCIA):</div>
    <div class="lf"></div><div style="font-size:7.5pt;color:#555">日 Fecha: 年___  月___</div>
  </div>
  <div class="fc fc2"><div class="sello">全币财审<br/>SELLO DE<br/>ALMACEN</div></div>
  <div class="fc fc3">
    <div class="lbl">交付者:</div><div>Entregado por:</div><div class="lf"></div>
    <div class="lbl" style="margin-top:10px">接收人:</div><div>Recibido Por:</div><div class="lf"></div>
    <div class="lbl" style="margin-top:10px">备注:</div><div>Observaciones:</div><div class="lf"></div>
  </div>
</div>
<div class="nota">Nota: Esta solicitud debe tener la aprobación del Gerente o Jefe de área, no debe tener borrones o sobrescrituras.</div>
<script>window.onload=()=>setTimeout(()=>{window.print()},600)<\/script>
</body></html>`

    const w = window.open('','_blank','width=900,height=700')
    w.document.write(html)
    w.document.close()
  }

  const nuevaOrden = () => {
    setNum('OS-' + Date.now().toString().slice(-6))
    setFecha(format(new Date(), 'yyyy-MM-dd'))
    setUnidad('')
    setSolic(perfil?.nombre || '')
    setFilas(Array.from({length: MAX_FILAS}, filaVacia))
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1>Orden de Salida / 出库单</h1>
          <p className="text-sm text-gray-500">材料/服务发布申请审批表</p>
        </div>
        <div className="flex gap-2">
          <button onClick={nuevaOrden} className="btn-secondary btn-sm"><FilePlus size={14}/> Nueva</button>
          <button onClick={guardar} className="btn-secondary btn-sm"><Save size={14}/> Guardar</button>
          <button onClick={imprimir} className="btn-primary btn-sm"><Printer size={14}/> Imprimir / PDF</button>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">单据号码 Número de solicitud</label>
            <input className="input font-mono" value={numSolicitud} onChange={e=>setNum(e.target.value)}/></div>
          <div><label className="label">单据日期 Fecha</label>
            <input className="input" type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></div>
          <div><label className="label">申请单位 Unidad Solicitante</label>
            <input className="input" placeholder="Departamento / 部门" value={unidadSolic} onChange={e=>setUnidad(e.target.value)}/></div>
          <div><label className="label">申请人 Solicitante</label>
            <input className="input" value={solicitante} onChange={e=>setSolic(e.target.value)}/></div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-blue-50">
                <th className="th w-8">序号<br/>No.</th>
                <th className="th">中文名称<br/>Desc. Chino</th>
                <th className="th">西语名称<br/>Desc. Español</th>
                <th className="th">规格型号<br/>Modelo</th>
                <th className="th">系列<br/>Serie</th>
                <th className="th">单位<br/>Unidad</th>
                <th className="th w-16">数量<br/>Cant.</th>
                <th className="th">备注<br/>Nota</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="td text-center text-gray-400 font-bold">{idx+1}</td>
                  <td className="td p-1">
                    <select className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-light"
                      value={f.itemId} onChange={e=>actualizarFila(idx,'itemId',e.target.value)}>
                      <option value="">—</option>
                      {items.map(i=><option key={i.id} value={i.id}>{i.descripcionZh||i.descripcion}</option>)}
                    </select>
                    {f.descZh && <div className="text-xs text-blue-600 mt-0.5 px-1">{f.descZh}</div>}
                  </td>
                  <td className="td p-1"><input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.descEs} onChange={e=>actualizarFila(idx,'descEs',e.target.value)}/></td>
                  <td className="td p-1"><input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.modelo} onChange={e=>actualizarFila(idx,'modelo',e.target.value)}/></td>
                  <td className="td p-1"><input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.serie} onChange={e=>actualizarFila(idx,'serie',e.target.value)}/></td>
                  <td className="td p-1"><input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.unidad} onChange={e=>actualizarFila(idx,'unidad',e.target.value)}/></td>
                  <td className="td p-1"><input type="number" min="0" className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 text-center focus:outline-none" value={f.cantidad} onChange={e=>actualizarFila(idx,'cantidad',e.target.value)}/></td>
                  <td className="td p-1"><input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.nota} onChange={e=>actualizarFila(idx,'nota',e.target.value)}/></td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td colSpan={6} className="td text-right font-bold text-xs pr-3">总计 Total:</td>
                <td className="td text-center font-bold text-primary">{total||''}</td>
                <td className="td"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 text-sm text-gray-500">签名区域 / Sección de firmas (aparece en el PDF)</h3>
        <div className="grid grid-cols-3 gap-0 border border-gray-300 rounded-lg overflow-hidden text-xs">
          <div className="p-3 border-r border-gray-300 space-y-3">
            <div><p className="font-bold">申请人签名 / Firma del solicitante:</p><div className="border-b border-gray-400 mt-5"/></div>
            <div><p className="font-bold">区域负责人批准 / Aprobado Por (JEFE DE AREA):</p><div className="border-b border-gray-400 mt-4"/><p className="text-gray-400 text-xs">日 Fecha: 年___ 月___</p></div>
            <div><p className="font-bold">仓库管理层批准 / Aprobado Por (GERENCIA):</p><div className="border-b border-gray-400 mt-4"/><p className="text-gray-400 text-xs">日 Fecha: 年___ 月___</p></div>
          </div>
          <div className="flex items-center justify-center border-r border-gray-300 p-4">
            <div className="w-20 h-20 rounded-full border-2 border-blue-400 flex items-center justify-center text-center text-blue-600 font-bold text-xs leading-tight">全币财审<br/>SELLO DE<br/>ALMACÉN</div>
          </div>
          <div className="p-3 space-y-3">
            <div><p className="font-bold">交付者 / Entregado por:</p><div className="border-b border-gray-400 mt-5"/></div>
            <div><p className="font-bold">接收人 / Recibido Por:</p><div className="border-b border-gray-400 mt-5"/></div>
            <div><p className="font-bold">备注 / Observaciones:</p><div className="border-b border-gray-400 mt-5"/></div>
          </div>
        </div>
        <p className="text-red-500 text-xs mt-2">Nota: Esta solicitud debe tener la aprobación del Gerente o Jefe de área, no debe tener borrones o sobrescrituras.</p>
      </div>
    </div>
  )
}
