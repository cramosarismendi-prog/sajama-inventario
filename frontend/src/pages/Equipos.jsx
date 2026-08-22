import { useState, useEffect, useRef } from 'react'
import {
  collection, query, orderBy, onSnapshot, doc,
  setDoc, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { registrarAccion } from '../services/auditoria'
import { traducirAlChino } from '../services/traduccion'
import { PageLoader } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'
import {
  HardHat, Plus, Search, FileText, Trash2, Edit3,
  ExternalLink, Paperclip, CheckCircle2, Tag, AlertCircle, Languages,
  Printer, Image as ImageIcon
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const ESTADOS = [
  { id: 'A la venta',  label: 'A la venta',  color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { id: 'Vendido',     label: 'Vendido',     color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'Despachado',  label: 'Despachado',  color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'Entregado',   label: 'Entregado',   color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'Existente',   label: 'Existente',   color: 'bg-slate-100 text-slate-800 border-slate-300' }
]

// ── Selector de foto individual para Equipos ─────────────────────────
function CampoFoto({ label, urlActual, archivoSeleccionado, onSeleccionar }) {
  const inputId = 'foto-eq-' + label.replace(/\s+/g, '-')
  const preview = archivoSeleccionado ? URL.createObjectURL(archivoSeleccionado) : urlActual
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div
        onClick={() => document.getElementById(inputId).click()}
        className="w-full h-28 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary cursor-pointer flex items-center justify-center overflow-hidden bg-gray-50 transition-colors relative">
        {preview
          ? <img src={preview} alt={label} className="w-full h-full object-cover"/>
          : <div className="text-center text-gray-400">
              <ImageIcon size={20} className="mx-auto mb-1"/>
              <p className="text-[11px]">Clic para subir foto</p>
            </div>
        }
      </div>
      <input id={inputId} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files[0]) onSeleccionar(e.target.files[0]) }} />
    </div>
  )
}

