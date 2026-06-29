import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { db } from '../services/firebase'
import { registrarAccion } from '../services/auditoria'
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, increment, onSnapshot, writeBatch
} from 'firebase/firestore'
import { PageLoader } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { Confirm } from '../components/ui/Confirm'
import {
  ShoppingCart, Plus, Edit2, Trash2, Search,
  RefreshCw, Package, TrendingDown, Download, History
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

const CATEGORIAS_COMPRA = [
  'Materiales de oficina',
  'Insumos administrativos',
  'Herramientas',
  'Limpieza e higiene',
  'Otros',
]

const AREAS = [
  'Administración', 'Almacén', 'Gerencia',
  'Taller Mecánico', 'Ventas', 'Contabilidad', 'General',
]

// ── Formulario de artículo ────────────────────────────────────────────
function FormArticulo({ item, onGuardar, onCancelar }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm()
  useEffect(() => {
    if (item) reset(item)
    else reset({ nombre:'', categoria:'Materiales de oficina', unidad:'unidad', stockMin:1, precio:0, notas:'' })
  }, [item, reset])
  return (
    <form onSubmit={handleSubmit(onGuardar)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Nombre del artículo *</label>
          <input className="input" placeholder="Ej: Resma de papel A4"
            {...register('nombre', { required: 'Requerido' })} />
          {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
        </div>
        <div>
          <label className="label">Categoría *</label>
          <select className="input" {...register('categoria', { required: 'Requerido' })}>
            {CATEGORIAS_COMPRA.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Unidad</label>
          <select className="input" {...register('unidad')}>
            {['unidad','caja','paquete','resma','litro','kg','rollo','par','juego'].map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Stock mínimo</label>
          <input className="input" type="number" min="0"
            {...register('stockMin', { valueAsNumber: true })} />
        </div>
        <div>
          <label className="label">Precio unitario (Bs)</label>
          <input className="input" type="number" step="0.01" min="0"
            {...register('precio', { valueAsNumber: true })} />
        </div>
      </div>
      <div>
        <label className="label">Notas</label>
        <textarea className="input resize-none" rows={2} {...register('notas')} />
      </div>
      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancelar} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Guardando...' : item ? 'Actualizar' : 'Crear artículo'}
        </button>
      </div>
    </form>
  )
}

// ── Formulario de compra ──────────────────────────────────────────────
function FormCompra({ articulos, onGuardar, onCancelar }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { fecha: format(new Date(), 'yyyy-MM-dd') }
  })
  const artId = watch('articuloId')
  const artSel = articulos.find(a => a.id === artId)
  return (
    <form onSubmit={handleSubmit(onGuardar)} className="space-y-4">
      <div>
        <label className="label">Artículo *</label>
        <select className="input" {...register('articuloId', { required: 'Selecciona un artículo' })}>
          <option value="">Seleccionar artículo...</option>
          {articulos.map(a => (
            <option key={a.id} value={a.id}>
              {a.nombre} — {a.categoria} (Stock: {a.stock ?? 0} {a.unidad})
            </option>
          ))}
        </select>
        {errors.articuloId && <p className="text-red-500 text-xs mt-1">{errors.articuloId.message}</p>}
      </div>
      {artSel && (
        <div className="bg-primary-pale rounded-lg p-3 text-sm text-primary">
          <b>{artSel.nombre}</b> · {artSel.categoria} · Stock actual: <b>{artSel.stock ?? 0} {artSel.unidad}</b>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Cantidad *</label>
          <input className="input" type="number" min="1"
            {...register('cantidad', { required: 'Requerido', min: 1, valueAsNumber: true })} />
          {errors.cantidad && <p className="text-red-500 text-xs mt-1">{errors.cantidad.message}</p>}
        </div>
        <div>
          <label className="label">Precio unitario (Bs)</label>
          <input className="input" type="number" step="0.01" min="0"
            defaultValue={artSel?.precio || 0}
            {...register('precioUnitario', { valueAsNumber: true })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Proveedor</label>
          <input className="input" placeholder="Nombre del proveedor" {...register('proveedor')} />
        </div>
        <div>
          <label className="label">Fecha</label>
          <input className="input" type="date" {...register('fecha')} />
        </div>
      </div>
      <div>
        <label className="label">Asignado a (persona o área)</label>
        <select className="input" {...register('asignadoA')}>
          <option value="">Sin asignación específica</option>
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Observaciones</label>
        <textarea className="input resize-none" rows={2} {...register('observaciones')} />
      </div>
      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancelar} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Registrando...' : 'Registrar compra'}
        </button>
      </div>
    </form>
  )
}

// ── Formulario de salida/asignación ──────────────────────────────────
function FormSalida({ articulo, onGuardar, onCancelar }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()
  return (
    <form onSubmit={handleSubmit(onGuardar)} className="space-y-4">
      <div className="bg-warning-pale rounded-lg p-3 text-sm text-warning">
        <b>{articulo?.nombre}</b> · Stock disponible: <b>{articulo?.stock ?? 0} {articulo?.unidad}</b>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Cantidad *</label>
          <input className="input" type="number" min="1" max={articulo?.stock}
            {...register('cantidad', { required: 'Requerido', min: 1, valueAsNumber: true })} />
          {errors.cantidad && <p className="text-red-500 text-xs mt-1">{errors.cantidad.message}</p>}
        </div>
        <div>
          <label className="label">Asignado a *</label>
          <select className="input" {...register('asignadoA', { required: 'Requerido' })}>
            <option value="">Seleccionar...</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {errors.asignadoA && <p className="text-red-500 text-xs mt-1">{errors.asignadoA.message}</p>}
        </div>
      </div>
      <div>
        <label className="label">Persona responsable</label>
        <input className="input" placeholder="Nombre de quien recibe" {...register('persona')} />
      </div>
      <div>
        <label className="label">Observaciones</label>
        <textarea className="input resize-none" rows={2} {...register('observaciones')} />
      </div>
      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancelar} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={isSubmitting} className="btn-warning">
          {isSubmitting ? 'Registrando...' : 'Confirmar asignación'}
        </button>
      </div>
    </form>
  )
}

// ── Página principal ──────────────────────────────────────────────────
export default function Compras() {
  const { perfil } = useAuth()
  const [articulos,    setArticulos]    = useState([])
  const [movimientos,  setMovimientos]  = useState([])
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState('catalogo') // catalogo | compras | asignaciones
  const [busqueda,     setBusqueda]     = useState('')
  const [catFiltro,    setCat]          = useState('')
  const [modalArt,     setModalArt]     = useState(false)
  const [modalCompra,  setModalCompra]  = useState(false)
  const [modalSalida,  setModalSalida]  = useState(false)
  const [editArt,      setEditArt]      = useState(null)
  const [delArt,       setDelArt]       = useState(null)
  const [artSalida,    setArtSalida]    = useState(null)

  useEffect(() => {
    const unsubA = onSnapshot(
      query(collection(db, 'compras_articulos'), orderBy('nombre')),
      snap => { setArticulos(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) }
    )
    const unsubM = onSnapshot(
      query(collection(db, 'compras_movimientos'), orderBy('creadoEn', 'desc')),
      snap => setMovimientos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => { unsubA(); unsubM() }
  }, [])

  // ── CRUD artículos ──────────────────────────────────────────────────
  const guardarArticulo = async (data) => {
    try {
      if (editArt) {
        await updateDoc(doc(db, 'compras_articulos', editArt.id), {
          ...data, actualizadoEn: serverTimestamp(), actualizadoPor: perfil?.nombre
        })
        await registrarAccion({ usuario: perfil?.nombre, rol: perfil?.rol,
          modulo: 'Compras', accion: 'EDITAR', detalle: `Editó artículo: ${data.nombre}` })
        toast.success('Artículo actualizado')
      } else {
        await addDoc(collection(db, 'compras_articulos'), {
          ...data, stock: 0, totalCompras: 0, totalAsignado: 0,
          creadoEn: serverTimestamp(), creadoPor: perfil?.nombre
        })
        await registrarAccion({ usuario: perfil?.nombre, rol: perfil?.rol,
          modulo: 'Compras', accion: 'CREAR', detalle: `Creó artículo: ${data.nombre}` })
        toast.success('Artículo creado')
      }
      setModalArt(false); setEditArt(null)
    } catch(e) { toast.error('Error: ' + e.message) }
  }

  const eliminarArticulo = async () => {
    try {
      await deleteDoc(doc(db, 'compras_articulos', delArt.id))
      await registrarAccion({ usuario: perfil?.nombre, rol: perfil?.rol,
        modulo: 'Compras', accion: 'ELIMINAR', detalle: `Eliminó artículo: ${delArt.nombre}` })
      toast.success('Artículo eliminado')
      setDelArt(null)
    } catch(e) { toast.error('Error al eliminar') }
  }

  // ── Registrar compra ────────────────────────────────────────────────
  const registrarCompra = async (data) => {
    try {
      const art = articulos.find(a => a.id === data.articuloId)
      const total = (data.cantidad || 0) * (data.precioUnitario || 0)
      const batch = writeBatch(db)

      // Movimiento
      const movRef = doc(collection(db, 'compras_movimientos'))
      batch.set(movRef, {
        tipo: 'compra', articuloId: data.articuloId,
        articuloNombre: art?.nombre, articuloCategoria: art?.categoria,
        cantidad: data.cantidad, precioUnitario: data.precioUnitario || 0,
        totalBs: total, proveedor: data.proveedor || '',
        fecha: data.fecha, asignadoA: data.asignadoA || '',
        observaciones: data.observaciones || '',
        creadoPor: perfil?.nombre, creadoEn: serverTimestamp(),
      })

      // Actualizar stock
      batch.update(doc(db, 'compras_articulos', data.articuloId), {
        stock: increment(data.cantidad),
        totalCompras: increment(data.cantidad),
        actualizadoEn: serverTimestamp(),
      })
      await batch.commit()

      await registrarAccion({ usuario: perfil?.nombre, rol: perfil?.rol,
        modulo: 'Compras', accion: 'CREAR',
        detalle: `Compra: ${data.cantidad} x ${art?.nombre} — ${total} Bs (${data.proveedor || 'sin proveedor'})` })

      toast.success(`Compra registrada: ${data.cantidad} x ${art?.nombre}`)
      setModalCompra(false)
    } catch(e) { toast.error('Error: ' + e.message) }
  }

  // ── Registrar asignación/salida ─────────────────────────────────────
  const registrarAsignacion = async (data) => {
    try {
      if (data.cantidad > (artSalida?.stock || 0)) {
        toast.error('Stock insuficiente'); return
      }
      const batch = writeBatch(db)
      const movRef = doc(collection(db, 'compras_movimientos'))
      batch.set(movRef, {
        tipo: 'asignacion', articuloId: artSalida.id,
        articuloNombre: artSalida.nombre, articuloCategoria: artSalida.categoria,
        cantidad: data.cantidad, asignadoA: data.asignadoA,
        persona: data.persona || '', observaciones: data.observaciones || '',
        fecha: format(new Date(), 'yyyy-MM-dd'),
        creadoPor: perfil?.nombre, creadoEn: serverTimestamp(),
      })
      batch.update(doc(db, 'compras_articulos', artSalida.id), {
        stock: increment(-data.cantidad),
        totalAsignado: increment(data.cantidad),
        actualizadoEn: serverTimestamp(),
      })
      await batch.commit()

      await registrarAccion({ usuario: perfil?.nombre, rol: perfil?.rol,
        modulo: 'Compras', accion: 'APROBAR',
        detalle: `Asignación: ${data.cantidad} x ${artSalida.nombre} → ${data.asignadoA} (${data.persona || ''})` })

      toast.success(`Asignado: ${data.cantidad} x ${artSalida.nombre} → ${data.asignadoA}`)
      setModalSalida(false); setArtSalida(null)
    } catch(e) { toast.error('Error: ' + e.message) }
  }

  // ── Exportar Excel ──────────────────────────────────────────────────
  const exportarExcel = () => {
    const datos = movimientos.map(m => ({
      'Tipo':        m.tipo === 'compra' ? 'Compra' : 'Asignación',
      'Artículo':    m.articuloNombre,
      'Categoría':   m.articuloCategoria,
      'Cantidad':    m.cantidad,
      'Precio unit.':m.precioUnitario || '',
      'Total Bs':    m.totalBs || '',
      'Proveedor':   m.proveedor || '',
      'Asignado a':  m.asignadoA || '',
      'Persona':     m.persona || '',
      'Fecha':       m.fecha || '',
      'Registrado por': m.creadoPor,
    }))
    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Compras')
    XLSX.writeFile(wb, `Compras_SAJAMA_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  // ── KPIs ────────────────────────────────────────────────────────────
  const totalGastado    = movimientos.filter(m => m.tipo === 'compra').reduce((a,m) => a + (m.totalBs||0), 0)
  const totalArticulos  = articulos.length
  const sinStock        = articulos.filter(a => !a.stock || a.stock === 0).length
  const stockBajo       = articulos.filter(a => a.stockMin && a.stock > 0 && a.stock <= a.stockMin).length

  const artFiltrados = articulos.filter(a => {
    const q = busqueda.toLowerCase()
    return (!q || a.nombre?.toLowerCase().includes(q)) &&
           (!catFiltro || a.categoria === catFiltro)
  })

  const canEdit = ['administrador','gerencia','almacenero'].includes(perfil?.rol)

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="flex items-center gap-2">
            <ShoppingCart size={22} className="text-warning"/> Compras y Materiales
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de materiales de oficina, herramientas e insumos administrativos
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportarExcel} className="btn-secondary btn-sm">
            <Download size={14}/> Exportar
          </button>
          {canEdit && <>
            <button onClick={() => setModalCompra(true)} className="btn-warning btn-sm">
              <ShoppingCart size={14}/> Registrar compra
            </button>
            <button onClick={() => { setEditArt(null); setModalArt(true) }} className="btn-primary btn-sm">
              <Plus size={14}/> Nuevo artículo
            </button>
          </>}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:'Total artículos',  val: totalArticulos,                        color:'bg-primary-pale text-primary' },
          { label:'Gasto total (Bs)', val: totalGastado.toLocaleString() + ' Bs', color:'bg-warning-pale text-warning' },
          { label:'Sin stock',        val: sinStock,                              color:'bg-red-50 text-red-700'       },
          { label:'Stock bajo',       val: stockBajo,                             color:'bg-yellow-50 text-yellow-700' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl p-4 ${k.color}`}>
            <p className="text-2xl font-bold">{k.val}</p>
            <p className="text-xs font-medium mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key:'catalogo',     label:'Catálogo',    icon: Package   },
          { key:'compras',      label:'Compras',     icon: ShoppingCart },
          { key:'asignaciones', label:'Asignaciones',icon: TrendingDown },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon size={15}/> {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Catálogo ── */}
      {tab === 'catalogo' && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap gap-3">
            <div className="flex-1 min-w-48 relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input className="input pl-9" placeholder="Buscar artículo..."
                value={busqueda} onChange={e => setBusqueda(e.target.value)}/>
            </div>
            <select className="input w-auto" value={catFiltro} onChange={e => setCat(e.target.value)}>
              <option value="">Todas las categorías</option>
              {CATEGORIAS_COMPRA.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {(busqueda || catFiltro) && (
              <button onClick={() => { setBusqueda(''); setCat('') }} className="btn-secondary btn-sm">
                <RefreshCw size={13}/> Limpiar
              </button>
            )}
          </div>

          <div className="card p-0 overflow-hidden">
            {artFiltrados.length === 0 ? <EmptyState mensaje="No hay artículos registrados"/> : (
              <div className="overflow-x-auto">
                <table className="table-auto w-full">
                  <thead><tr>
                    {['Artículo','Categoría','Unidad','Stock','Stock mín.','Precio (Bs)','Total asignado','Acciones'].map(h => (
                      <th key={h} className="th">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {artFiltrados.map(a => (
                      <tr key={a.id} className="tr-hover">
                        <td className="td font-medium">{a.nombre}</td>
                        <td className="td"><Badge tipo="blue">{a.categoria}</Badge></td>
                        <td className="td text-gray-500 text-sm">{a.unidad}</td>
                        <td className="td">
                          {!a.stock || a.stock === 0
                            ? <Badge tipo="red">Sin stock</Badge>
                            : a.stockMin && a.stock <= a.stockMin
                              ? <Badge tipo="yellow">{a.stock} {a.unidad}</Badge>
                              : <Badge tipo="green">{a.stock} {a.unidad}</Badge>
                          }
                        </td>
                        <td className="td text-gray-500">{a.stockMin ?? '—'}</td>
                        <td className="td">{a.precio ? `${a.precio} Bs` : '—'}</td>
                        <td className="td text-gray-500">{a.totalAsignado ?? 0}</td>
                        <td className="td">
                          {canEdit && (
                            <div className="flex gap-1.5">
                              <button onClick={() => { setArtSalida(a); setModalSalida(true) }}
                                className="p-1.5 rounded-lg hover:bg-warning-pale text-warning transition-colors" title="Asignar">
                                <TrendingDown size={14}/>
                              </button>
                              <button onClick={() => { setEditArt(a); setModalArt(true) }}
                                className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors" title="Editar">
                                <Edit2 size={14}/>
                              </button>
                              <button onClick={() => setDelArt(a)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Eliminar">
                                <Trash2 size={14}/>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Compras ── */}
      {tab === 'compras' && (
        <div className="card p-0 overflow-hidden">
          {movimientos.filter(m => m.tipo === 'compra').length === 0
            ? <EmptyState mensaje="No hay compras registradas"/>
            : (
            <div className="overflow-x-auto">
              <table className="table-auto w-full">
                <thead><tr>
                  {['Fecha','Artículo','Categoría','Cantidad','Precio unit.','Total Bs','Proveedor','Asignado a','Por'].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {movimientos.filter(m => m.tipo === 'compra').map(m => (
                    <tr key={m.id} className="tr-hover">
                      <td className="td text-xs text-gray-500">{m.fecha || '—'}</td>
                      <td className="td font-medium">{m.articuloNombre}</td>
                      <td className="td"><Badge tipo="blue">{m.articuloCategoria}</Badge></td>
                      <td className="td font-bold text-success">+{m.cantidad}</td>
                      <td className="td text-gray-500">{m.precioUnitario ? `${m.precioUnitario} Bs` : '—'}</td>
                      <td className="td font-bold text-warning">{m.totalBs ? `${m.totalBs} Bs` : '—'}</td>
                      <td className="td text-gray-500">{m.proveedor || '—'}</td>
                      <td className="td text-gray-500">{m.asignadoA || '—'}</td>
                      <td className="td text-xs text-gray-400">{m.creadoPor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Asignaciones ── */}
      {tab === 'asignaciones' && (
        <div className="card p-0 overflow-hidden">
          {movimientos.filter(m => m.tipo === 'asignacion').length === 0
            ? <EmptyState mensaje="No hay asignaciones registradas"/>
            : (
            <div className="overflow-x-auto">
              <table className="table-auto w-full">
                <thead><tr>
                  {['Fecha','Artículo','Categoría','Cantidad','Asignado a','Persona','Observaciones','Por'].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {movimientos.filter(m => m.tipo === 'asignacion').map(m => (
                    <tr key={m.id} className="tr-hover">
                      <td className="td text-xs text-gray-500">{m.fecha || '—'}</td>
                      <td className="td font-medium">{m.articuloNombre}</td>
                      <td className="td"><Badge tipo="blue">{m.articuloCategoria}</Badge></td>
                      <td className="td font-bold text-danger">-{m.cantidad}</td>
                      <td className="td"><Badge tipo="yellow">{m.asignadoA}</Badge></td>
                      <td className="td text-gray-500">{m.persona || '—'}</td>
                      <td className="td text-xs text-gray-500">{m.observaciones || '—'}</td>
                      <td className="td text-xs text-gray-400">{m.creadoPor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      <Modal open={modalArt} onClose={() => { setModalArt(false); setEditArt(null) }}
        title={editArt ? 'Editar artículo' : 'Nuevo artículo'} size="md">
        <FormArticulo item={editArt} onGuardar={guardarArticulo} onCancelar={() => { setModalArt(false); setEditArt(null) }}/>
      </Modal>

      <Modal open={modalCompra} onClose={() => setModalCompra(false)} title="Registrar compra" size="lg">
        <FormCompra articulos={articulos} onGuardar={registrarCompra} onCancelar={() => setModalCompra(false)}/>
      </Modal>

      <Modal open={modalSalida} onClose={() => { setModalSalida(false); setArtSalida(null) }}
        title="Asignar / Entregar" size="md">
        <FormSalida articulo={artSalida} onGuardar={registrarAsignacion}
          onCancelar={() => { setModalSalida(false); setArtSalida(null) }}/>
      </Modal>

      <Confirm open={!!delArt}
        mensaje={`¿Eliminar el artículo "${delArt?.nombre}"? Se perderá su historial.`}
        onConfirm={eliminarArticulo} onCancel={() => setDelArt(null)}/>
    </div>
  )
}
