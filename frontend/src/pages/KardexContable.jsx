import { useState, useEffect } from 'react'
import {
  Calculator, Layers, BookOpen, Lock, Scale, Plus, Search,
  RefreshCw, Download, Printer, AlertTriangle, CheckCircle2,
  TrendingDown, TrendingUp, DollarSign, Calendar, FileText,
  ShieldAlert, Eye, EyeOff, X, ArrowRight, ShieldCheck, ArrowDownRight, ArrowUpRight
} from 'lucide-react'
import {
  getCatalogoValorado,
  getMovimientosKardex,
  registrarMovimientoKardex,
  TIPOS_MOVIMIENTO,
  getCierresMensuales,
  ejecutarCierreMensual,
  reabrirPeriodoContable,
  getConciliacionesFisicas,
  guardarConciliacionFisica,
  verificarPeriodoBloqueado
} from '../services/kardex'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

export default function KardexContable() {
  const { perfil, tienePermiso } = useAuth()
  const [tab, setTab] = useState('catalogo') // 'catalogo' | 'kardex' | 'cierres' | 'auditoria'
  const [loading, setLoading] = useState(true)

  // Datos de las 4 capas
  const [catalogoData, setCatalogoData] = useState({ items: [], kpis: {} })
  const [movimientos, setMovimientos] = useState([])
  const [cierres, setCierres] = useState([])
  const [conciliaciones, setConciliaciones] = useState([])

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [filtroItemKardex, setFiltroItemKardex] = useState('')
  const [filtroPeriodoKardex, setFiltroPeriodoKardex] = useState('')

  // Modales
  const [modalNuevoMov, setModalNuevoMov] = useState(false)
  const [modalCierre, setModalCierre] = useState(false)
  const [modalConciliacion, setModalConciliacion] = useState(false)
  const [cierreSeleccionado, setCierreSeleccionado] = useState(null)
  const [conciliacionSeleccionada, setConciliacionSeleccionada] = useState(null)

  const canEdit = tienePermiso('kardex', 'crear') || ['administrador', 'contabilidad'].includes(perfil?.rol)
  const isAdmin = perfil?.rol === 'administrador'

  // Carga general de datos
  const cargarDatos = async () => {
    setLoading(true)
    try {
      const [cat, movs, closings, concs] = await Promise.all([
        getCatalogoValorado(),
        getMovimientosKardex({ itemId: filtroItemKardex || null, periodo: filtroPeriodoKardex || null }),
        getCierresMensuales(),
        getConciliacionesFisicas()
      ])
      setCatalogoData(cat)
      setMovimientos(movs)
      setCierres(closings)
      setConciliaciones(concs)
    } catch (err) {
      console.error(err)
      toast.error('Error al cargar datos contables: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [filtroItemKardex, filtroPeriodoKardex])

  // Exportar Catálogo Valorado a Excel
  const exportarCatalogoExcel = () => {
    try {
      const rows = catalogoData.items.map(it => ({
        'Código': it.codigo,
        'Descripción (ES)': it.descripcion,
        'Descripción (ZH)': it.descripcionZh || '',
        'Categoría': it.categoria || '',
        'Stock Físico': it.stock,
        'Costo Promedio Unitario (Bs)': it.costoUnitario,
        'Valor Total en Libros (Bs)': it.valorTotal,
        'Ubicación': it.ubicacion || ''
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Balance Valorado')
      XLSX.writeFile(wb, `Balance_Valorado_${format(new Date(), 'yyyyMMdd')}.xlsx`)
      toast.success('Balance Valorado exportado a Excel')
    } catch (err) {
      toast.error('Error al exportar Excel')
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-gray-900">
            <Calculator className="text-primary" size={28} />
            Control Contable y Kardex Valorado
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Catálogo Valorado · Libro Diario · Cierres Mensuales · Conciliación Física
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={cargarDatos} className="btn-secondary btn-sm flex items-center gap-1.5">
            <RefreshCw size={14} /> Actualizar
          </button>
          {tab === 'catalogo' && (
            <button onClick={exportarCatalogoExcel} className="btn-secondary btn-sm flex items-center gap-1.5">
              <Download size={14} /> Exportar Balance
            </button>
          )}
          {tab === 'kardex' && canEdit && (
            <button onClick={() => setModalNuevoMov(true)} className="btn-primary btn-sm flex items-center gap-1.5">
              <Plus size={14} /> Registrar Movimiento
            </button>
          )}
          {tab === 'cierres' && canEdit && (
            <button onClick={() => setModalCierre(true)} className="btn-primary btn-sm flex items-center gap-1.5">
              <Lock size={14} /> Ejecutar Cierre Mensual
            </button>
          )}
          {tab === 'auditoria' && canEdit && (
            <button onClick={() => setModalConciliacion(true)} className="btn-primary btn-sm flex items-center gap-1.5">
              <Scale size={14} /> Iniciar Conteo Ciego
            </button>
          )}
        </div>
      </div>

      {/* Selector de Capas (Tabs) */}
      <div className="flex gap-2 border-b border-gray-200 pb-3 overflow-x-auto no-scrollbar">
        {[
          { id: 'catalogo',  label: '1. Catálogo y Saldos en Tiempo Real', icon: Layers },
          { id: 'kardex',    label: '2. Kardex Valorado (Libro Diario)',   icon: BookOpen },
          { id: 'cierres',   label: '3. Cierres Mensuales & Period Lock',  icon: Lock },
          { id: 'auditoria', label: '4. Auditoría y Conciliación Física',  icon: Scale },
        ].map(t => {
          const Icon = t.icon
          const activo = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activo
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CAPA 1: CATÁLOGO Y SALDOS EN TIEMPO REAL                            */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {tab === 'catalogo' && (
        <CapaCatalogo
          catalogoData={catalogoData}
          busqueda={busqueda}
          setBusqueda={setBusqueda}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CAPA 2: KARDEX VALORADO (LIBRO DIARIO INMUTABLE)                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {tab === 'kardex' && (
        <CapaKardex
          movimientos={movimientos}
          catalogoItems={catalogoData.items}
          filtroItem={filtroItemKardex}
          setFiltroItem={setFiltroItemKardex}
          filtroPeriodo={filtroPeriodoKardex}
          setFiltroPeriodo={setFiltroPeriodoKardex}
          onNuevoMov={() => setModalNuevoMov(true)}
          canEdit={canEdit}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CAPA 3: CIERRES MENSUALES & PERIOD LOCKING                          */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {tab === 'cierres' && (
        <CapaCierres
          cierres={cierres}
          onVerCierre={setCierreSeleccionado}
          onEjecutarCierre={() => setModalCierre(true)}
          onReabrirPeriodo={async (periodo) => {
            if (!isAdmin) return toast.error('Solo el administrador puede reabrir periodos contables')
            if (confirm(`¿Reabrir el periodo contable ${periodo}? Se permitirá el registro de movimientos nuevamente.`)) {
              try {
                await reabrirPeriodoContable(periodo, perfil?.nombre)
                toast.success(`Periodo ${periodo} reabierto`)
                cargarDatos()
              } catch (err) {
                toast.error('Error al reabrir periodo: ' + err.message)
              }
            }
          }}
          isAdmin={isAdmin}
          canEdit={canEdit}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CAPA 4: AUDITORÍA Y CONCILIACIÓN FÍSICA                             */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {tab === 'auditoria' && (
        <CapaAuditoria
          conciliaciones={conciliaciones}
          onVerConciliacion={setConciliacionSeleccionada}
          onIniciarConteo={() => setModalConciliacion(true)}
          canEdit={canEdit}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODALES DEL MÓDULO                                                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}

      {/* Modal 1: Registrar Movimiento en Kardex */}
      {modalNuevoMov && (
        <ModalRegistrarMovimiento
          items={catalogoData.items}
          perfil={perfil}
          onCerrar={() => setModalNuevoMov(false)}
          onExito={() => {
            setModalNuevoMov(false)
            cargarDatos()
          }}
        />
      )}

      {/* Modal 2: Ejecutar Cierre Mensual */}
      {modalCierre && (
        <ModalEjecutarCierre
          perfil={perfil}
          onCerrar={() => setModalCierre(false)}
          onExito={() => {
            setModalCierre(false)
            cargarDatos()
          }}
        />
      )}

      {/* Modal 3: Iniciar Conteo Ciego & Conciliación */}
      {modalConciliacion && (
        <ModalConteoCiego
          items={catalogoData.items}
          perfil={perfil}
          onCerrar={() => setModalConciliacion(false)}
          onExito={() => {
            setModalConciliacion(false)
            cargarDatos()
          }}
        />
      )}

      {/* Modal 4: Ver Detalle de Cierre Mensual */}
      {cierreSeleccionado && (
        <ModalDetalleCierre
          cierre={cierreSeleccionado}
          onCerrar={() => setCierreSeleccionado(null)}
        />
      )}

      {/* Modal 5: Ver Detalle de Conciliación */}
      {conciliacionSeleccionada && (
        <ModalDetalleConciliacion
          conciliacion={conciliacionSeleccionada}
          onCerrar={() => setConciliacionSeleccionada(null)}
        />
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTES DE CADA CAPA
// ═════════════════════════════════════════════════════════════════════════

// ── CAPA 1: Catálogo y Saldos en Tiempo Real ────────────────────────────
function CapaCatalogo({ catalogoData, busqueda, setBusqueda }) {
  const { kpis, items } = catalogoData

  const itemsFiltrados = items.filter(it => {
    if (!busqueda.trim()) return true
    const q = busqueda.toLowerCase()
    return (
      it.codigo?.toLowerCase().includes(q) ||
      it.descripcion?.toLowerCase().includes(q) ||
      it.descripcionZh?.toLowerCase().includes(q) ||
      it.categoria?.toLowerCase().includes(q) ||
      it.modelo?.toLowerCase().includes(q) ||
      it.serie?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      {/* KPIs de Activo Neto */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-gradient-to-br from-primary-pale to-white border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Activo Neto en Balance</p>
              <p className="text-2xl font-black text-primary mt-1">
                {(kpis.totalActivoNeto || 0).toLocaleString()} <span className="text-sm font-bold">Bs</span>
              </p>
            </div>
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <DollarSign size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Valor económico total en libros</p>
        </div>

        <div className="card p-4 bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Unidades Físicas</p>
              <p className="text-2xl font-black text-blue-800 mt-1">
                {(kpis.totalUnidadesFisicas || 0).toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-700">
              <Layers size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Contenido físico total en almacén</p>
        </div>

        <div className="card p-4 bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Ítems con Saldo</p>
              <p className="text-2xl font-black text-emerald-800 mt-1">{kpis.itemsConStock || 0}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-700">
              <CheckCircle2 size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Líneas de producto activas</p>
        </div>

        <div className="card p-4 bg-gradient-to-br from-rose-50 to-white border-rose-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Sin Existencias</p>
              <p className="text-2xl font-black text-rose-800 mt-1">{kpis.itemsSinStock || 0}</p>
            </div>
            <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-700">
              <AlertTriangle size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Requiere reposición</p>
        </div>
      </div>

      {/* Buscador */}
      <div className="card p-4 flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por código, descripción, modelo, serie o categoría..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="input pl-9"
          />
        </div>
        {busqueda && (
          <button onClick={() => setBusqueda('')} className="btn-secondary btn-sm">
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla de Catálogo Valorado */}
      <div className="card p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Cód.</th>
                <th className="py-3 px-4">Descripción (ES / ZH)</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4 text-center">Stock Físico</th>
                <th className="py-3 px-4 text-right">Costo Promedio (CPP)</th>
                <th className="py-3 px-4 text-right">Valor Total en Libros</th>
                <th className="py-3 px-4">Ubicación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {itemsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    No se encontraron productos registrados
                  </td>
                </tr>
              ) : (
                itemsFiltrados.map(it => (
                  <tr key={it.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-primary">{it.codigo}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-800">{it.descripcion}</div>
                      {it.descripcionZh && <div className="text-[11px] text-gray-400">{it.descripcionZh}</div>}
                    </td>
                    <td className="py-3 px-4 text-gray-500">{it.categoria || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                        it.stock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {it.stock} {it.unidad || 'u'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-gray-700">
                      {(it.costoUnitario || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} Bs
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-primary">
                      {(it.valorTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} Bs
                    </td>
                    <td className="py-3 px-4 text-gray-500">{it.ubicacion || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── CAPA 2: Kardex Valorado (Libro Diario) ──────────────────────────────
function CapaKardex({
  movimientos, catalogoItems, filtroItem, setFiltroItem,
  filtroPeriodo, setFiltroPeriodo, onNuevoMov, canEdit
}) {
  return (
    <div className="space-y-4">
      {/* Filtros de Kardex */}
      <div className="card p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          <div className="min-w-[220px]">
            <select
              value={filtroItem}
              onChange={e => setFiltroItem(e.target.value)}
              className="input text-xs"
            >
              <option value="">-- Todos los productos --</option>
              {catalogoItems.map(it => (
                <option key={it.id} value={it.id}>
                  {it.codigo} - {it.descripcion}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[150px]">
            <input
              type="month"
              value={filtroPeriodo}
              onChange={e => setFiltroPeriodo(e.target.value)}
              className="input text-xs"
              placeholder="Periodo (YYYY-MM)"
            />
          </div>

          {(filtroItem || filtroPeriodo) && (
            <button
              onClick={() => { setFiltroItem(''); setFiltroPeriodo('') }}
              className="btn-secondary btn-sm"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="text-xs text-gray-500 font-medium">
          {movimientos.length} asiento(s) contable(s) inmutable(s)
        </div>
      </div>

      {/* Tabla del Libro Diario de Kardex */}
      <div className="card p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[950px]">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3">Fecha</th>
                <th className="py-3 px-3">Ítem / Código</th>
                <th className="py-3 px-3">Tipo de Asiento</th>
                <th className="py-3 px-3">Doc. Respaldo</th>
                <th className="py-3 px-3 text-right">Cant. Mov.</th>
                <th className="py-3 px-3 text-right">C. Unitario</th>
                <th className="py-3 px-3 text-right">Monto Total</th>
                <th className="py-3 px-3 text-center">Saldo Físico</th>
                <th className="py-3 px-3 text-right">Saldo Monetario</th>
                <th className="py-3 px-3">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-sans">
              {movimientos.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    No se han registrado asientos en el Kardex
                  </td>
                </tr>
              ) : (
                movimientos.map(m => {
                  const esEntrada = m.deltaStock > 0
                  const esSalida = m.deltaStock < 0
                  return (
                    <tr key={m.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-3 text-gray-500 font-mono text-[11px] whitespace-nowrap">
                        {m.fecha}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-gray-800">{m.descripcion}</div>
                        <div className="text-[11px] font-mono text-primary">{m.codigo}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          esEntrada ? 'bg-emerald-100 text-emerald-800' :
                          esSalida ? 'bg-rose-100 text-rose-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {esEntrada && <ArrowUpRight size={12}/>}
                          {esSalida && <ArrowDownRight size={12}/>}
                          {m.tipoLabel || m.tipoMovimiento}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        <div className="font-medium">{m.documentoRespaldo}</div>
                        <div className="text-[10px] text-gray-400">N° {m.numDocumento}</div>
                      </td>
                      <td className={`py-3 px-3 text-right font-bold ${
                        esEntrada ? 'text-emerald-600' : esSalida ? 'text-rose-600' : 'text-gray-700'
                      }`}>
                        {esEntrada ? `+${m.cantidad}` : esSalida ? `-${m.cantidad}` : m.cantidad}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-gray-600">
                        {(m.costoUnitario || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} Bs
                      </td>
                      <td className={`py-3 px-3 text-right font-bold ${
                        esEntrada ? 'text-emerald-700' : esSalida ? 'text-rose-700' : 'text-gray-900'
                      }`}>
                        {(m.costoTotalMovimiento || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} Bs
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                          {m.stockPosterior}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-primary">
                        {(m.saldoMonetarioPosterior || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} Bs
                      </td>
                      <td className="py-3 px-3 text-gray-500 text-[11px]">
                        {m.usuarioResponsable}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── CAPA 3: Cierres Mensuales & Period Locking ──────────────────────────
function CapaCierres({ cierres, onVerCierre, onEjecutarCierre, onReabrirPeriodo, isAdmin, canEdit }) {
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900 text-xs">
        <ShieldCheck size={20} className="shrink-0 text-amber-700 mt-0.5" />
        <div>
          <b className="text-sm">Mecanismo de Bloqueo de Periodo </b>
          <p className="mt-1 text-amber-800 leading-relaxed">
            Una vez cerrado un mes contable, el sistema bloquea de manera automática cualquier inserción o modificación con fecha perteneciente al periodo cerrado, garantizando la inmutabilidad de los balances financieros y auditorías fiscales.
          </p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Periodo</th>
                <th className="py-3 px-4">Fecha de Cierre</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-center">Unidades (Inicial + Ent - Sal = Fin)</th>
                <th className="py-3 px-4 text-right">Patrimonio Final (Bs)</th>
                <th className="py-3 px-4">Responsable</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cierres.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    No se han ejecutado cierres mensuales. Haz clic en "Ejecutar Cierre Mensual" para consolidar el primer periodo.
                  </td>
                </tr>
              ) : (
                cierres.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-primary text-sm">
                      {c.periodo}
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-mono text-[11px]">
                      {c.fechaCierre}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        c.estado === 'Cerrado'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {c.estado === 'Cerrado' ? <Lock size={12}/> : <CheckCircle2 size={12}/>}
                        {c.estado}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-gray-700">
                      <span className="text-gray-500">{c.unidadesIniciales || 0}</span> +{' '}
                      <span className="text-emerald-600 font-bold">{(c.unidadesEntradas || 0)}</span> -{' '}
                      <span className="text-rose-600 font-bold">{(c.unidadesSalidas || 0)}</span> ={' '}
                      <span className="font-bold text-primary text-sm">{(c.unidadesFinales || 0)}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-black text-primary text-sm">
                      {(c.valorFinalBs || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} Bs
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {c.cerradoPor}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onVerCierre(c)}
                          className="btn-secondary btn-sm text-xs py-1"
                          title="Ver fotografía y acta"
                        >
                          <FileText size={13}/> Detalle
                        </button>
                        {isAdmin && c.estado === 'Cerrado' && (
                          <button
                            onClick={() => onReabrirPeriodo(c.periodo)}
                            className="btn-danger btn-sm text-xs py-1"
                            title="Reabrir periodo (Solo Admin)"
                          >
                            Reabrir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── CAPA 4: Auditoría y Conciliación Física ─────────────────────────────
function CapaAuditoria({ conciliaciones, onVerConciliacion, onIniciarConteo, canEdit }) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 text-blue-900 text-xs">
        <Scale size={20} className="shrink-0 text-blue-700 mt-0.5" />
        <div>
          <b className="text-sm">Protocolo de Conteo Ciego </b>
          <p className="mt-1 text-blue-800 leading-relaxed">
            
          </p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Ubicación</th>
                <th className="py-3 px-4">Auditor</th>
                <th className="py-3 px-4 text-center">Ítems Auditados</th>
                <th className="py-3 px-4 text-center">Desviación en Unidades</th>
                <th className="py-3 px-4 text-right">Impacto Económico</th>
                <th className="py-3 px-4 text-center">Ajuste en Kardex</th>
                <th className="py-3 px-4 text-center">Acta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {conciliaciones.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    No se han registrado sesiones de conciliación física. Presiona "Iniciar Conteo Ciego".
                  </td>
                </tr>
              ) : (
                conciliaciones.map(c => {
                  const difTotal = c.totalDiferenciaUnidades || 0
                  const impacto = c.totalImpactoEconomicoBs || 0
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-gray-700">{c.fecha}</td>
                      <td className="py-3 px-4 font-medium text-gray-800">{c.ubicacionAlmacen}</td>
                      <td className="py-3 px-4 text-gray-600">{c.auditorResponsable}</td>
                      <td className="py-3 px-4 text-center font-bold">{c.totalItemsAuditados}</td>
                      <td className="py-3 px-4 text-center font-bold">
                        <span className={`px-2 py-0.5 rounded-full ${
                          difTotal === 0 ? 'bg-emerald-100 text-emerald-800' :
                          difTotal > 0 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {difTotal > 0 ? `+${difTotal}` : difTotal} un.
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-right font-black ${
                        impacto === 0 ? 'text-gray-600' : impacto > 0 ? 'text-blue-700' : 'text-rose-700'
                      }`}>
                        {impacto.toLocaleString(undefined, { minimumFractionDigits: 2 })} Bs
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                          c.ajustesAplicados ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {c.ajustesAplicados ? 'Aplicado' : 'Solo Informe'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onVerConciliacion(c)}
                          className="btn-secondary btn-sm text-xs py-1"
                        >
                          <Printer size={13}/> Ver Acta
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// MODALES
// ═════════════════════════════════════════════════════════════════════════

// ── Modal 1: Registrar Movimiento en Kardex ─────────────────────────────
function ModalRegistrarMovimiento({ items, perfil, onCerrar, onExito }) {
  const [itemId, setItemId] = useState('')
  const [tipoMovimiento, setTipoMovimiento] = useState('SALIDA_VENTA')
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [cantidad, setCantidad] = useState(1)
  const [costoUnitario, setCostoUnitario] = useState('')
  const [documentoRespaldo, setDocumentoRespaldo] = useState('Factura de Venta')
  const [numDocumento, setNumDocumento] = useState('')
  const [justificacion, setJustificacion] = useState('')
  const [guardando, setGuardando] = useState(false)

  const itemSeleccionado = items.find(i => i.id === itemId)

  useEffect(() => {
    if (itemSeleccionado) {
      setCostoUnitario(itemSeleccionado.costoUnitario || itemSeleccionado.precio || 0)
    }
  }, [itemSeleccionado])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!itemId) return toast.error('Selecciona un producto')
    if (Number(cantidad) <= 0) return toast.error('La cantidad debe ser mayor a 0')

    setGuardando(true)
    try {
      await registrarMovimientoKardex({
        itemId,
        tipoMovimiento,
        fecha,
        cantidad: Number(cantidad),
        costoUnitario: costoUnitario !== '' ? Number(costoUnitario) : undefined,
        documentoRespaldo,
        numDocumento,
        usuarioResponsable: perfil?.nombre || 'Contador',
        justificacion
      })
      toast.success('Asiento inmutable registrado en Kardex y stock actualizado')
      onExito()
    } catch (err) {
      console.error(err)
      toast.error(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal open={true} onClose={onCerrar} title="Registrar Asiento en Kardex Valorado" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Producto</label>
            <select
              value={itemId}
              onChange={e => setItemId(e.target.value)}
              className="input text-xs"
              required
            >
              <option value="">-- Seleccionar ítem --</option>
              {items.map(it => (
                <option key={it.id} value={it.id}>
                  {it.codigo} - {it.descripcion} (Stock: {it.stock})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de Movimiento</label>
            <select
              value={tipoMovimiento}
              onChange={e => setTipoMovimiento(e.target.value)}
              className="input text-xs"
              required
            >
              {TIPOS_MOVIMIENTO.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="input text-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cantidad</label>
            <input
              type="number"
              min="1"
              step="1"
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              className="input text-xs font-bold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Costo Unitario (Bs)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={costoUnitario}
              onChange={e => setCostoUnitario(e.target.value)}
              className="input text-xs font-bold"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Documento de Respaldo</label>
            <select
              value={documentoRespaldo}
              onChange={e => setDocumentoRespaldo(e.target.value)}
              className="input text-xs"
            >
              <option value="Factura de Venta">Factura de Venta</option>
              <option value="Factura de Compra">Factura de Compra</option>
              <option value="Remisión de Entrega">Remisión de Entrega</option>
              <option value="Acta de Merma / Daño">Acta de Merma / Daño</option>
              <option value="Orden de Salida">Orden de Salida</option>
              <option value="Orden de Entrada">Orden de Entrada</option>
              <option value="Guía de Transferencia">Guía de Transferencia</option>
              <option value="Acta de Conciliación">Acta de Conciliación</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">N° de Documento</label>
            <input
              type="text"
              placeholder="Ej: FAC-00234, ACTA-09"
              value={numDocumento}
              onChange={e => setNumDocumento(e.target.value)}
              className="input text-xs font-mono"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Justificación / Notas de Auditoría</label>
          <textarea
            rows={2}
            placeholder="Detalle de la transacción, imputación a COGS o causa de la merma..."
            value={justificacion}
            onChange={e => setJustificacion(e.target.value)}
            className="input text-xs"
          />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            Total Asiento: <b className="text-primary font-bold text-sm">{(Number(cantidad || 0) * Number(costoUnitario || 0)).toLocaleString()} Bs</b>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCerrar} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary">
              {guardando ? 'Guardando Asiento...' : 'Registrar Asiento'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── Modal 2: Ejecutar Cierre Mensual ────────────────────────────────────
function ModalEjecutarCierre({ perfil, onCerrar, onExito }) {
  const [periodo, setPeriodo] = useState(format(new Date(), 'yyyy-MM'))
  const [notas, setNotas] = useState('')
  const [procesando, setProcesando] = useState(false)

  const handleCierre = async (e) => {
    e.preventDefault()
    setProcesando(true)
    try {
      await ejecutarCierreMensual({
        periodo,
        usuario: perfil?.nombre || 'Auditor Contable',
        notas
      })
      toast.success(`Cierre mensual ${periodo} consolidado e inmutable`)
      onExito()
    } catch (err) {
      console.error(err)
      toast.error(err.message)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <Modal open={true} onClose={onCerrar} title="Ejecutar Cierre Mensual Contable" size="md">
      <form onSubmit={handleCierre} className="space-y-4">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-start gap-2.5">
          <Lock size={18} className="shrink-0 text-rose-600 mt-0.5" />
          <div>
            <b>Aviso de Bloqueo Inmutable (Period Locking)</b>
            <p className="mt-0.5 text-rose-700">
              Al ejecutar el cierre, el periodo quedará <b>bloqueado</b> para transacciones con fechas pasadas y se capturará la fotografía del patrimonio global en libros.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Periodo a Cerrar (Mes / Año)</label>
          <input
            type="month"
            value={periodo}
            onChange={e => setPeriodo(e.target.value)}
            className="input font-bold"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Notas del Acta de Cierre</label>
          <textarea
            rows={3}
            placeholder="Observaciones contables, justificación del cuadre o estado general..."
            value={notas}
            onChange={e => setNotas(e.target.value)}
            className="input text-xs"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
          <button type="button" onClick={onCerrar} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={procesando} className="btn-danger flex items-center gap-1.5">
            <Lock size={14} /> {procesando ? 'Consolidando Periodo...' : 'Consolidar y Bloquear Periodo'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Modal 3: Iniciar Conteo Ciego & Conciliación ────────────────────────
function ModalConteoCiego({ items, perfil, onCerrar, onExito }) {
  const [ubicacion, setUbicacion] = useState('Almacén Central')
  const [conteo, setConteo] = useState(
    items.map(it => ({
      itemId: it.id,
      codigo: it.codigo,
      descripcion: it.descripcion,
      stockTeorico: it.stock,
      costoUnitario: it.costoUnitario || it.precio || 0,
      conteoFisico: it.stock // Inicializa igual pero el auditor puede alterar
    }))
  )
  const [modoCiego, setModoCiego] = useState(true)
  const [aplicarAjuste, setAplicarAjuste] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const handleConteoChange = (idx, valor) => {
    const v = Math.max(0, Number(valor) || 0)
    setConteo(prev => prev.map((it, i) => i === idx ? { ...it, conteoFisico: v } : it))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      await guardarConciliacionFisica({
        fecha: format(new Date(), 'yyyy-MM-dd'),
        auditorResponsable: perfil?.nombre || 'Auditor',
        ubicacionAlmacen: ubicacion,
        conteoItems: conteo,
        aplicarAjustes: aplicarAjuste,
        usuario: perfil?.nombre
      })
      toast.success(aplicarAjuste ? 'Conciliación guardada y ajustes aplicados al Kardex' : 'Acta de conciliación guardada')
      onExito()
    } catch (err) {
      console.error(err)
      toast.error(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal open={true} onClose={onCerrar} title="Sesión de Conteo Ciego & Conciliación Física" size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Ubicación / Almacén</label>
            <input
              type="text"
              value={ubicacion}
              onChange={e => setUbicacion(e.target.value)}
              className="input text-xs"
              required
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setModoCiego(!modoCiego)}
              className="btn-secondary btn-sm flex items-center gap-1.5"
            >
              {modoCiego ? <Eye size={14}/> : <EyeOff size={14}/>}
              {modoCiego ? 'Mostrar Stock Teórico' : 'Ocultar Stock Teórico (Modo Ciego)'}
            </button>
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 border-b border-gray-200 font-semibold text-gray-700 sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Cód.</th>
                <th className="py-2.5 px-3">Descripción</th>
                {!modoCiego && <th className="py-2.5 px-3 text-center">Stock Teórico</th>}
                <th className="py-2.5 px-3 text-center w-28">Conteo Físico Real</th>
                {!modoCiego && <th className="py-2.5 px-3 text-center">Desviación</th>}
                {!modoCiego && <th className="py-2.5 px-3 text-right">Impacto (Bs)</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {conteo.map((it, idx) => {
                const dif = it.conteoFisico - it.stockTeorico
                const imp = dif * it.costoUnitario
                return (
                  <tr key={it.itemId} className="hover:bg-gray-50">
                    <td className="py-2 px-3 font-mono font-bold text-primary">{it.codigo}</td>
                    <td className="py-2 px-3 font-medium text-gray-800">{it.descripcion}</td>
                    {!modoCiego && (
                      <td className="py-2 px-3 text-center font-bold text-gray-600">{it.stockTeorico}</td>
                    )}
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        min="0"
                        value={it.conteoFisico}
                        onChange={e => handleConteoChange(idx, e.target.value)}
                        className="w-20 text-center font-black text-sm px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                      />
                    </td>
                    {!modoCiego && (
                      <td className="py-2 px-3 text-center font-bold">
                        <span className={`px-2 py-0.5 rounded ${
                          dif === 0 ? 'text-gray-400' : dif > 0 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {dif > 0 ? `+${dif}` : dif}
                        </span>
                      </td>
                    )}
                    {!modoCiego && (
                      <td className={`py-2 px-3 text-right font-bold ${
                        imp === 0 ? 'text-gray-400' : imp > 0 ? 'text-blue-700' : 'text-rose-700'
                      }`}>
                        {imp.toLocaleString(undefined, { minimumFractionDigits: 2 })} Bs
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={aplicarAjuste}
              onChange={e => setAplicarAjuste(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary"
            />
            <span>Aplicar contra-asientos de ajuste automáticamente en el Kardex y actualizar stock</span>
          </label>

          <div className="flex gap-2">
            <button type="button" onClick={onCerrar} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary">
              {guardando ? 'Guardando Conciliación...' : 'Finalizar y Guardar Acta'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── Modal 4: Ver Detalle de Cierre Mensual ──────────────────────────────
function ModalDetalleCierre({ cierre, onCerrar }) {
  const imprimirActa = () => {
    const w = window.open('', '_blank', 'width=900,height=700')
    const html = `
      <html>
        <head>
          <title>Acta de Cierre Mensual Contable - ${cierre.periodo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 25px; color: #111; }
            h1 { font-size: 18px; margin-bottom: 2px; }
            .sub { font-size: 12px; color: #555; margin-bottom: 20px; }
            .cuadro { border: 1px solid #ccc; border-collapse: collapse; width: 100%; margin-bottom: 20px; font-size: 12px; }
            .cuadro th, .cuadro td { border: 1px solid #ccc; padding: 6px 10px; }
            .cuadro th { background: #f4f4f4; text-align: left; }
            .firmas { margin-top: 50px; display: flex; justify-content: space-around; font-size: 11px; }
            .linea { border-top: 1px solid #333; width: 180px; text-align: center; padding-top: 5px; }
          </style>
        </head>
        <body>
          <h1>SAJAMA.SRL · ACTA DE CIERRE MENSUAL CONTABLE</h1>
          <div class="sub">Periodo Auditado: <b>${cierre.periodo}</b> · Fecha de Cierre: ${cierre.fechaCierre} · Estado: ${cierre.estado}</div>
          
          <table class="cuadro">
            <tr><th>Inventario Inicial (Unidades)</th><td>${cierre.unidadesIniciales} un.</td><th>Valor Inicial</th><td>${(cierre.valorInicialBs||0).toLocaleString()} Bs</td></tr>
            <tr><th>Entradas del Periodo</th><td>+${cierre.unidadesEntradas} un.</td><th>Valor Entradas</th><td>+${(cierre.valorEntradasBs||0).toLocaleString()} Bs</td></tr>
            <tr><th>Salidas del Periodo</th><td>-${cierre.unidadesSalidas} un.</td><th>Valor Salidas</th><td>-${(cierre.valorSalidasBs||0).toLocaleString()} Bs</td></tr>
            <tr style="background:#e8f4fd;font-weight:bold"><th>Inventario Final en Libros</th><td>${cierre.unidadesFinales} un.</td><th>Patrimonio Final</th><td>${(cierre.valorFinalBs||0).toLocaleString()} Bs</td></tr>
          </table>

          <div style="font-size:12px; margin-bottom: 10px;"><b>Responsable del Cierre:</b> ${cierre.cerradoPor}</div>
          <div style="font-size:12px; margin-bottom: 20px;"><b>Notas / Observaciones:</b> ${cierre.notas || 'Sin notas registradas.'}</div>

          <div class="firmas">
            <div class="linea">Auditor / Contador</div>
            <div class="linea">Jefe de Almacén</div>
            <div class="linea">Gerencia General</div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `
    w.document.write(html)
    w.document.close()
  }

  return (
    <Modal open={true} onClose={onCerrar} title={`Fotografía Contable Periodo ${cierre.periodo}`} size="lg">
      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-50 p-3 rounded-xl">
            <p className="text-gray-400 text-[10px] uppercase font-bold">Inv. Inicial</p>
            <p className="text-base font-bold text-gray-800 mt-0.5">{cierre.unidadesIniciales} un.</p>
            <p className="text-[11px] text-gray-500">{(cierre.valorInicialBs || 0).toLocaleString()} Bs</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl">
            <p className="text-emerald-700 text-[10px] uppercase font-bold">Entradas</p>
            <p className="text-base font-bold text-emerald-800 mt-0.5">+{cierre.unidadesEntradas} un.</p>
            <p className="text-[11px] text-emerald-600">+{(cierre.valorEntradasBs || 0).toLocaleString()} Bs</p>
          </div>
          <div className="bg-rose-50 p-3 rounded-xl">
            <p className="text-rose-700 text-[10px] uppercase font-bold">Salidas</p>
            <p className="text-base font-bold text-rose-800 mt-0.5">-{cierre.unidadesSalidas} un.</p>
            <p className="text-[11px] text-rose-600">-{(cierre.valorSalidasBs || 0).toLocaleString()} Bs</p>
          </div>
          <div className="bg-primary-pale p-3 rounded-xl">
            <p className="text-primary text-[10px] uppercase font-bold">Patrimonio Final</p>
            <p className="text-base font-bold text-primary mt-0.5">{cierre.unidadesFinales} un.</p>
            <p className="text-[11px] font-black text-primary">{(cierre.valorFinalBs || 0).toLocaleString()} Bs</p>
          </div>
        </div>

        {cierre.snapshotItems && cierre.snapshotItems.length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 font-semibold text-gray-700 sticky top-0">
                <tr>
                  <th className="py-2 px-3">Cód.</th>
                  <th className="py-2 px-3">Descripción</th>
                  <th className="py-2 px-3 text-center">Stock</th>
                  <th className="py-2 px-3 text-right">CPP</th>
                  <th className="py-2 px-3 text-right">Valor en Libros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {cierre.snapshotItems.map((it, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="py-1.5 px-3 text-primary">{it.codigo}</td>
                    <td className="py-1.5 px-3 font-sans text-gray-800">{it.descripcion}</td>
                    <td className="py-1.5 px-3 text-center font-bold">{it.stock}</td>
                    <td className="py-1.5 px-3 text-right text-gray-600">{(it.costoUnitario || 0).toLocaleString()} Bs</td>
                    <td className="py-1.5 px-3 text-right font-bold text-primary">{(it.valorTotal || 0).toLocaleString()} Bs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          <button onClick={imprimirActa} className="btn-secondary flex items-center gap-1.5">
            <Printer size={14} /> Imprimir Acta de Cierre
          </button>
          <button onClick={onCerrar} className="btn-primary">Cerrar</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Modal 5: Ver Detalle de Conciliación ────────────────────────────────
function ModalDetalleConciliacion({ conciliacion, onCerrar }) {
  const imprimirActa = () => {
    const w = window.open('', '_blank', 'width=900,height=700')
    const html = `
      <html>
        <head>
          <title>Acta de Conciliación Física - ${conciliacion.fecha}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 25px; color: #111; }
            h1 { font-size: 18px; margin-bottom: 2px; }
            .sub { font-size: 12px; color: #555; margin-bottom: 20px; }
            .cuadro { border: 1px solid #ccc; border-collapse: collapse; width: 100%; margin-bottom: 20px; font-size: 11px; }
            .cuadro th, .cuadro td { border: 1px solid #ccc; padding: 5px 8px; }
            .cuadro th { background: #f4f4f4; text-align: left; }
            .firmas { margin-top: 50px; display: flex; justify-content: space-around; font-size: 11px; }
            .linea { border-top: 1px solid #333; width: 180px; text-align: center; padding-top: 5px; }
          </style>
        </head>
        <body>
          <h1>SAJAMA.SRL · ACTA FORMAL DE CONCILIACIÓN FÍSICA DE INVENTARIO</h1>
          <div class="sub">Fecha: ${conciliacion.fecha} · Ubicación: ${conciliacion.ubicacionAlmacen} · Auditor: ${conciliacion.auditorResponsable}</div>
          
          <table class="cuadro">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Stock Teórico</th>
                <th>Conteo Físico</th>
                <th>Diferencia</th>
                <th>Costo Unit. (Bs)</th>
                <th>Impacto Monetario</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${(conciliacion.items || []).map(it => `
                <tr>
                  <td>${it.codigo}</td>
                  <td>${it.descripcion}</td>
                  <td style="text-align:center">${it.stockTeorico}</td>
                  <td style="text-align:center">${it.conteoFisico}</td>
                  <td style="text-align:center;font-weight:bold">${it.diferencia > 0 ? '+'+it.diferencia : it.diferencia}</td>
                  <td style="text-align:right">${(it.costoUnitario||0).toLocaleString()}</td>
                  <td style="text-align:right;font-weight:bold">${(it.impactoEconomicoBs||0).toLocaleString()} Bs</td>
                  <td>${it.estado}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="font-size:12px; margin-bottom: 20px;">
            <b>Desviación Total en Unidades:</b> ${conciliacion.totalDiferenciaUnidades} un. · 
            <b>Impacto Económico Total:</b> ${(conciliacion.totalImpactoEconomicoBs||0).toLocaleString()} Bs
          </div>

          <div class="firmas">
            <div class="linea">Auditor Responsable</div>
            <div class="linea">Encargado de Almacén</div>
            <div class="linea">Gerencia Administrativa</div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `
    w.document.write(html)
    w.document.close()
  }

  return (
    <Modal open={true} onClose={onCerrar} title={`Acta de Conciliación Física - ${conciliacion.fecha}`} size="xl">
      <div className="space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-3 rounded-xl">
          <div>
            <p className="text-gray-500">Auditor: <b className="text-gray-800">{conciliacion.auditorResponsable}</b></p>
            <p className="text-gray-500">Ubicación: <b className="text-gray-800">{conciliacion.ubicacionAlmacen}</b></p>
          </div>
          <div className="text-right">
            <p className="text-gray-500">Desviación Total: <b className="text-primary font-bold">{conciliacion.totalDiferenciaUnidades} un.</b></p>
            <p className="text-gray-500">Impacto Económico: <b className="text-primary font-bold">{(conciliacion.totalImpactoEconomicoBs || 0).toLocaleString()} Bs</b></p>
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 border-b border-gray-200 font-semibold text-gray-700 sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Cód.</th>
                <th className="py-2.5 px-3">Descripción</th>
                <th className="py-2.5 px-3 text-center">Teórico</th>
                <th className="py-2.5 px-3 text-center">Físico</th>
                <th className="py-2.5 px-3 text-center">Diferencia</th>
                <th className="py-2.5 px-3 text-right">CPP</th>
                <th className="py-2.5 px-3 text-right">Impacto (Bs)</th>
                <th className="py-2.5 px-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(conciliacion.items || []).map((it, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="py-2 px-3 font-mono font-bold text-primary">{it.codigo}</td>
                  <td className="py-2 px-3 font-medium text-gray-800">{it.descripcion}</td>
                  <td className="py-2 px-3 text-center text-gray-600">{it.stockTeorico}</td>
                  <td className="py-2 px-3 text-center font-bold">{it.conteoFisico}</td>
                  <td className="py-2 px-3 text-center font-bold">
                    <span className={`px-2 py-0.5 rounded ${
                      it.diferencia === 0 ? 'text-gray-400' : it.diferencia > 0 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {it.diferencia > 0 ? `+${it.diferencia}` : it.diferencia}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-gray-600">{(it.costoUnitario || 0).toLocaleString()} Bs</td>
                  <td className={`py-2 px-3 text-right font-bold ${
                    it.impactoEconomicoBs === 0 ? 'text-gray-400' : it.impactoEconomicoBs > 0 ? 'text-blue-700' : 'text-rose-700'
                  }`}>
                    {(it.impactoEconomicoBs || 0).toLocaleString()} Bs
                  </td>
                  <td className="py-2 px-3 text-center">
                    <Badge tipo={it.diferencia === 0 ? 'green' : it.diferencia > 0 ? 'blue' : 'red'}>
                      {it.estado}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          <button onClick={imprimirActa} className="btn-secondary flex items-center gap-1.5">
            <Printer size={14} /> Imprimir Acta Formal
          </button>
          <button onClick={onCerrar} className="btn-primary">Cerrar</button>
        </div>
      </div>
    </Modal>
  )
}
