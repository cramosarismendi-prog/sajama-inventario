import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, RefreshCw, Edit2, Trash2, Download, Image, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { suscribirInventario, crearItem, actualizarItem, eliminarItem } from '../services/inventario'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { Confirm } from '../components/ui/Confirm'
import { EmptyState } from '../components/ui/EmptyState'
import FormItem from '../components/modules/FormItem'
import { exportarInventarioExcel } from '../utils/exportar'

const CATEGORIAS = ['Maquinarias', 'Equipos', 'Repuestos', 'Materiales', 'Insumos']

export default function Inventario() {
  const { t, i18n } = useTranslation()
  const { perfil }  = useAuth()
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [catFiltro,setCat]      = useState('')
  const [modalOpen,setModal]    = useState(false)
  const [editItem, setEdit]     = useState(null)
  const [delItem,  setDel]      = useState(null)
  const [verFoto,  setVerFoto]  = useState(null)

  useEffect(() => {
    const unsub = suscribirInventario(data => { setItems(data); setLoading(false) })
    return unsub
  }, [])

  const filtered = items.filter(i => {
    const q = busqueda.toLowerCase()
    const matchQ = !q ||
      i.codigo?.toString().includes(q) ||
      i.descripcion?.toLowerCase().includes(q) ||
      i.descripcionZh?.toLowerCase().includes(q) ||
      i.modelo?.toLowerCase().includes(q) ||
      i.ubicacion?.toLowerCase().includes(q)
    const matchC = !catFiltro || i.categoria === catFiltro
    return matchQ && matchC
  })

  const badgeStock = (item) => {
    if (!item.stock || item.stock === 0) return <Badge tipo="red">{t('inventario.stockCero')}</Badge>
    if (item.stockMin && item.stock <= item.stockMin) return <Badge tipo="yellow">{item.stock} {item.unidad}</Badge>
    return <Badge tipo="green">{item.stock} {item.unidad}</Badge>
  }

  const handleGuardar = async (data) => {
    try {
      if (editItem) {
        await actualizarItem(editItem.id, data, perfil.nombre)
        toast.success('Ítem actualizado correctamente')
      } else {
        await crearItem(data, perfil.nombre)
        toast.success('Ítem creado correctamente')
      }
      setModal(false); setEdit(null)
    } catch (e) { toast.error('Error al guardar: ' + e.message) }
  }

  const handleEliminar = async () => {
    try {
      await eliminarItem(delItem.id)
      toast.success('Ítem eliminado')
      setDel(null)
    } catch (e) { toast.error('Error al eliminar') }
  }

  const canEdit = ['administrador','almacenero'].includes(perfil?.rol)
  const isZh    = i18n.language === 'zh'

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>{t('inventario.titulo')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} {isZh ? '件' : 'de'} {items.length} {isZh ? '项目' : 'ítems'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => exportarInventarioExcel(items)} className="btn-secondary btn-sm">
            <Download size={14} /> {t('common.exportar')}
          </button>
          {canEdit && (
            <button onClick={() => { setEdit(null); setModal(true) }} className="btn-primary btn-sm">
              <Plus size={14} /> {t('common.nuevo')}
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: isZh ? '总项目' : 'Total ítems',   val: items.length,                                          color: 'bg-primary-pale text-primary' },
          { label: isZh ? '有库存' : 'Con stock',      val: items.filter(i => i.stock > 0).length,                 color: 'bg-green-50 text-green-700' },
          { label: isZh ? '无库存' : 'Sin stock',      val: items.filter(i => !i.stock || i.stock === 0).length,   color: 'bg-red-50 text-red-700' },
          { label: isZh ? '无价格' : 'Sin precio',     val: items.filter(i => !i.precio || i.precio === 0).length, color: 'bg-yellow-50 text-yellow-700' },
        ].map(c => (
          <div key={c.label} className={`rounded-xl p-4 ${c.color}`}>
            <p className="text-2xl font-bold">{c.val}</p>
            <p className="text-xs font-medium mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9"
            placeholder={isZh ? '按编号、描述或型号搜索...' : 'Buscar por código, descripción o modelo...'}
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className="input w-auto" value={catFiltro} onChange={e => setCat(e.target.value)}>
          <option value="">{isZh ? '全部类别' : 'Todas las categorías'}</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(busqueda || catFiltro) && (
          <button onClick={() => { setBusqueda(''); setCat('') }} className="btn-secondary btn-sm">
            <RefreshCw size={14} /> {t('common.limpiar')}
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        {filtered.length === 0
          ? <EmptyState mensaje={isZh ? '未找到项目' : 'No se encontraron ítems'} />
          : (
          <div className="overflow-x-auto">
            <table className="table-auto">
              <thead>
                <tr>
                  <th className="th w-12">{isZh ? '图片' : 'Foto'}</th>
                  <th className="th">{isZh ? '编号' : 'Cód.'}</th>
                  <th className="th">{isZh ? '描述 / Descripción' : 'Descripción'}</th>
                  <th className="th">{isZh ? '中文描述' : 'Desc. Chino'}</th>
                  <th className="th">{isZh ? '序列号' : 'N° Serie'}</th>
                  <th className="th">{isZh ? '型号' : 'Modelo'}</th>
                  <th className="th">{isZh ? '类别' : 'Categoría'}</th>
                  <th className="th">{isZh ? '位置' : 'Ubicación'}</th>
                  <th className="th">{isZh ? '库存' : 'Stock'}</th>
                  <th className="th">{isZh ? '出库' : 'Salidas'}</th>
                  <th className="th">{isZh ? '价格' : 'Precio (Bs)'}</th>
                  {canEdit && <th className="th">{t('common.acciones')}</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className="tr-hover">
                    {/* Foto */}
                    <td className="td">
                      {item.fotoUrl
                        ? <img src={item.fotoUrl} alt="foto"
                            className="w-10 h-10 rounded-lg object-cover cursor-pointer border border-gray-200 hover:scale-110 transition"
                            onClick={() => setVerFoto(item)} />
                        : <div onClick={() => canEdit && (setEdit(item), setModal(true))}
                            className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-primary-pale transition"
                            title={isZh ? '添加图片' : 'Agregar foto'}>
                            <Image size={16} className="text-gray-400" />
                          </div>
                      }
                    </td>
                    {/* Código */}
                    <td className="td font-mono text-primary font-semibold">{item.codigo}</td>
                    {/* Descripción ES */}
                    <td className="td font-medium max-w-[180px]">
                      <div className="truncate" title={item.descripcion}>{item.descripcion}</div>
                    </td>
                    {/* Descripción ZH */}
                    <td className="td text-gray-600 max-w-[140px]">
                      <div className="truncate" title={item.descripcionZh}>
                        {item.descripcionZh || <span className="text-gray-300 text-xs">{isZh ? '未填写' : '—'}</span>}
                      </div>
                    </td>
                    {/* Serie */}
                    <td className="td text-gray-500 text-xs font-mono">{item.serie || '—'}</td>
                    {/* Modelo */}
                    <td className="td text-gray-500 text-xs">{item.modelo || '—'}</td>
                    {/* Categoría */}
                    <td className="td"><Badge tipo="blue">{item.categoria || '—'}</Badge></td>
                    {/* Ubicación */}
                    <td className="td">
                      {item.ubicacion
                        ? <span className="flex items-center gap-1 text-xs text-gray-600">
                            <MapPin size={12} className="text-primary-light shrink-0" />{item.ubicacion}
                          </span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    {/* Stock */}
                    <td className="td">{badgeStock(item)}</td>
                    {/* Salidas */}
                    <td className="td">
                      <span className="font-semibold text-red-500 text-sm">
                        {item.totalSalidas ?? 0}
                      </span>
                    </td>
                    {/* Precio */}
                    <td className="td">
                      {item.precio
                        ? <span className="font-semibold text-green-700">{Number(item.precio).toLocaleString()} Bs</span>
                        : <Badge tipo="yellow">{isZh ? '无价格' : 'Sin precio'}</Badge>}
                    </td>
                    {/* Acciones */}
                    {canEdit && (
                      <td className="td">
                        <div className="flex gap-1.5">
                          <button onClick={() => { setEdit(item); setModal(true) }}
                            className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors" title={t('common.editar')}>
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => setDel(item)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title={t('common.eliminar')}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal ver foto */}
      <Modal open={!!verFoto} onClose={() => setVerFoto(null)} title={verFoto?.descripcion || ''} size="sm">
        {verFoto?.fotoUrl && (
          <img src={verFoto.fotoUrl} alt="foto" className="w-full rounded-xl object-contain max-h-96" />
        )}
      </Modal>

      {/* Modal Form */}
      <Modal open={modalOpen} onClose={() => { setModal(false); setEdit(null) }}
        title={editItem ? (isZh ? '编辑项目' : 'Editar ítem') : (isZh ? '新建项目' : 'Nuevo ítem')} size="lg">
        <FormItem item={editItem} onGuardar={handleGuardar} onCancelar={() => { setModal(false); setEdit(null) }} />
      </Modal>

      {/* Confirm eliminar */}
      <Confirm open={!!delItem}
        mensaje={`${isZh ? '删除' : '¿Eliminar'} "${delItem?.descripcion}"? ${isZh ? '此操作无法撤销。' : 'Esta acción no se puede deshacer.'}`}
        onConfirm={handleEliminar} onCancel={() => setDel(null)} />
    </div>
  )
}