// ── Impresión de Planilla General de Equipos (A4 Horizontal por defecto) ──
function imprimirPlanillaEquipos(equipos) {
  const montoTotal = equipos.reduce((a, eq) => a + (Number(eq.precio) || 0), 0)
  const fechaHoy = format(new Date(), 'dd/MM/yyyy')

  const filasHTML = equipos.map((eq, i) => {
    const fechaFmt = eq.fecha ? format(new Date(eq.fecha + 'T00:00:00'), 'dd/MM/yyyy') : (eq.creadoEn?.toDate ? format(eq.creadoEn.toDate(), 'dd/MM/yyyy') : '—')
    return `
      <tr>
        <td style="text-align:center;border:1px solid #777;padding:5px">${i + 1}</td>
        <td style="border:1px solid #777;padding:5px">
          <div style="font-weight:bold;color:#111">${eq.nombreEs || ''}</div>
          ${eq.nombreZh ? `<div style="font-size:7.5pt;color:#555">${eq.nombreZh}</div>` : ''}
        </td>
        <td style="border:1px solid #777;padding:5px">
          <div>Mod: <b>${eq.modelo || '—'}</b></div>
          <div style="font-size:7.5pt;color:#555">Serie: <b>${eq.serie || '—'}</b></div>
        </td>
        <td style="text-align:center;border:1px solid #777;padding:5px">
          <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:7.5pt;font-weight:bold;background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd">${eq.estado || 'A la venta'}</span>
        </td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold">${eq.precio ? '$' + Number(eq.precio).toLocaleString() + ' USD' : '—'}</td>
        <td style="border:1px solid #777;padding:5px;font-size:7.5pt">
          ${eq.polizaUrl ? '📄 Póliza adjunta' : 'Sin póliza'}
          ${eq.numPoliza ? `<br/><b>N°: ${eq.numPoliza}</b>` : ''}
        </td>
        <td style="text-align:center;border:1px solid #777;padding:5px">${fechaFmt}</td>
      </tr>
    `
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Planilla de Equipos - SAJAMA</title>
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

@page { size:A4 landscape; margin:8mm 8mm; }
@media print { body { padding:0; } }
</style></head><body>
<div class="header">
  <div class="logo">Sajama.SRL</div>
  <div class="htxt">
    <div class="titzh">SAJAMA 公司设备清单</div>
    <div class="tites">Planilla de Control de Equipos - SAJAMA</div>
  </div>
  <div style="font-size:8pt;text-align:right;color:#555">Fecha de impresión:<br/><b>${fechaHoy}</b></div>
</div>

<table>
  <thead><tr>
    <th style="width:4%">No.</th>
    <th style="width:24%">Equipo / Nombre</th>
    <th style="width:18%">Modelo / Serie</th>
    <th style="width:12%">Estado</th>
    <th style="width:14%">Precio</th>
    <th style="width:18%">Póliza PDF</th>
    <th style="width:10%">Fecha</th>
  </tr></thead>
  <tbody>
    ${filasHTML}
    <tr class="total-row">
      <td colspan="4" style="text-align:right;padding-right:8px;font-size:8.5pt">Total acumulado (${equipos.length} ítems):</td>
      <td style="text-align:right;font-size:9pt;font-weight:bold;padding-right:6px">$${montoTotal.toLocaleString()} USD</td>
      <td colspan="2"></td>
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

export default function Equipos() {
  const { perfil } = useAuth()
  const [equipos, setEquipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [tab, setTab] = useState('a_la_venta') // 'a_la_venta', 'vendidos_despachados', 'todos'

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [delEquipo, setDelEquipo] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [traduciendo, setTraduciendo] = useState(false)
  const timerRef = useRef(null)

  const handleNombreEsChange = (e) => {
    const val = e.target.value
    setForm(prev => ({ ...prev, nombreEs: val }))
    clearTimeout(timerRef.current)
    if (val.trim().length < 2) return
    timerRef.current = setTimeout(async () => {
      setTraduciendo(true)
      try {
        const zh = await traducirAlChino(val)
        if (zh) setForm(prev => ({ ...prev, nombreZh: zh }))
      } finally { setTraduciendo(false) }
    }, 700)
  }

  const handleTraducirManual = async () => {
    if (!form.nombreEs.trim()) return
    setTraduciendo(true)
    try {
      const zh = await traducirAlChino(form.nombreEs)
      if (zh) setForm(prev => ({ ...prev, nombreZh: zh }))
    } finally { setTraduciendo(false) }
  }

  // Form State
  const [form, setForm] = useState({
    nombreEs: '', nombreZh: '', modelo: '', serie: '',
    categoria: 'Equipos', precio: '', estado: 'A la venta',
    fecha: format(new Date(), 'yyyy-MM-dd'),
    numPoliza: '', observaciones: ''
  })
  const [fotoEquipo, setFotoEquipo] = useState(null)
  const [fotoPlaca, setFotoPlaca] = useState(null)
  const [archivoPdf, setArchivoPdf] = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'equipos'), orderBy('creadoEn', 'desc')),
      snap => {
        setEquipos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      err => {
        console.error('Error cargando equipos:', err)
        toast.error('Error cargando equipos: ' + err.message)
        setLoading(false)
      }
    )
    return unsub
  }, [])

  const canEdit = ['administrador', 'gerencia', 'almacenero'].includes(perfil?.rol)
  const canDelete = perfil?.rol === 'administrador'

  const resetForm = () => {
    setForm({
      nombreEs: '', nombreZh: '', modelo: '', serie: '',
      categoria: 'Equipos', precio: '', estado: 'A la venta',
      fecha: format(new Date(), 'yyyy-MM-dd'),
      numPoliza: '', observaciones: ''
    })
    setFotoEquipo(null)
    setFotoPlaca(null)
    setArchivoPdf(null)
    setEditando(null)
  }

  const handleAbrirEditar = (eq) => {
    setEditando(eq)
    setForm({
      nombreEs: eq.nombreEs || '',
      nombreZh: eq.nombreZh || '',
      modelo: eq.modelo || '',
      serie: eq.serie || '',
      categoria: eq.categoria || 'Equipos',
      precio: eq.precio || '',
      estado: eq.estado || 'A la venta',
      fecha: eq.fecha || format(new Date(), 'yyyy-MM-dd'),
      numPoliza: eq.numPoliza || '',
      observaciones: eq.observaciones || ''
    })
    setFotoEquipo(null)
    setFotoPlaca(null)
    setArchivoPdf(null)
    setModalOpen(true)
  }

  const subirArchivoStorage = async (id, tipo, file) => {
    const path = `equipos/${id}/${tipo}-${Date.now()}-${file.name}`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file)
    return await getDownloadURL(storageRef)
  }

  const handleGuardar = async (e) => {
    e.preventDefault()
    if (!form.nombreEs.trim()) {
      return toast.error('El nombre del equipo es obligatorio')
    }

    setGuardando(true)
    try {
      const esNuevo = !editando
      const docRef = esNuevo ? doc(collection(db, 'equipos')) : doc(db, 'equipos', editando.id)

      let polizaUrl = editando?.polizaUrl || ''
      let polizaNombre = editando?.polizaNombre || ''
      let fotoEquipoUrl = editando?.fotoEquipoUrl || ''
      let fotoPlacaUrl = editando?.fotoPlacaUrl || ''

      if (archivoPdf) {
        polizaUrl = await subirArchivoStorage(docRef.id, 'poliza', archivoPdf)
        polizaNombre = archivoPdf.name
      }
      if (fotoEquipo) {
        fotoEquipoUrl = await subirArchivoStorage(docRef.id, 'equipo', fotoEquipo)
      }
      if (fotoPlaca) {
        fotoPlacaUrl = await subirArchivoStorage(docRef.id, 'placa', fotoPlaca)
      }

      const payload = {
        nombreEs: form.nombreEs.trim(),
        nombreZh: form.nombreZh.trim(),
        modelo: form.modelo.trim(),
        serie: form.serie.trim(),
        categoria: form.categoria,
        precio: parseFloat(form.precio) || 0,
        estado: form.estado,
        fecha: form.fecha,
        numPoliza: form.numPoliza.trim(),
        observaciones: form.observaciones.trim(),
        polizaUrl,
        polizaNombre,
        fotoEquipoUrl,
        fotoPlacaUrl
      }

      if (esNuevo) {
        await setDoc(docRef, {
          ...payload,
          creadoPor: perfil?.nombre || 'Sistema',
          creadoEn: serverTimestamp()
        })
        await registrarAccion({
          usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Equipos',
          accion: 'CREAR', detalle: `Creó equipo: ${payload.nombreEs}`
        })
        toast.success('Equipo registrado correctamente')
      } else {
        await updateDoc(docRef, {
          ...payload,
          actualizadoPor: perfil?.nombre || 'Sistema',
          actualizadoEn: serverTimestamp()
        })
        await registrarAccion({
          usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Equipos',
          accion: 'EDITAR', detalle: `Editó equipo: ${payload.nombreEs}`
        })
        toast.success('Equipo actualizado correctamente')
      }

      setModalOpen(false)
      resetForm()
    } catch (err) {
      console.error(err)
      toast.error('Error al guardar equipo: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminar = async () => {
    if (!delEquipo) return
    try {
      await deleteDoc(doc(db, 'equipos', delEquipo.id))
      await registrarAccion({
        usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Equipos',
        accion: 'ELIMINAR', detalle: `Eliminó equipo: ${delEquipo.nombreEs}`
      })
      toast.success('Equipo eliminado')
      setDelEquipo(null)
    } catch (err) {
      toast.error('Error al eliminar: ' + err.message)
    }
  }

  // Filtrado por Tab y Busqueda
  const equiposFiltrados = equipos.filter(eq => {
    // Filtro Tab
    if (tab === 'a_la_venta' && eq.estado !== 'A la venta') return false
    if (tab === 'vendidos_despachados' && eq.estado === 'A la venta') return false

    // Filtro Búsqueda
    if (!busqueda.trim()) return true
    const q = busqueda.toLowerCase()
    return (
      eq.nombreEs?.toLowerCase().includes(q) ||
      eq.nombreZh?.toLowerCase().includes(q) ||
      eq.modelo?.toLowerCase().includes(q) ||
      eq.serie?.toLowerCase().includes(q) ||
      eq.numPoliza?.toLowerCase().includes(q) ||
      eq.estado?.toLowerCase().includes(q)
    )
  })

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            <HardHat size={26} className="text-primary"/> Módulo de Equipos
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de equipos a la venta, entregados/vendidos y control de pólizas aduaneras
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => imprimirPlanillaEquipos(equiposFiltrados)} className="btn-secondary flex items-center gap-1.5">
            <Printer size={16}/> Imprimir Planilla
          </button>
          {canEdit && (
            <button onClick={() => { resetForm(); setModalOpen(true) }} className="btn-primary flex items-center gap-2">
              <Plus size={16}/> Registrar Equipo
            </button>
          )}
        </div>
      </div>

      {/* Control de Pestañas (Tabs) y Buscador */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-gray-200 pb-3">
        <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl overflow-x-auto max-w-full shrink-0">
          <button
            onClick={() => setTab('a_la_venta')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              tab === 'a_la_venta'
                ? 'bg-white text-emerald-700 shadow-sm font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🏷️ Equipos a la venta ({equipos.filter(e => e.estado === 'A la venta').length})
          </button>
          <button
            onClick={() => setTab('vendidos_despachados')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              tab === 'vendidos_despachados'
                ? 'bg-white text-blue-700 shadow-sm font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📦 Vendidos / Entregados / Existentes ({equipos.filter(e => e.estado !== 'A la venta').length})
          </button>
          <button
            onClick={() => setTab('todos')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              tab === 'todos'
                ? 'bg-white text-gray-900 shadow-sm font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Todos ({equipos.length})
          </button>
        </div>

        <div className="relative min-w-full sm:min-w-[260px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, serie, modelo, póliza..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* Tabla de Equipos */}
      <div className="card p-0 overflow-hidden shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
              <tr>
                <th className="py-3 px-4 w-14">Foto</th>
                <th className="py-3 px-4">Equipo / Nombre</th>
                <th className="py-3 px-4">Modelo / Serie</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Precio</th>
                <th className="py-3 px-4">Póliza PDF</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {equiposFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400">
                    No se encontraron equipos en esta categoría
                  </td>
                </tr>
              ) : (
                equiposFiltrados.map(eq => {
                  const estObj = ESTADOS.find(e => e.id === eq.estado) || ESTADOS[0]
                  const fechaFmt = eq.fecha ? format(new Date(eq.fecha + 'T00:00:00'), 'dd/MM/yyyy') : (eq.creadoEn?.toDate ? format(eq.creadoEn.toDate(), 'dd/MM/yyyy') : '—')
                  return (
                    <tr key={eq.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4">
                        {eq.fotoEquipoUrl ? (
                          <img src={eq.fotoEquipoUrl} alt="foto" className="w-10 h-10 rounded-lg object-cover border border-gray-200"/>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <ImageIcon size={16} className="text-gray-300"/>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{eq.nombreEs}</div>
                        {eq.nombreZh && <div className="text-xs text-gray-400">{eq.nombreZh}</div>}
                        {eq.observaciones && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{eq.observaciones}</p>
                        )}
                      </td>

                      <td className="py-3 px-4 text-gray-600">
                        <div><span className="font-medium text-gray-800">Mod:</span> {eq.modelo || '-'}</div>
                        <div className="text-xs text-gray-500"><span className="font-medium">Serie:</span> {eq.serie || '-'}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${estObj.color}`}>
                          <Tag size={12}/> {eq.estado}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-gray-800">
                        {eq.precio ? `$${eq.precio.toLocaleString()} USD` : '-'}
                      </td>

                      <td className="py-3 px-4">
                        {eq.polizaUrl ? (
                          <a
                            href={eq.polizaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                          >
                            <FileText size={14}/> Ver Póliza PDF <ExternalLink size={12}/>
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Sin póliza</span>
                        )}
                        {eq.numPoliza && (
                          <div className="text-[11px] text-gray-500 mt-0.5">N°: {eq.numPoliza}</div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-xs text-gray-500 font-medium">
                        {fechaFmt}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit && (
                            <button
                              onClick={() => handleAbrirEditar(eq)}
                              className="p-1.5 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                              title="Editar equipo"
                            >
                              <Edit3 size={16}/>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDelEquipo(eq)}
                              className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar equipo"
                            >
                              <Trash2 size={16}/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar Equipo' : 'Nuevo Equipo'} size="lg">
        <form onSubmit={handleGuardar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <CampoFoto label="Foto del equipo" urlActual={editando?.fotoEquipoUrl}
              archivoSeleccionado={fotoEquipo} onSeleccionar={setFotoEquipo} />
            <CampoFoto label="Foto de la placa / serie" urlActual={editando?.fotoPlacaUrl}
              archivoSeleccionado={fotoPlaca} onSeleccionar={setFotoPlaca} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre (Español) *</label>
              <input
                type="text"
                required
                placeholder="Ej. Compresor de Aire Industrial"
                value={form.nombreEs}
                onChange={handleNombreEsChange}
                className="input-field"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-700">
                  Nombre (Chino 中文) {traduciendo && <span className="text-[11px] text-primary font-normal">(traduciendo...)</span>}
                </label>
                <button type="button" onClick={handleTraducirManual} className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1">
                  <Languages size={12}/> Traducir
                </button>
              </div>
              <input
                type="text"
                placeholder="Ej. 工业空压机"
                value={form.nombreZh}
                onChange={e => setForm({ ...form, nombreZh: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Modelo</label>
              <input
                type="text"
                placeholder="Ej. GX-750"
                value={form.modelo}
                onChange={e => setForm({ ...form, modelo: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">N° de Serie</label>
              <input
                type="text"
                placeholder="Ej. SN-2024-889"
                value={form.serie}
                onChange={e => setForm({ ...form, serie: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Precio (USD)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Ej. 4500"
                value={form.precio}
                onChange={e => setForm({ ...form, precio: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Estado del Equipo</label>
              <select
                value={form.estado}
                onChange={e => setForm({ ...form, estado: e.target.value })}
                className="input-field"
              >
                {ESTADOS.map(est => (
                  <option key={est.id} value={est.id}>{est.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">N° de Póliza Aduanera</label>
              <input
                type="text"
                placeholder="Ej. POL-2026-0045"
                value={form.numPoliza}
                onChange={e => setForm({ ...form, numPoliza: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm({ ...form, fecha: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Adjuntar Póliza (PDF)</label>
            <div className="flex items-center gap-3">
              <label className="btn-secondary btn-sm cursor-pointer inline-flex items-center gap-1.5">
                <Paperclip size={14}/> {archivoPdf ? 'Cambiar archivo PDF' : 'Seleccionar PDF'}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files[0]
                    if (f && f.type === 'application/pdf') {
                      setArchivoPdf(f)
                    } else if (f) {
                      toast.error('Solo se permite adjuntar archivos PDF')
                    }
                  }}
                />
              </label>
              {archivoPdf ? (
                <span className="text-xs text-emerald-700 font-medium truncate max-w-[200px]">
                  📄 {archivoPdf.name}
                </span>
              ) : editando?.polizaUrl ? (
                <span className="text-xs text-gray-500 truncate max-w-[200px]">
                  Póliza actual: <a href={editando.polizaUrl} target="_blank" rel="noreferrer" className="text-primary underline">Ver archivo</a>
                </span>
              ) : (
                <span className="text-xs text-gray-400">Ningún PDF seleccionado</span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones / Detalles</label>
            <textarea
              rows={3}
              placeholder="Detalles técnicos, accesorios o notas de entrega..."
              value={form.observaciones}
              onChange={e => setForm({ ...form, observaciones: e.target.value })}
              className="input-field"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn-primary">
              {guardando ? 'Guardando...' : (editando ? 'Actualizar Equipo' : 'Guardar Equipo')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Confirmar Eliminar */}
      <Modal open={!!delEquipo} onClose={() => setDelEquipo(null)} title="Confirmar Eliminación" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            ¿Estás seguro de que deseas eliminar el equipo <strong>{delEquipo?.nombreEs}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setDelEquipo(null)} className="btn-secondary">Cancelar</button>
            <button onClick={handleEliminar} className="btn-primary bg-red-600 hover:bg-red-700">Eliminar</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

