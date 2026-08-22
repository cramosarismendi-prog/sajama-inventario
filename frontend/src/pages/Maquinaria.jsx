import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { db, storage } from '../services/firebase'
import { registrarAccion } from '../services/auditoria'
import { traducirAlChino } from '../services/traduccion'
import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { PageLoader } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { Confirm } from '../components/ui/Confirm'
import { Plus, Edit2, Trash2, Truck, Image as ImageIcon, Printer, Loader2, CheckSquare, Square, Languages, Tag } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const UNIDADES = ['Volqueta', 'Excavadora', 'Pala', 'Retroexcavadora', 'Uni', 'Juego', 'Litro', 'Caja', 'Par', 'Kg']

const ESTADOS = [
  { id: 'A la venta',      label: 'A la venta',      color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { id: 'En operación',    label: 'En operación',    color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'En mantenimiento',label: 'En mantenimiento',color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'Vendido',         label: 'Vendido',         color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'Despachado',      label: 'Despachado',      color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { id: 'Entregado',       label: 'Entregado',       color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { id: 'Existente',       label: 'Existente',       color: 'bg-slate-100 text-slate-800 border-slate-300' }
]

// ── Selector de foto individual ──────────────────────────────────────
function CampoFoto({ label, urlActual, archivoSeleccionado, onSeleccionar }) {
  const inputId = 'foto-' + label.replace(/\s+/g, '-')
  const preview = archivoSeleccionado ? URL.createObjectURL(archivoSeleccionado) : urlActual
  return (
    <div>
      <label className="label">{label}</label>
      <div
        onClick={() => document.getElementById(inputId).click()}
        className="w-full h-32 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary cursor-pointer flex items-center justify-center overflow-hidden bg-gray-50 transition-colors relative">
        {preview
          ? <img src={preview} alt={label} className="w-full h-full object-cover"/>
          : <div className="text-center text-gray-400">
              <ImageIcon size={22} className="mx-auto mb-1"/>
              <p className="text-xs">Clic para subir foto</p>
            </div>
        }
      </div>
      <input id={inputId} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files[0]) onSeleccionar(e.target.files[0]) }} />
    </div>
  )
}

