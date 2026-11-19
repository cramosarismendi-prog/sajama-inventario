import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ArrowDownCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { suscribirIngresos, registrarIngreso } from '../services/ingresos'
import { getItems } from '../services/inventario'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const FUENTES = [
  { value: 'importacion', label: 'Importación',  labelZh: '进口' },
  { value: 'compra',      label: 'Compra local', labelZh: '本地采购' },
  { value: 'devolucion',  label: 'Devolución',   labelZh: '退还' },
]

function FormIngreso({ items, onGuardar, onCancelar }) {
  const { i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm()
  const itemSeleccionado = items.find(i => i.id === watch('itemId'))

  return (
    <form onSubmit={handleSubmit(onGuardar)} className="space-y-4">
      <div>
        <label className="label">{isZh ? '物品 *' : 'Ítem *'}</label>
        <select className="input" {...register('itemId', { required: isZh ? '请选择物品' : 'Selecciona un ítem' })}>
          <option value="">{isZh ? '选择物品...' : 'Seleccionar ítem...'}</option>
          {items.map(i => (
            <option key={i.id} value={i.id}>
              [{i.codigo}] {isZh && i.descripcionZh ? `${i.descripcionZh} (${i.descripcion})` : i.descripcion} — {isZh ? '当前库存' : 'Stock actual'}: {i.stock ?? 0}
            </option>
          ))}
        </select>
        {errors.itemId && <p className="text-red-500 text-xs mt-1">{errors.itemId.message}</p>}
      </div>
      {itemSeleccionado && (
        <div className="bg-primary-pale rounded-lg p-3 text-sm text-primary">
          <b>{isZh && itemSeleccionado.descripcionZh ? itemSeleccionado.descripcionZh : itemSeleccionado.descripcion}</b>
          {itemSeleccionado.modelo && ` · ${isZh ? '型号' : 'Modelo'}: ${itemSeleccionado.modelo}`}
          {' '}· {isZh ? '当前库存' : 'Stock actual'}: <b>{itemSeleccionado.stock ?? 0} {itemSeleccionado.unidad}</b>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">{isZh ? '入库来源 *' : 'Fuente de ingreso *'}</label>
          <select className="input" {...register('fuente', { required: isZh ? '必填项' : 'Requerido' })}>
            <option value="">{isZh ? '请选择...' : 'Seleccionar...'}</option>
            {FUENTES.map(f => (
              <option key={f.value} value={f.value}>{isZh ? f.labelZh : f.label}</option>
            ))}
          </select>
          {errors.fuente && <p className="text-red-500 text-xs mt-1">{errors.fuente.message}</p>}
        </div>
        <div>
          <label className="label">{isZh ? '入库数量 *' : 'Cantidad *'}</label>
          <input className="input" type="number" min="1" placeholder="0"
            {...register('cantidad', { required: isZh ? '必填项' : 'Requerido', min: { value: 1, message: isZh ? '最小值为1' : 'Mín. 1' }, valueAsNumber: true })} />
          {errors.cantidad && <p className="text-red-500 text-xs mt-1">{errors.cantidad.message}</p>}
        </div>
      </div>
      <div>
        <label className="label">{isZh ? '供应商 / 产地来源' : 'Proveedor / Origen'}</label>
        <input className="input" placeholder={isZh ? '供应商名称或原产国' : 'Nombre del proveedor o país de origen'} {...register('proveedor')} />
      </div>
      <div>
        <label className="label">{isZh ? '备注说明' : 'Observaciones'}</label>
        <textarea className="input resize-none" rows={2} {...register('observaciones')} />
      </div>
      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancelar} className="btn-secondary">
          {isZh ? '取消' : 'Cancelar'}
        </button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? (isZh ? '正在登记...' : 'Registrando...') : (isZh ? '登记入库' : 'Registrar ingreso')}
        </button>
      </div>
    </form>
  )
}

export default function Ingresos() {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const { perfil } = useAuth()
  const [ingresos, setIngresos] = useState([])
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(false)

  useEffect(() => {
    const unsub = suscribirIngresos(data => { setIngresos(data); setLoading(false) })
    getItems().then(setItems)
    return unsub
  }, [])

  const handleGuardar = async (data) => {
    try {
      const item = items.find(i => i.id === data.itemId)
      await registrarIngreso({ ...data, itemDescripcion: item?.descripcion, itemCodigo: item?.codigo }, perfil.nombre)
      toast.success(isZh ? '入库登记成功，库存已更新' : 'Ingreso registrado y stock actualizado')
      setModal(false)
    } catch (e) { toast.error((isZh ? '错误: ' : 'Error: ') + e.message) }
  }

  const fuenteColor = { importacion: 'blue', compra: 'green', devolucion: 'yellow' }
  const fuenteLabel = {
    importacion: isZh ? '进口' : 'Importación',
    compra:      isZh ? '本地采购' : 'Compra local',
    devolucion:  isZh ? '退还' : 'Devolución'
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1>{t('ingresos.titulo')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {ingresos.length} {isZh ? '条入库记录' : 'movimientos registrados'}
          </p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary btn-sm">
          <Plus size={14} /> {isZh ? '登记入库' : 'Registrar ingreso'}
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {ingresos.length === 0 ? <EmptyState mensaje={isZh ? '暂无入库记录' : 'No hay ingresos registrados'} /> : (
          <div className="overflow-x-auto">
            <table className="table-auto">
              <thead>
                <tr>
                  {[
                    isZh ? '日期' : 'Fecha',
                    isZh ? '物品' : 'Ítem',
                    isZh ? '来源' : 'Fuente',
                    isZh ? '数量' : 'Cantidad',
                    isZh ? '供应商' : 'Proveedor',
                    isZh ? '登记人' : 'Registrado por'
                  ].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ingresos.map(ing => (
                  <tr key={ing.id} className="tr-hover">
                    <td className="td text-xs text-gray-500">
                      {ing.creadoEn?.toDate ? format(ing.creadoEn.toDate(), 'dd/MM/yyyy HH:mm', { locale: es }) : '—'}
                    </td>
                    <td className="td">
                      <div className="font-medium">{ing.itemDescripcion}</div>
                      <div className="text-xs text-gray-400">{isZh ? '编号' : 'Cód.'} {ing.itemCodigo}</div>
                    </td>
                    <td className="td">
                      <Badge tipo={fuenteColor[ing.fuente] || 'gray'}>{fuenteLabel[ing.fuente] || ing.fuente}</Badge>
                    </td>
                    <td className="td font-semibold text-green-700">+{ing.cantidad}</td>
                    <td className="td text-gray-500">{ing.proveedor || '—'}</td>
                    <td className="td text-xs text-gray-500">{ing.creadoPor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={isZh ? '登记物资入库' : 'Registrar ingreso al almacén'} size="lg">
        <FormIngreso items={items} onGuardar={handleGuardar} onCancelar={() => setModal(false)} />
      </Modal>
    </div>
  )
}