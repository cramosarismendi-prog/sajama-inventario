import { useEffect, useState, useMemo, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, RefreshCw, Edit2, Trash2, Download, Image, MapPin, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { suscribirInventario, crearItem, actualizarItem, eliminarItem } from '../services/inventario'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/ui/Modal'
import { ModalVerFotoZoom } from '../components/ui/ModalVerFotoZoom'
import { Badge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { Confirm } from '../components/ui/Confirm'
import { EmptyState } from '../components/ui/EmptyState'
import FormItem from '../components/modules/FormItem'
import { exportarInventarioExcel } from '../utils/exportar'

const CATEGORIAS = ['Maquinarias', 'Equipos', 'Repuestos', 'Materiales', 'Insumos']
const EMPRESAS   = ['SAJAMA S.R.L.', 'RUNXINCORP S.R.L.', 'GOLDEN SHIELD S.R.L.', 'EMPRESA JIM ALEX', 'SUPERCADENA']

// Fila memoizada para prevenir re-renders síncronos de nodos sin cambios y mantener alineación perfecta
const FilaInventario = memo(({ item, isZh, canEdit, setVerFoto, setEdit, setModal, setDel, t, badgeStock, seriesDuplicadas }) => {
  const serieLower = (item.serie || '').toString().trim().toLowerCase()
  const esDuplicado = serieLower && seriesDuplicadas?.has(serieLower)

  return (
  <tr className="tr-hover">
    {/* Foto */}
    <td className="td">
      {item.fotoUrl
        ? <img src={item.fotoUrl} alt="foto"
            loading="lazy" decoding="async"
            width={40} height={40}
            className="w-10 h-10 rounded-lg object-cover cursor-pointer border border-gray-200 hover:opacity-80 transition-opacity shrink-0"
            onClick={() => setVerFoto(item)} />
        : <div onClick={() => canEdit && (setEdit(item), setModal(true))}
            className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-primary-pale transition shrink-0"
            title={isZh ? '添加图片' : 'Agregar foto'}>
            <Image size={16} className="text-gray-400" />
          </div>
      }
    </td>
    {/* Código */}
    <td className="td font-mono text-[#1E2E28] font-semibold">{item.codigo}</td>
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
    <td className="td text-xs font-mono">
      {item.serie ? (
        esDuplicado ? (
          <span
            className="inline-flex items-center gap-1 bg-orange-100 text-orange-900 border border-orange-300 font-bold px-2 py-0.5 rounded text-xs shadow-sm"
            title={isZh ? '⚠️ 序列号在库存中重复' : '⚠️ Número de serie duplicado en el inventario'}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            {item.serie}
            <span className="text-[10px] bg-orange-200 text-orange-900 px-1 rounded ml-0.5">Dup</span>
          </span>
        ) : (
          <span className="text-gray-600">{item.serie}</span>
        )
      ) : (
        <span className="text-gray-300">—</span>
      )}
    </td>
    {/* Modelo */}
    <td className="td text-gray-500 text-xs">{item.modelo || '—'}</td>
    {/* Categoría */}
    <td className="td"><Badge tipo="neutral">{item.categoria || '—'}</Badge></td>
    {/* Empresa */}
    <td className="td font-semibold text-xs text-gray-700">{item.empresa || 'SAJAMA S.R.L.'}</td>
    {/* Ubicación */}
    <td className="td">
      {item.ubicacion
        ? <span className="flex items-center gap-1 text-xs text-gray-600">
            <MapPin size={12} className="text-[#374540] shrink-0" />{item.ubicacion}
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
            className="p-1.5 rounded-lg hover:bg-[#EEF2F0] text-[#1E2E28] transition-colors" title={t('common.editar')}>
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
  )
})

export default function Inventario() {
  const { t, i18n } = useTranslation()
  const { perfil }  = useAuth()
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [catFiltro,setCat]      = useState('')
  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [modalOpen,setModal]    = useState(false)
  const [editItem, setEdit]     = useState(null)
  const [delItem,  setDel]      = useState(null)
  const [verFoto,  setVerFoto]  = useState(null)

  // Paginación para alto rendimiento en scroll y alineación nativa de columnas
  const [pagina, setPagina]                 = useState(1)
  const [itemsPorPagina, setItemsPorPagina] = useState(50)

  useEffect(() => {
    const unsub = suscribirInventario(data => { setItems(data); setLoading(false) })
    return unsub
  }, [])

  // Resetear a página 1 al filtrar
  useEffect(() => {
    setPagina(1)
  }, [busqueda, catFiltro, empresaFiltro])

  const seriesDuplicadas = useMemo(() => {
    const counts = {}
    items.forEach(i => {
      const s = (i.serie || '').toString().trim().toLowerCase()
      if (s && s !== '—' && s !== '-' && s !== 'n/a') {
        counts[s] = (counts[s] || 0) + 1
      }
    })
    const dups = new Set()
    Object.entries(counts).forEach(([s, count]) => {
      if (count > 1) dups.add(s)
    })
    return dups
  }, [items])

  const filtered = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return items.filter(i => {
      const matchQ = !q ||
        i.codigo?.toString().toLowerCase().includes(q) ||
        i.descripcion?.toLowerCase().includes(q) ||
        i.descripcionZh?.toLowerCase().includes(q) ||
        i.modelo?.toLowerCase().includes(q) ||
        i.serie?.toLowerCase().includes(q) ||
        i.ubicacion?.toLowerCase().includes(q) ||
        (i.empresa || 'SAJAMA S.R.L.').toLowerCase().includes(q)
      const matchC = !catFiltro || i.categoria === catFiltro
      const matchE = !empresaFiltro || (i.empresa || 'SAJAMA S.R.L.') === empresaFiltro
      return matchQ && matchC && matchE
    })
  }, [items, busqueda, catFiltro, empresaFiltro])

  const kpis = useMemo(() => [
    { label: i18n.language === 'zh' ? '总项目' : 'Total ítems',         val: items.length,                                                                                                    bar: 'border-t-[#16241F]', num: 'text-[#16241F]' },
    { label: i18n.language === 'zh' ? '有库存' : 'Con stock',           val: items.filter(i => i.stock > 0).length,                                                                           bar: 'border-t-[#15803D]', num: 'text-[#15803D]' },
    { label: i18n.language === 'zh' ? '无库存' : 'Sin stock',           val: items.filter(i => !i.stock || i.stock === 0).length,                                                             bar: 'border-t-[#DC2626]', num: 'text-[#DC2626]' },
    { label: i18n.language === 'zh' ? '重复序列号' : 'Series duplicadas', val: items.filter(i => i.serie && seriesDuplicadas.has(i.serie.toString().trim().toLowerCase())).length,            bar: 'border-t-[#EA580C]', num: 'text-[#C2410C]' },
    { label: i18n.language === 'zh' ? '无价格' : 'Sin precio',          val: items.filter(i => !i.precio || i.precio === 0).length,                                                           bar: 'border-t-[#B45309]', num: 'text-[#B45309]' },
  ], [items, i18n.language, seriesDuplicadas])

  const totalPaginas = useMemo(() => {
    if (itemsPorPagina === 0) return 1
    return Math.ceil(filtered.length / itemsPorPagina) || 1
  }, [filtered.length, itemsPorPagina])

  const itemsPaginados = useMemo(() => {
    if (itemsPorPagina === 0) return filtered
    const inicio = (pagina - 1) * itemsPorPagina
    return filtered.slice(inicio, inicio + itemsPorPagina)
  }, [filtered, pagina, itemsPorPagina])

  const badgeStock = (item) => {
    if (!item.stock || item.stock === 0) return <Badge tipo="red">{t('inventario.stockCero')}</Badge>
    if (item.stockMin && item.stock <= item.stockMin) return <Badge tipo="yellow">{item.stock} {item.unidad}</Badge>
    return <Badge tipo="green">{item.stock} {item.unidad}</Badge>
  }

  const handleGuardar = async (data) => {
    try {
      if (editItem) {
        await actualizarItem(editItem.id, data, perfil.nombre, perfil.rol, editItem)
        toast.success('Ítem actualizado correctamente')
      } else {
        await crearItem(data, perfil.nombre, perfil.rol)
        toast.success('Ítem creado correctamente')
      }
      setModal(false); setEdit(null)
    } catch (e) { toast.error('Error al guardar: ' + e.message) }
  }

  const handleEliminar = async () => {
    try {
      await eliminarItem(delItem.id, delItem, perfil.nombre, perfil.rol)
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
              <Plus size={14} className="text-[#E4D825]" /> {t('common.nuevo')}
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map(c => (
          <div key={c.label} className={`bg-white rounded-xl p-4 border border-[#E2E7E4] border-t-4 shadow-xs ${c.bar}`}>
            <p className={`text-2xl font-bold ${c.num}`}>{c.val}</p>
            <p className="text-xs font-medium text-[#374540] mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros y Selector de Paginación */}
      <div className="card p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 flex-1">
          <div className="flex-1 min-w-48 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9"
              placeholder={isZh ? '按编号、描述、型号或公司搜索...' : 'Buscar por código, descripción, modelo o empresa...'}
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <select className="input w-auto font-semibold text-gray-700" value={empresaFiltro} onChange={e => setEmpresaFiltro(e.target.value)}>
            <option value="">{isZh ? '全部公司' : 'Todas las empresas'}</option>
            {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select className="input w-auto" value={catFiltro} onChange={e => setCat(e.target.value)}>
            <option value="">{isZh ? '全部类别' : 'Todas las categorías'}</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {(busqueda || catFiltro || empresaFiltro) && (
            <button onClick={() => { setBusqueda(''); setCat(''); setEmpresaFiltro('') }} className="btn-secondary btn-sm">
              <RefreshCw size={14} /> {t('common.limpiar')}
            </button>
          )}
        </div>

        {/* Paginación Selector */}
        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium shrink-0">
          <span>{isZh ? '每页显示:' : 'Mostrar:'}</span>
          <select
            className="input py-1 px-2 text-xs w-auto"
            value={itemsPorPagina}
            onChange={e => { setItemsPorPagina(Number(e.target.value)); setPagina(1) }}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={0}>{isZh ? '全部' : 'Todos'}</option>
          </select>
        </div>
      </div>

      {/* Tabla con Alineación Nativa Perfecta */}
      <div className="card p-0 overflow-hidden">
        {filtered.length === 0
          ? <EmptyState mensaje={isZh ? '未找到项目' : 'No se encontraron ítems'} />
          : (
          <>
            <div className="overflow-x-auto">
              <table className="table-auto w-full">
                <thead>
                  <tr>
                    <th className="th w-12">{isZh ? '图片' : 'Foto'}</th>
                    <th className="th">{isZh ? '编号' : 'Cód.'}</th>
                    <th className="th">{isZh ? '描述 / Descripción' : 'Descripción'}</th>
                    <th className="th">{isZh ? '中文描述' : 'Desc. Chino'}</th>
                    <th className="th">{isZh ? '序列号' : 'N° Serie'}</th>
                    <th className="th">{isZh ? '型号' : 'Modelo'}</th>
                    <th className="th">{isZh ? '类别' : 'Categoría'}</th>
                    <th className="th">{isZh ? '公司' : 'Empresa'}</th>
                    <th className="th">{isZh ? '位置' : 'Ubicación'}</th>
                    <th className="th">{isZh ? '库存' : 'Stock'}</th>
                    <th className="th">{isZh ? '出库' : 'Salidas'}</th>
                    <th className="th">{isZh ? '价格' : 'Precio (Bs)'}</th>
                    {canEdit && <th className="th">{t('common.acciones')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {itemsPaginados.map(item => (
                    <FilaInventario
                      key={item.id}
                      item={item}
                      isZh={isZh}
                      canEdit={canEdit}
                      setVerFoto={setVerFoto}
                      setEdit={setEdit}
                      setModal={setModal}
                      setDel={setDel}
                      t={t}
                      badgeStock={badgeStock}
                      seriesDuplicadas={seriesDuplicadas}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación Controles */}
            {itemsPorPagina > 0 && totalPaginas > 1 && (
              <div className="p-3 border-t border-gray-100 flex items-center justify-between gap-3 text-xs text-gray-600 bg-gray-50/50 flex-wrap">
                <div>
                  {isZh ? `显示 ${(pagina - 1) * itemsPorPagina + 1} - ${Math.min(pagina * itemsPorPagina, filtered.length)} 共 ${filtered.length} 条`
                        : `Mostrando ${(pagina - 1) * itemsPorPagina + 1} - ${Math.min(pagina * itemsPorPagina, filtered.length)} de ${filtered.length} ítems`}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={pagina === 1}
                    onClick={() => setPagina(p => Math.max(p - 1, 1))}
                    className="btn-secondary btn-sm px-2 py-1 disabled:opacity-40"
                  >
                    <ChevronLeft size={14} /> {isZh ? '上一页' : 'Anterior'}
                  </button>
                  <span className="font-semibold px-2">
                    {pagina} / {totalPaginas}
                  </span>
                  <button
                    disabled={pagina >= totalPaginas}
                    onClick={() => setPagina(p => Math.min(p + 1, totalPaginas))}
                    className="btn-secondary btn-sm px-2 py-1 disabled:opacity-40"
                  >
                    {isZh ? '下一页' : 'Siguiente'} <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal ver foto con Zoom Interactivo y Pan */}
      <ModalVerFotoZoom
        open={!!verFoto}
        onClose={() => setVerFoto(null)}
        fotoUrl={verFoto?.fotoUrl}
        titulo={verFoto?.descripcion || 'Foto del producto'}
        subtitulo={`Código: ${verFoto?.codigo || ''} | Ubicación: ${verFoto?.ubicacion || 'N/A'}`}
      />

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