// ── Formulario de ficha de máquina ────────────────────────────────────
function FormMaquina({ maquina, onGuardar, onCancelar }) {
  const [nombreEs,  setNombreEs]  = useState(maquina?.nombreEs || '')
  const [nombreZh,  setNombreZh]  = useState(maquina?.nombreZh || '')
  const [modelo,    setModelo]    = useState(maquina?.modelo || '')
  const [serie,     setSerie]     = useState(maquina?.serie || '') // Chasis / Placa
  const [precio,    setPrecio]    = useState(maquina?.precio ?? '')
  const [unidad,    setUnidad]    = useState(maquina?.unidad || 'Volqueta')
  const [estado,    setEstado]    = useState(maquina?.estado || 'A la venta')
  const [fecha,     setFecha]     = useState(maquina?.fecha || format(new Date(), 'yyyy-MM-dd'))
  const [observaciones, setObservaciones] = useState(maquina?.observaciones || '')
  const [fotoMaquina, setFotoMaquina] = useState(null)
  const [fotoPlaca,   setFotoPlaca]   = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [traduciendo, setTraduciendo] = useState(false)
  const [error, setError] = useState('')
  const timerRef = useRef(null)

  const handleNombreEsChange = (e) => {
    const val = e.target.value
    setNombreEs(val)
    clearTimeout(timerRef.current)
    if (val.trim().length < 2) return
    timerRef.current = setTimeout(async () => {
      setTraduciendo(true)
      try {
        const zh = await traducirAlChino(val)
        if (zh) setNombreZh(zh)
      } finally { setTraduciendo(false) }
    }, 700)
  }

  const handleTraducirManual = async () => {
    if (!nombreEs.trim()) return
    setTraduciendo(true)
    try {
      const zh = await traducirAlChino(nombreEs)
      if (zh) setNombreZh(zh)
    } finally { setTraduciendo(false) }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!nombreEs.trim()) { setError('El nombre en español es requerido'); return }
    setGuardando(true)
    try {
      await onGuardar({
        nombreEs: nombreEs.trim(), nombreZh: nombreZh.trim(), modelo: modelo.trim(),
        serie: serie.trim(), precio: Number(precio) || 0, unidad,
        estado, fecha,
        observaciones: observaciones.trim(),
        fotoMaquina, fotoPlaca,
      })
    } finally { setGuardando(false) }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <CampoFoto label="Foto de la máquina" urlActual={maquina?.fotoMaquinaUrl}
          archivoSeleccionado={fotoMaquina} onSeleccionar={setFotoMaquina} />
        <CampoFoto label="Foto de la placa / serie" urlActual={maquina?.fotoPlacaUrl}
          archivoSeleccionado={fotoPlaca} onSeleccionar={setFotoPlaca} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Nombre en Español *</label>
          <input className="input" value={nombreEs} onChange={handleNombreEsChange}
            placeholder="Ej: Excavadora CAT" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label">
              Nombre en Chino {traduciendo && <span className="text-xs text-primary font-normal">(traduciendo...)</span>}
            </label>
            <button type="button" onClick={handleTraducirManual} className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1">
              <Languages size={12}/> Traducir
            </button>
          </div>
          <input className="input" value={nombreZh} onChange={e => setNombreZh(e.target.value)}
            placeholder="Ej: 卡特挖掘机" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Modelo</label>
          <input className="input" value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Ej: 336D" />
        </div>
        <div>
          <label className="label">Chasis / Placa</label>
          <input className="input" value={serie} onChange={e => setSerie(e.target.value)} placeholder="Ej: CAT0336DVHBK10311" />
        </div>
        <div>
          <label className="label">Unidad</label>
          <select className="input" value={unidad} onChange={e => setUnidad(e.target.value)}>
            {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Estado</label>
          <select className="input" value={estado} onChange={e => setEstado(e.target.value)}>
            {ESTADOS.map(est => <option key={est.id} value={est.id}>{est.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Precio Unitario (Bs)</label>
          <input className="input" type="number" min="0" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="label">Fecha</label>
          <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Observaciones</label>
        <textarea className="input resize-none" rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)} />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancelar} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={guardando} className="btn-primary">
          {guardando ? <><Loader2 size={14} className="animate-spin inline mr-1"/> Guardando...</> : maquina ? 'Actualizar' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

// ── Formulario de datos de transporte (previo a imprimir) ─────────────
function FormTransporte({ maquinasSeleccionadas, onImprimir, onCancelar }) {
  const [placaCamion, setPlacaCamion] = useState('')
  const [conductorNombre, setConductorNombre] = useState('')
  const [conductorTelefono, setConductorTelefono] = useState('')
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [enviaNombre, setEnviaNombre] = useState('')
  const [enviaTelefono, setEnviaTelefono] = useState('')
  const [destino, setDestino] = useState('')
  const [descripcionCargos, setDescripcionCargos] = useState('')
  const [clienteFirma, setClienteFirma] = useState('')

  const montoTotal = maquinasSeleccionadas.reduce((a, m) => a + (Number(m.precio) || 0), 0)

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 rounded-lg p-3 text-sm text-primary">
        {maquinasSeleccionadas.length} máquina(s) seleccionada(s) — Monto total: {montoTotal.toLocaleString()} Bs
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="label">Placa de Camión</label>
          <input className="input" value={placaCamion} onChange={e => setPlacaCamion(e.target.value)} placeholder="Ej: 2342-KZR" /></div>
        <div><label className="label">Fecha</label>
          <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
        <div><label className="label">Nombre del conductor</label>
          <input className="input" value={conductorNombre} onChange={e => setConductorNombre(e.target.value)} /></div>
        <div><label className="label">Teléfono del conductor</label>
          <input className="input" value={conductorTelefono} onChange={e => setConductorTelefono(e.target.value)} /></div>
        <div><label className="label">Nombre de quien envía (SAJAMA)</label>
          <input className="input" value={enviaNombre} onChange={e => setEnviaNombre(e.target.value)} /></div>
        <div><label className="label">Teléfono de quien envía</label>
          <input className="input" value={enviaTelefono} onChange={e => setEnviaTelefono(e.target.value)} /></div>
        <div><label className="label">Destino</label>
          <input className="input" value={destino} onChange={e => setDestino(e.target.value)} /></div>
        <div><label className="label">Firma de Cliente / Recibido</label>
          <input className="input" value={clienteFirma} onChange={e => setClienteFirma(e.target.value)} /></div>
      </div>
      <div>
        <label className="label">Descripción de cargos</label>
        <textarea className="input resize-none" rows={2} value={descripcionCargos} onChange={e => setDescripcionCargos(e.target.value)} />
      </div>
      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button onClick={onCancelar} className="btn-secondary">Cancelar</button>
        <button onClick={() => onImprimir({
          placaCamion, conductorNombre, conductorTelefono, fecha,
          enviaNombre, enviaTelefono, destino, descripcionCargos, clienteFirma,
        })} className="btn-primary">
          <Printer size={14} className="inline mr-1"/> Generar e Imprimir
        </button>
      </div>
    </div>
  )
}

// ── Impresión del formulario de transporte bilingüe con fotos (A4 Horizontal) ──
function imprimirFormularioTransporte(maquinas, datosTransporte) {
  const fechaFmt = datosTransporte.fecha ? format(new Date(datosTransporte.fecha + 'T00:00:00'), 'dd/MM/yyyy') : ''
  const montoTotal = maquinas.reduce((a, m) => a + (Number(m.precio) || 0), 0)

  const filasHTML = maquinas.map((m, i) => `
    <tr>
      <td style="text-align:center;border:1px solid #777;padding:5px">${i + 1}</td>
      <td style="border:1px solid #777;padding:5px;font-weight:600">${m.nombreZh || ''}</td>
      <td style="border:1px solid #777;padding:5px;font-weight:600">${m.nombreEs || ''}</td>
      <td style="border:1px solid #777;padding:5px">${m.modelo || ''}</td>
      <td style="border:1px solid #777;padding:5px;font-family:monospace;font-weight:bold">${m.serie || ''}</td>
      <td style="text-align:right;border:1px solid #777;padding:5px">${m.precio ? Number(m.precio).toLocaleString() : ''}</td>
      <td style="text-align:center;border:1px solid #777;padding:5px">${m.unidad || 'Volqueta'}</td>
      <td style="text-align:center;border:1px solid #777;padding:5px;font-weight:bold">1</td>
      <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold">${m.precio ? Number(m.precio).toLocaleString() : ''}</td>
      <td style="border:1px solid #777;padding:5px;font-size:7.5pt">${m.observaciones || ''}</td>
    </tr>`).join('')

  const fotosHTML = maquinas.map(m => {
    if (!m.fotoMaquinaUrl && !m.fotoPlacaUrl) return ''
    return `
      <div class="seccion-fotos">
        ${m.fotoMaquinaUrl ? `
          <div class="foto-card">
            <div class="foto-titulo">设备照片 / FOTO DE LA MÁQUINA</div>
            <img src="${m.fotoMaquinaUrl}" class="foto-img" alt="Foto Maquina"/>
          </div>
        ` : ''}
        ${m.fotoPlacaUrl ? `
          <div class="foto-card">
            <div class="foto-titulo">铭牌/底盘照片 / FOTO DE CHASIS Y PLACA</div>
            <img src="${m.fotoPlacaUrl}" class="foto-img" alt="Foto Chasis y Placa"/>
          </div>
        ` : ''}
      </div>
    `
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Formulario de Transporte - SAJAMA</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans SC','Microsoft YaHei',Arial,sans-serif; font-size:8.5pt; color:#111; padding:6mm 8mm; }
.header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; border-bottom:2px solid #1a3c6e; padding-bottom:6px; }
.logo { font-size:16pt; font-weight:900; color:#1a3c6e; letter-spacing:0.5px; }
.htxt { flex:1; text-align:center; }
.titzh { font-size:13pt; font-weight:700; line-height:1.2; }
.tites { font-size:9pt; color:#1a3c6e; font-weight:600; margin-top:2px; }

table { width:100%; border-collapse:collapse; margin-bottom:6px; font-size:8pt; }
th { background:#e2e8f0; border:1px solid #666; padding:4px 3px; text-align:center; font-weight:700; line-height:1.3; font-size:7.5pt; }
td { border:1px solid #777; padding:4px 5px; }
.total-row td { font-weight:700; background:#f1f5f9; }

.seccion-fotos { display:flex; gap:12px; justify-content:center; align-items:stretch; margin:8px 0; border:1.5px solid #666; padding:8px; background:#fff; border-radius:4px; page-break-inside:avoid; }
.foto-card { flex:1; text-align:center; display:flex; flex-direction:column; align-items:center; }
.foto-titulo { font-size:8pt; font-weight:bold; color:#1a3c6e; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.3px; }
.foto-img { width:100%; height:230px; object-fit:contain; border:1px solid #888; background:#fafafa; border-radius:3px; }

.datos { border:1.5px solid #666; margin-top:6px; font-size:8pt; }
.fila-datos { display:flex; border-bottom:1px solid #666; }
.fila-datos:last-child { border-bottom:none; }
.celda-dato { flex:1; padding:5px 8px; border-right:1px solid #666; min-height:36px; }
.celda-dato:last-child { border-right:none; }
.celda-dato b { display:block; font-size:7.5pt; color:#333; margin-bottom:2px; font-weight:700; }
.celda-valor { font-size:8.5pt; color:#000; }

@page { size:A4 landscape; margin:8mm 8mm; }
@media print {
  body { padding:0; }
  .seccion-fotos { page-break-inside:avoid; }
}
</style></head><body>
<div class="header">
  <div class="logo">Sajama.SRL</div>
  <div class="htxt">
    <div class="titzh">SAJAMA 公司物资设备运输确认单</div>
    <div class="tites">Formulario de Confirmación de Transporte de Materiales y Equipos de SAJAMA</div>
  </div>
</div>

<table>
  <thead><tr>
    <th style="width:4%">序号<br/>No.</th>
    <th style="width:14%">名称<br/>Nombre en Chino</th>
    <th style="width:15%">西语名称<br/>Nombre en Español</th>
    <th style="width:10%">型号<br/>Modelo</th>
    <th style="width:15%">底盘/车牌号<br/>Chasis / Placa</th>
    <th style="width:9%">单价(Bs)<br/>Precio Unitario</th>
    <th style="width:5%">单位<br/>Unidad</th>
    <th style="width:5%">数量<br/>Cantidad</th>
    <th style="width:9%">总价(Bs)<br/>Monto total</th>
    <th style="width:14%">备注<br/>Observaciones</th>
  </tr></thead>
  <tbody>
    ${filasHTML}
    <tr class="total-row">
      <td colspan="8" style="text-align:right;padding-right:8px;font-size:8.5pt">总价值 (Bs) Monto total:</td>
      <td colspan="2" style="text-align:right;font-size:9pt;font-weight:bold;padding-right:8px">${montoTotal.toLocaleString()} Bs</td>
    </tr>
  </tbody>
</table>

${fotosHTML}

<div class="datos">
  <div class="fila-datos">
    <div class="celda-dato"><b>运输车辆车牌号 Placa de Camión</b><span class="celda-valor">${datosTransporte.placaCamion || ''}</span></div>
    <div class="celda-dato"><b>运输司机姓名 Nombre y firma (Conductor)</b><span class="celda-valor">${datosTransporte.conductorNombre || ''}</span></div>
    <div class="celda-dato"><b>司机电话 Teléfono</b><span class="celda-valor">${datosTransporte.conductorTelefono || ''}</span></div>
    <div class="celda-dato"><b>日期 Fecha</b><span class="celda-valor">${fechaFmt}</span></div>
  </div>
  <div class="fila-datos">
    <div class="celda-dato"><b>SAJAMA 公司发货人/签字 Nombre y teléfono (Envía)</b><span class="celda-valor">${datosTransporte.enviaNombre || ''} ${datosTransporte.enviaTelefono ? '· ' + datosTransporte.enviaTelefono : ''}</span></div>
    <div class="celda-dato" style="flex:2"><b>目的地 Destino</b><span class="celda-valor">${datosTransporte.destino || ''}</span></div>
  </div>
  <div class="fila-datos">
    <div class="celda-dato" style="flex:2"><b>送货描述 Descripción de cargos</b><span class="celda-valor">${datosTransporte.descripcionCargos || ''}</span></div>
    <div class="celda-dato"><b>买货甲方签字 Firma de Cliente/Recibido</b><span class="celda-valor">${datosTransporte.clienteFirma || ''}</span></div>
  </div>
</div>

<script>
window.onload = () => {
  const images = document.querySelectorAll('img');
  let loaded = 0;
  if (images.length === 0) {
    setTimeout(() => window.print(), 300);
    return;
  }
  const checkDone = () => {
    loaded++;
    if (loaded >= images.length) {
      setTimeout(() => window.print(), 400);
    }
  };
  images.forEach(img => {
    if (img.complete) {
      checkDone();
    } else {
      img.onload = checkDone;
      img.onerror = checkDone;
    }
  });
  setTimeout(() => window.print(), 2000);
};
<\/script>
</body></html>`

  const w = window.open('', '_blank', 'width=1100,height=800')
  w.document.write(html)
  w.document.close()
}

// ── Impresión de Planilla General de Maquinaria (A4 Horizontal por defecto) ──
function imprimirPlanillaMaquinaria(maquinas) {
  const montoTotal = maquinas.reduce((a, m) => a + (Number(m.precio) || 0), 0)
  const fechaHoy = format(new Date(), 'dd/MM/yyyy')

  const filasHTML = maquinas.map((m, i) => {
    const fechaFmt = m.fecha ? format(new Date(m.fecha + 'T00:00:00'), 'dd/MM/yyyy') : (m.creadoEn?.toDate ? format(m.creadoEn.toDate(), 'dd/MM/yyyy') : '—')
    return `
      <tr>
        <td style="text-align:center;border:1px solid #777;padding:5px">${i + 1}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:600">${m.nombreEs || ''}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:600">${m.nombreZh || '—'}</td>
        <td style="border:1px solid #777;padding:5px">${m.modelo || '—'}</td>
        <td style="border:1px solid #777;padding:5px;font-family:monospace;font-weight:bold">${m.serie || '—'}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px">${m.precio ? Number(m.precio).toLocaleString() + ' Bs' : '—'}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px">${m.unidad || '—'}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px"><span class="badge">${m.estado || 'A la venta'}</span></td>
        <td style="text-align:center;border:1px solid #777;padding:5px">${fechaFmt}</td>
      </tr>
    `
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Planilla de Maquinaria - SAJAMA</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans SC','Microsoft YaHei',Arial,sans-serif; font-size:8.5pt; color:#111; padding:6mm 8mm; }
.header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; border-bottom:2px solid #1a3c6e; padding-bottom:6px; }
.logo { font-size:16pt; font-weight:900; color:#1a3c6e; }
.htxt { flex:1; text-align:center; }
.titzh { font-size:14pt; font-weight:700; }
.tites { font-size:10pt; color:#1a3c6e; font-weight:600; margin-top:2px; }

table { width:100%; border-collapse:collapse; margin-top:8px; font-size:8pt; }
th { background:#e2e8f0; border:1px solid #555; padding:5px 4px; text-align:center; font-weight:700; line-height:1.2; font-size:8pt; }
td { border:1px solid #777; padding:4px 6px; }
.total-row td { font-weight:700; background:#f1f5f9; }
.badge { display:inline-block; padding:2px 6px; border-radius:4px; font-size:7.5pt; font-weight:bold; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; }

@page { size:A4 landscape; margin:8mm 8mm; }
@media print { body { padding:0; } }
</style></head><body>
<div class="header">
  <div class="logo">Sajama.SRL</div>
  <div class="htxt">
    <div class="titzh">SAJAMA 公司工程机械设备清单</div>
    <div class="tites">Planilla de Control de Maquinaria y Equipos Pesados - SAJAMA</div>
  </div>
  <div style="font-size:8pt;text-align:right;color:#555">Fecha de impresión:<br/><b>${fechaHoy}</b></div>
</div>

<table>
  <thead><tr>
    <th style="width:4%">No.</th>
    <th style="width:18%">Nombre (ES)</th>
    <th style="width:16%">中文名称</th>
    <th style="width:12%">Modelo</th>
    <th style="width:16%">Chasis / Placa</th>
    <th style="width:12%">Precio (Bs)</th>
    <th style="width:8%">Unidad</th>
    <th style="width:8%">Estado</th>
    <th style="width:6%">Fecha</th>
  </tr></thead>
  <tbody>
    ${filasHTML}
    <tr class="total-row">
      <td colspan="5" style="text-align:right;padding-right:8px;font-size:8.5pt">Total acumulado (${maquinas.length} ítems):</td>
      <td style="text-align:right;font-size:9pt;font-weight:bold;padding-right:6px">${montoTotal.toLocaleString()} Bs</td>
      <td colspan="3"></td>
    </tr>
  </tbody>
</table>

<script>
window.onload = () => { setTimeout(() => window.print(), 300); };
<\/script>
</body></html>`

  const w = window.open('', '_blank', 'width=1100,height=800')
  w.document.write(html)
  w.document.close()
}

// ── Página principal ──────────────────────────────────────────────────
export default function Maquinaria() {
  const { perfil } = useAuth()
  const [maquinas, setMaquinas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [delMaquina, setDelMaquina] = useState(null)
  const [seleccionadas, setSeleccionadas] = useState(new Set())
  const [modalTransporte, setModalTransporte] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'maquinaria'), orderBy('creadoEn', 'desc')),
      snap => {
        setMaquinas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        console.error('ERROR en onSnapshot Maquinaria:', err.code, err.message)
        toast.error('Error cargando maquinaria: ' + err.message)
        setLoading(false)
      }
    )
    return unsub
  }, [])

  const canEdit = ['administrador', 'gerencia', 'almacenero'].includes(perfil?.rol)
  const canDelete = perfil?.rol === 'administrador'

  const subirFoto = async (id, tipo, file) => {
    const path = `maquinaria/${id}/${tipo}-${Date.now()}-${file.name}`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file)
    return await getDownloadURL(storageRef)
  }

  const handleGuardar = async (data) => {
    try {
      const esNuevo = !editando
      const docRef = esNuevo ? doc(collection(db, 'maquinaria')) : doc(db, 'maquinaria', editando.id)

      const payload = {
        nombreEs: data.nombreEs, nombreZh: data.nombreZh, modelo: data.modelo,
        serie: data.serie, precio: data.precio, unidad: data.unidad,
        estado: data.estado, fecha: data.fecha,
        observaciones: data.observaciones,
      }

      if (data.fotoMaquina) payload.fotoMaquinaUrl = await subirFoto(docRef.id, 'maquina', data.fotoMaquina)
      if (data.fotoPlaca)   payload.fotoPlacaUrl   = await subirFoto(docRef.id, 'placa', data.fotoPlaca)

      if (esNuevo) {
        await setDoc(docRef, { ...payload, creadoPor: perfil?.nombre, creadoEn: serverTimestamp() })
        await registrarAccion({ usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Maquinaria', accion: 'CREAR',
          detalle: `Registró máquina: ${payload.nombreEs}` })
        toast.success('Máquina registrada correctamente')
      } else {
        await updateDoc(docRef, { ...payload, actualizadoPor: perfil?.nombre, actualizadoEn: serverTimestamp() })
        await registrarAccion({ usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Maquinaria', accion: 'EDITAR',
          detalle: `Editó máquina: ${payload.nombreEs}` })
        toast.success('Máquina actualizada correctamente')
      }
      setModal(false); setEditando(null)
    } catch (e) { toast.error('Error al guardar: ' + e.message) }
  }

  const handleEliminar = async () => {
    try {
      await deleteDoc(doc(db, 'maquinaria', delMaquina.id))
      await registrarAccion({ usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Maquinaria', accion: 'ELIMINAR',
        detalle: `Eliminó máquina: ${delMaquina.nombreEs}` })
      toast.success('Máquina eliminada')
      setDelMaquina(null)
      setSeleccionadas(prev => { const n = new Set(prev); n.delete(delMaquina.id); return n })
    } catch (e) { toast.error('Error al eliminar: ' + e.message) }
  }

  const toggleSeleccion = (id) => {
    setSeleccionadas(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const maquinasSeleccionadas = maquinas.filter(m => seleccionadas.has(m.id))

  const handleImprimirTransporte = (datosTransporte) => {
    imprimirFormularioTransporte(maquinasSeleccionadas, datosTransporte)
    setModalTransporte(false)
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="flex items-center gap-2">
            <Truck size={22} className="text-primary"/> Maquinaria
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {maquinas.length} máquina(s) registradas — {seleccionadas.size} seleccionada(s)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => imprimirPlanillaMaquinaria(maquinas)} className="btn-secondary btn-sm flex items-center gap-1.5">
            <Printer size={14}/> Imprimir Planilla
          </button>
          {seleccionadas.size > 0 && (
            <button onClick={() => setModalTransporte(true)} className="btn-primary btn-sm">
              <Printer size={14}/> Formulario de Transporte ({seleccionadas.size})
            </button>
          )}
          {canEdit && (
            <button onClick={() => { setEditando(null); setModal(true) }} className="btn-primary btn-sm">
              <Plus size={14}/> Nueva máquina
            </button>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {maquinas.length === 0 ? <EmptyState mensaje="No hay máquinas registradas"/> : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full min-w-[750px]">
              <thead><tr>
                <th className="th w-10"></th>
                <th className="th w-14">Foto</th>
                <th className="th">Nombre (ES)</th>
                <th className="th">中文名称</th>
                <th className="th">Modelo</th>
                <th className="th">Chasis / Placa</th>
                <th className="th">Precio (Bs)</th>
                <th className="th">Unidad</th>
                <th className="th">Estado</th>
                <th className="th">Fecha</th>
                {canEdit && <th className="th">Acciones</th>}
              </tr></thead>
              <tbody>
                {maquinas.map(m => {
                  const estObj = ESTADOS.find(e => e.id === m.estado) || ESTADOS[0]
                  const fechaFmt = m.fecha ? format(new Date(m.fecha + 'T00:00:00'), 'dd/MM/yyyy') : (m.creadoEn?.toDate ? format(m.creadoEn.toDate(), 'dd/MM/yyyy') : '—')
                  return (
                    <tr key={m.id} className={`tr-hover ${seleccionadas.has(m.id) ? 'bg-primary-pale' : ''}`}>
                      <td className="td">
                        <button onClick={() => toggleSeleccion(m.id)} className="text-primary">
                          {seleccionadas.has(m.id) ? <CheckSquare size={18}/> : <Square size={18} className="text-gray-300"/>}
                        </button>
                      </td>
                      <td className="td">
                        {m.fotoMaquinaUrl
                          ? <img src={m.fotoMaquinaUrl} alt="foto" className="w-10 h-10 rounded-lg object-cover border border-gray-200"/>
                          : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><ImageIcon size={16} className="text-gray-300"/></div>
                        }
                      </td>
                      <td className="td font-medium">{m.nombreEs}</td>
                      <td className="td text-gray-600">{m.nombreZh || '—'}</td>
                      <td className="td text-gray-500 text-sm">{m.modelo || '—'}</td>
                      <td className="td text-gray-500 text-xs font-mono font-bold">{m.serie || '—'}</td>
                      <td className="td">{m.precio ? `${Number(m.precio).toLocaleString()} Bs` : '—'}</td>
                      <td className="td text-gray-500 text-sm">{m.unidad || '—'}</td>
                      <td className="td">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${estObj.color}`}>
                          <Tag size={11}/> {m.estado || 'A la venta'}
                        </span>
                      </td>
                      <td className="td text-gray-500 text-xs">{fechaFmt}</td>
                      {canEdit && (
                        <td className="td">
                          <div className="flex gap-1.5">
                            <button onClick={() => { setEditando(m); setModal(true) }}
                              className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors" title="Editar">
                              <Edit2 size={14}/>
                            </button>
                            {canDelete && (
                              <button onClick={() => setDelMaquina(m)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Eliminar">
                                <Trash2 size={14}/>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => { setModal(false); setEditando(null) }}
        title={editando ? 'Editar máquina' : 'Nueva máquina'} size="md">
        <FormMaquina maquina={editando} onGuardar={handleGuardar}
          onCancelar={() => { setModal(false); setEditando(null) }} />
      </Modal>

      <Modal open={modalTransporte} onClose={() => setModalTransporte(false)}
        title="Formulario de Confirmación de Transporte" size="lg">
        <FormTransporte maquinasSeleccionadas={maquinasSeleccionadas}
          onImprimir={handleImprimirTransporte} onCancelar={() => setModalTransporte(false)} />
      </Modal>

      <Confirm open={!!delMaquina}
        mensaje={`¿Eliminar la máquina "${delMaquina?.nombreEs}"? Esta acción no se puede deshacer.`}
        onConfirm={handleEliminar} onCancel={() => setDelMaquina(null)} />
    </div>
  )
}

