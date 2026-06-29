import { useEffect, useState } from 'react'
import { suscribirAuditoria } from '../services/auditoria'
import { PageLoader } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Search, RefreshCw, Eye, ShieldAlert } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ACCION_COLOR = {
  CREAR:    'green',
  EDITAR:   'blue',
  ELIMINAR: 'red',
  APROBAR:  'green',
  RECHAZAR: 'red',
  LOGIN:    'gray',
}

const ACCION_ICON = {
  CREAR:    '➕',
  EDITAR:   '✏️',
  ELIMINAR: '🗑️',
  APROBAR:  '✅',
  RECHAZAR: '❌',
  LOGIN:    '🔑',
}

export default function Auditoria() {
  const [logs,     setLogs]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroAc, setFiltroAc] = useState('')
  const [filtroMod,setFiltroMod]= useState('')
  const [verDetalle,setDetalle] = useState(null)

  useEffect(() => {
    const unsub = suscribirAuditoria(data => { setLogs(data); setLoading(false) })
    return unsub
  }, [])

  const filtered = logs.filter(l => {
    const q = busqueda.toLowerCase()
    const matchQ = !q || l.usuario?.toLowerCase().includes(q) || l.detalle?.toLowerCase().includes(q) || l.modulo?.toLowerCase().includes(q)
    const matchA = !filtroAc  || l.accion  === filtroAc
    const matchM = !filtroMod || l.modulo  === filtroMod
    return matchQ && matchA && matchM
  })

  const modulos   = [...new Set(logs.map(l => l.modulo).filter(Boolean))]
  const acciones  = [...new Set(logs.map(l => l.accion).filter(Boolean))]

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2">
            <ShieldAlert size={22} className="text-warning"/> Log de Auditoría
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} de {logs.length} registros — Historial completo de cambios en el sistema
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="input pl-9" placeholder="Buscar por usuario, acción o detalle..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className="input w-auto" value={filtroAc} onChange={e => setFiltroAc(e.target.value)}>
          <option value="">Todas las acciones</option>
          {acciones.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="input w-auto" value={filtroMod} onChange={e => setFiltroMod(e.target.value)}>
          <option value="">Todos los módulos</option>
          {modulos.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {(busqueda || filtroAc || filtroMod) && (
          <button onClick={() => { setBusqueda(''); setFiltroAc(''); setFiltroMod('') }}
            className="btn-secondary btn-sm">
            <RefreshCw size={13}/> Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        {filtered.length === 0 ? <EmptyState mensaje="No hay registros de auditoría aún"/> : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full">
              <thead><tr>
                {['Fecha y hora','Usuario','Rol','Módulo','Acción','Detalle','Ver'].map(h => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} className="tr-hover">
                    <td className="td text-xs text-gray-500 whitespace-nowrap">
                      {log.fecha?.toDate
                        ? format(log.fecha.toDate(), 'dd/MM/yy HH:mm:ss', { locale: es })
                        : '—'}
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-primary-pale rounded-full flex items-center justify-center text-primary text-xs font-bold shrink-0">
                          {log.usuario?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="text-sm font-medium">{log.usuario}</span>
                      </div>
                    </td>
                    <td className="td text-xs text-gray-500 capitalize">{log.rol}</td>
                    <td className="td"><Badge tipo="blue">{log.modulo}</Badge></td>
                    <td className="td">
                      <Badge tipo={ACCION_COLOR[log.accion] || 'gray'}>
                        {ACCION_ICON[log.accion]} {log.accion}
                      </Badge>
                    </td>
                    <td className="td text-sm max-w-xs">
                      <div className="truncate" title={log.detalle}>{log.detalle}</div>
                    </td>
                    <td className="td">
                      {(log.datosAntes || log.datosDespues) && (
                        <button onClick={() => setDetalle(log)}
                          className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors">
                          <Eye size={14}/>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal ver detalle del cambio */}
      <Modal open={!!verDetalle} onClose={() => setDetalle(null)} title="Detalle del cambio" size="lg">
        {verDetalle && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Usuario',  verDetalle.usuario],
                ['Rol',      verDetalle.rol],
                ['Módulo',   verDetalle.modulo],
                ['Acción',   verDetalle.accion],
                ['Fecha',    verDetalle.fecha?.toDate ? format(verDetalle.fecha.toDate(), 'dd/MM/yyyy HH:mm:ss') : '—'],
                ['Detalle',  verDetalle.detalle],
              ].map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">{k}</p>
                  <p className="font-medium text-gray-800">{v}</p>
                </div>
              ))}
            </div>
            {verDetalle.datosAntes && (
              <div>
                <p className="font-semibold text-red-600 mb-2">Datos ANTES del cambio:</p>
                <pre className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs overflow-x-auto text-red-800">
                  {JSON.stringify(verDetalle.datosAntes, null, 2)}
                </pre>
              </div>
            )}
            {verDetalle.datosDespues && (
              <div>
                <p className="font-semibold text-green-600 mb-2">Datos DESPUÉS del cambio:</p>
                <pre className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs overflow-x-auto text-green-800">
                  {JSON.stringify(verDetalle.datosDespues, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
