import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, CheckCircle, XCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { suscribirSalidas, solicitarSalida, aprobarSalida, rechazarSalida } from '../services/salidas'
import { getItems } from '../services/inventario'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { Confirm } from '../components/ui/Confirm'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const DESTINOS = [
  { value: 'ventas',     label: 'Ventas' },
  { value: 'taller',     label: 'Taller Mecánico' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'bajas',      label: 'Bajas' },
]

function FormSalida({ items, onGuardar, onCancelar }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm()
  const itemSel = items.find(i => i.id === watch('itemId'))
  return (
    <form onSubmit={handleSubmit(onGuardar)} className="space-y-4">
      <div>
        <label className="label">Ítem *</label>
        <select className="input" {...register('itemId', { required: 'Selecciona un ítem' })}>
          <option value="">Seleccionar ítem...</option>
          {items.filter(i => i.stock > 0).map(i => (
            <option key={i.id} value={i.id}>[{i.codigo}] {i.descripcion} — Stock: {i.stock}</option>
          ))}
        </select>
        {errors.itemId && <p className="text-red-500 text-xs mt-1">{errors.itemId.message}</p>}
      </div>
      {itemSel && (
        <div className="bg-primary-pale rounded-lg p-3 text-sm text-primary">
          <b>{itemSel.descripcion}</b> · Stock disponible: <b>{itemSel.stock} {itemSel.unidad}</b>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Destino *</label>
          <select className="input" {...register('destino', { required: 'Requerido' })}>
            <option value="">Seleccionar...</option>
            {DESTINOS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          {errors.destino && <p className="text-red-500 text-xs mt-1">{errors.destino.message}</p>}
        </div>
        <div>
          <label className="label">Cantidad *</label>
          <input className="input" type="number" min="1" max={itemSel?.stock || 9999}
            {...register('cantidad', { required: 'Requerido', min: { value: 1, message: 'Mín. 1' }, valueAsNumber: true })} />
          {errors.cantidad && <p className="text-red-500 text-xs mt-1">{errors.cantidad.message}</p>}
        </div>
      </div>
      <div>
        <label className="label">Observaciones</label>
        <textarea className="input resize-none" rows={2} {...register('observaciones')} />
      </div>
      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancelar} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Enviando...' : 'Solicitar salida'}
        </button>
      </div>
    </form>
  )
}

export default function Salidas() {
  const { t } = useTranslation()
  const { perfil } = useAuth()
  const [salidas,  setSalidas]  = useState([])
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(false)
  const [rechazar, setRechazar] = useState(null)
  const [motivo,   setMotivo]   = useState('')

  const canAprobar = ['administrador','gerencia','almacenero'].includes(perfil?.rol)

  useEffect(() => {
    const unsub = suscribirSalidas(data => { setSalidas(data); setLoading(false) })
    getItems().then(setItems)
    return unsub
  }, [])

  const handleSolicitar = async (data) => {
    try {
      const item = items.find(i => i.id === data.itemId)
      await solicitarSalida({ ...data, itemDescripcion: item?.descripcion, itemCodigo: item?.codigo }, perfil.nombre)
      toast.success('Solicitud enviada — pendiente de aprobación')
      setModal(false)
    } catch (e) { toast.error('Error: ' + e.message) }
  }

  const handleAprobar = async (s) => {
    try {
      await aprobarSalida(s.id, s.itemId, s.cantidad, perfil.nombre)
      toast.success('Salida aprobada y stock descontado')
    } catch (e) { toast.error('Error al aprobar: ' + e.message) }
  }

  const handleRechazar = async () => {
    try {
      await rechazarSalida(rechazar.id, motivo, perfil.nombre)
      toast.success('Solicitud rechazada')
      setRechazar(null); setMotivo('')
    } catch (e) { toast.error('Error al rechazar') }
  }

  const estadoBadge = (e) => ({
    pendiente: <Badge tipo="yellow"><Clock size={10} className="mr-1" />Pendiente</Badge>,
    aprobado:  <Badge tipo="green"><CheckCircle size={10} className="mr-1" />Aprobado</Badge>,
    rechazado: <Badge tipo="red"><XCircle size={10} className="mr-1" />Rechazado</Badge>,
  }[e] || <Badge>{e}</Badge>)

  const destinoLabel = { ventas: 'Ventas', taller: 'Taller', transporte: 'Transporte', bajas: 'Bajas' }

  const pendientes = salidas.filter(s => s.estado === 'pendiente').length

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1>{t('salidas.titulo')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {salidas.length} movimientos · {pendientes > 0 && <span className="text-warning font-medium">{pendientes} pendientes de aprobación</span>}
          </p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary btn-sm">
          <Plus size={14} /> Solicitar salida
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {salidas.length === 0 ? <EmptyState mensaje="No hay salidas registradas" /> : (
          <div className="overflow-x-auto">
            <table className="table-auto">
              <thead>
                <tr>
                  {['Fecha','Ítem','Destino','Cantidad','Estado','Solicitante','Autorizador','Acciones'].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salidas.map(s => (
                  <tr key={s.id} className="tr-hover">
                    <td className="td text-xs text-gray-500">
                      {s.creadoEn?.toDate ? format(s.creadoEn.toDate(), 'dd/MM/yy HH:mm', { locale: es }) : '—'}
                    </td>
                    <td className="td"><div className="font-medium">{s.itemDescripcion}</div><div className="text-xs text-gray-400">Cód. {s.itemCodigo}</div></td>
                    <td className="td"><Badge tipo="blue">{destinoLabel[s.destino] || s.destino}</Badge></td>
                    <td className="td font-semibold text-red-600">-{s.cantidad}</td>
                    <td className="td">{estadoBadge(s.estado)}</td>
                    <td className="td text-xs text-gray-500">{s.solicitante}</td>
                    <td className="td text-xs text-gray-500">{s.autorizadoPor || '—'}</td>
                    <td className="td">
                      {canAprobar && s.estado === 'pendiente' && (
                        <div className="flex gap-1.5">
                          <button onClick={() => handleAprobar(s)}
                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors" title="Aprobar">
                            <CheckCircle size={15} />
                          </button>
                          <button onClick={() => setRechazar(s)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Rechazar">
                            <XCircle size={15} />
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

      <Modal open={modal} onClose={() => setModal(false)} title="Solicitar salida del almacén" size="lg">
        <FormSalida items={items} onGuardar={handleSolicitar} onCancelar={() => setModal(false)} />
      </Modal>

      {/* Modal rechazo */}
      <Modal open={!!rechazar} onClose={() => { setRechazar(null); setMotivo('') }} title="Rechazar solicitud" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Ítem: <b>{rechazar?.itemDescripcion}</b></p>
          <div>
            <label className="label">Motivo del rechazo</label>
            <textarea className="input resize-none" rows={3} value={motivo}
              onChange={e => setMotivo(e.target.value)} placeholder="Explica el motivo..." />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => { setRechazar(null); setMotivo('') }} className="btn-secondary">Cancelar</button>
            <button onClick={handleRechazar} className="btn-danger">Confirmar rechazo</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}