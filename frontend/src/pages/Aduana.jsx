import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { db } from '../services/firebase'
import { registrarAccion } from '../services/auditoria'
import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp
} from 'firebase/firestore'
import { PageLoader } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { Confirm } from '../components/ui/Confirm'
import { Plus, Edit2, Trash2, Paperclip, FileArchive, ExternalLink, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

// Firestore limita cada documento a ~1 MiB. Como aquí guardamos hasta 3 PDFs
// codificados en base64 (que pesan ~37% más que el archivo original) dentro
// del mismo documento, limitamos cada archivo a 200 KB para dejar margen.
const MAX_PDF_BYTES = 200 * 1024 // 200 KB

// Convierte un File a un data URL en base64 (ej: "data:application/pdf;base64,....")
const leerArchivoComoBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
  reader.readAsDataURL(file)
})

// Los navegadores (Chrome en particular) bloquean la navegación directa de
// una pestaña a una URL "data:" ("Not allowed to navigate top frame to data
// URL"). Por eso, para VER el PDF convertimos ese data URL a un Blob y
// abrimos un "blob:" URL, que sí está permitido.
const dataURLaBlob = (dataURL) => {
  const [meta, base64] = dataURL.split(',')
  const mime = meta.match(/:(.*?);/)?.[1] || 'application/pdf'
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

const verPDF = (dataUrl) => {
  if (!dataUrl) return
  try {
    const blobUrl = URL.createObjectURL(dataURLaBlob(dataUrl))
    window.open(blobUrl, '_blank')
    // Liberamos el blob de memoria despues de un rato (ya se cargo en la pestaña nueva)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
  } catch (e) {
    toast.error('No se pudo abrir el PDF')
  }
}

// ── Selector de archivo con estado de subida + campo de referencia editable ──
function CampoArchivo({ label, requerido, urlActual, nombreActual, onSeleccionar, archivoSeleccionado,
  valorTexto, onCambiarTexto, placeholderTexto, textoRequerido }) {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const inputId = 'file-' + label.replace(/\s+/g, '-')

  const handleChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error(isZh ? '仅支持PDF格式文件' : 'Solo se permiten archivos PDF')
      e.target.value = ''
      return
    }
    if (file.size > MAX_PDF_BYTES) {
      toast.error(isZh ? `PDF文件大小超出限制 (${Math.round(MAX_PDF_BYTES / 1024)} KB)` : `El PDF supera el máximo permitido (${Math.round(MAX_PDF_BYTES / 1024)} KB)`)
      e.target.value = ''
      return
    }
    onSeleccionar(file)
  }

  const nombreArchivo = archivoSeleccionado?.name || nombreActual

  return (
    <div>
      <label className="label">{label}{(requerido || textoRequerido) && ' *'}</label>
      <div className="flex items-center gap-2">
        <input
          className="input flex-1"
          value={valorTexto}
          onChange={e => onCambiarTexto(e.target.value)}
          placeholder={placeholderTexto}
        />
        <input id={inputId} type="file" accept="application/pdf" className="hidden"
          onChange={handleChange} />
        <label htmlFor={inputId} className="btn-secondary btn-sm cursor-pointer whitespace-nowrap">
          <Paperclip size={13}/> {isZh ? '上传PDF附件' : 'Adjuntar PDF'}
        </label>
        {urlActual && !archivoSeleccionado && (
          <button type="button" onClick={() => verPDF(urlActual)}
            className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors" title={isZh ? '查看当前PDF' : 'Ver PDF actual'}>
            <ExternalLink size={14}/>
          </button>
        )}
      </div>
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-gray-400">{isZh ? `仅限PDF格式，最大 ${Math.round(MAX_PDF_BYTES / 1024)} KB` : `Solo PDF, máximo ${Math.round(MAX_PDF_BYTES / 1024)} KB`}</p>
        {nombreArchivo && (
          <p className="text-xs text-gray-500 flex items-center gap-1"><Paperclip size={11}/> {nombreArchivo}</p>
        )}
      </div>
    </div>
  )
}

function FormAduana({ registro, onGuardar, onCancelar }) {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const [descripcion, setDescripcion] = useState(registro?.descripcionMercaderia || '')
  const [fecha,       setFecha]       = useState(registro?.fecha || format(new Date(), 'yyyy-MM-dd'))
  const [refBL,       setRefBL]       = useState(registro?.blReferencia || '')
  const [refFactura,  setRefFactura]  = useState(registro?.facturaReferencia || '')
  const [refLista,    setRefLista]    = useState(registro?.listaEmpaqueReferencia || '')
  const [refDIM,      setRefDIM]      = useState(registro?.dimReferencia || '')
  const [archBL,      setArchBL]      = useState(null)
  const [archFactura, setArchFactura] = useState(null)
  const [archLista,   setArchLista]   = useState(null)
  const [archDIM,     setArchDIM]     = useState(null)
  const [guardando,   setGuardando]   = useState(false)
  const [error,       setError]       = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!descripcion.trim()) { setError(isZh ? '申报货物描述为必填项' : 'La descripción de la mercadería es requerida'); return }
    if (!registro?.blUrl && !archBL) { setError(isZh ? '提单 (BL) 文件为必填项' : 'El archivo de BL es requerido'); return }
    if (!refBL.trim()) { setError(isZh ? '集装箱号或提单参考文本为必填项' : 'El número o texto del contenedor (BL) es requerido'); return }
    setGuardando(true)
    try {
      await onGuardar({
        descripcionMercaderia: descripcion.trim(),
        fecha,
        refBL: refBL.trim(), refFactura: refFactura.trim(), refLista: refLista.trim(), refDIM: refDIM.trim(),
        archBL, archFactura, archLista, archDIM,
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">{isZh ? '申报物资 / 货物描述 *' : 'Descripción de la mercadería *'}</label>
        <input className="input" value={descripcion} onChange={e => setDescripcion(e.target.value)}
          placeholder={isZh ? '例如: 重型机械滤清器及备件' : 'Ej: Repuestos y filtros para maquinaria pesada'} />
      </div>

      <CampoArchivo label="BL" requerido textoRequerido
        urlActual={registro?.blUrl} nombreActual={registro?.blNombre}
        archivoSeleccionado={archBL} onSeleccionar={setArchBL}
        valorTexto={refBL} onCambiarTexto={setRefBL}
        placeholderTexto={isZh ? '集装箱号或提单编号' : 'N° o texto del contenedor'} />

      <CampoArchivo label={isZh ? '商业发票 (Factura)' : 'Factura'}
        urlActual={registro?.facturaUrl} nombreActual={registro?.facturaNombre}
        archivoSeleccionado={archFactura} onSeleccionar={setArchFactura}
        valorTexto={refFactura} onCambiarTexto={setRefFactura}
        placeholderTexto={isZh ? '发票编号 (选填)' : 'Referencia (opcional)'} />

      <CampoArchivo label={isZh ? '装箱单 (Lista de empaque)' : 'Lista de empaque'}
        urlActual={registro?.listaEmpaqueUrl} nombreActual={registro?.listaEmpaqueNombre}
        archivoSeleccionado={archLista} onSeleccionar={setArchLista}
        valorTexto={refLista} onCambiarTexto={setRefLista}
        placeholderTexto={isZh ? '装箱单参考 (选填)' : 'Referencia (opcional)'} />

      <CampoArchivo label={isZh ? '报关单 (DIM)' : 'DIM'}
        urlActual={registro?.dimUrl} nombreActual={registro?.dimNombre}
        archivoSeleccionado={archDIM} onSeleccionar={setArchDIM}
        valorTexto={refDIM} onCambiarTexto={setRefDIM}
        placeholderTexto={isZh ? '报关单参考 (选填)' : 'Referencia (opcional)'} />

      <div>
        <label className="label">{isZh ? '业务日期' : 'Fecha'}</label>
        <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancelar} className="btn-secondary">{isZh ? '取消' : 'Cancelar'}</button>
        <button type="submit" disabled={guardando} className="btn-primary">
          {guardando ? <><Loader2 size={14} className="animate-spin inline mr-1"/> {isZh ? '正在保存...' : 'Guardando...'}</> : registro ? (isZh ? '更新' : 'Actualizar') : (isZh ? '保存' : 'Guardar')}
        </button>
      </div>
    </form>
  )
}

export default function Aduana() {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const { perfil, tienePermiso } = useAuth()
  const [registros, setRegistros] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modalOpen, setModal]     = useState(false)
  const [editando,  setEditando]  = useState(null)
  const [delRegistro, setDelRegistro] = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'aduana'), orderBy('creadoEn', 'desc')),
      snap => { setRegistros(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) }
    )
    return unsub
  }, [])

  const canEdit = tienePermiso('aduana', 'crear') || tienePermiso('aduana', 'editar') || ['administrador', 'gerencia', 'almacenero', 'aduanas'].includes(perfil?.rol)
  const canDelete = tienePermiso('aduana', 'eliminar') || ['administrador', 'aduanas'].includes(perfil?.rol)

  const handleGuardar = async (data) => {
    try {
      const esNuevo = !editando
      const docRef = esNuevo ? doc(collection(db, 'aduana')) : doc(db, 'aduana', editando.id)

      const payload = {
        descripcionMercaderia: data.descripcionMercaderia,
        fecha: data.fecha,
        blReferencia: data.refBL || '',
        facturaReferencia: data.refFactura || '',
        listaEmpaqueReferencia: data.refLista || '',
        dimReferencia: data.refDIM || '',
      }

      // Los PDFs se guardan como base64 directamente en el documento
      // (ya no se sube nada a Firebase Storage).
      if (data.archBL) {
        payload.blUrl = await leerArchivoComoBase64(data.archBL)
        payload.blNombre = data.archBL.name
      }
      if (data.archFactura) {
        payload.facturaUrl = await leerArchivoComoBase64(data.archFactura)
        payload.facturaNombre = data.archFactura.name
      }
      if (data.archLista) {
        payload.listaEmpaqueUrl = await leerArchivoComoBase64(data.archLista)
        payload.listaEmpaqueNombre = data.archLista.name
      }
      if (data.archDIM) {
        payload.dimUrl = await leerArchivoComoBase64(data.archDIM)
        payload.dimNombre = data.archDIM.name
      }

      if (esNuevo) {
        await setDoc(docRef, {
          ...payload,
          creadoPor: perfil?.nombre, creadoEn: serverTimestamp(),
        })
        await registrarAccion({
          usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Aduana', accion: 'CREAR',
          detalle: `Registró trámite de aduana: ${payload.descripcionMercaderia}`,
        })
        toast.success(isZh ? '海关清关手续保存成功' : 'Trámite de aduana guardado correctamente')
      } else {
        await updateDoc(docRef, {
          ...payload,
          actualizadoPor: perfil?.nombre, actualizadoEn: serverTimestamp(),
        })
        await registrarAccion({
          usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Aduana', accion: 'EDITAR',
          detalle: `Editó trámite de aduana: ${payload.descripcionMercaderia}`,
        })
        toast.success(isZh ? '清关手续更新成功' : 'Trámite actualizado correctamente')
      }
      setModal(false); setEditando(null)
    } catch (e) {
      toast.error((isZh ? '保存失败: ' : 'Error al guardar: ') + e.message)
    }
  }

  const handleEliminar = async () => {
    try {
      await deleteDoc(doc(db, 'aduana', delRegistro.id))
      await registrarAccion({
        usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Aduana', accion: 'ELIMINAR',
        detalle: `Eliminó trámite de aduana: ${delRegistro.descripcionMercaderia}`,
      })
      toast.success(isZh ? '清关手续已删除' : 'Trámite eliminado')
      setDelRegistro(null)
    } catch (e) {
      toast.error((isZh ? '删除失败: ' : 'Error al eliminar: ') + e.message)
    }
  }

  const linkArchivo = (url, referencia) => url
    ? <div className="flex flex-col gap-0.5">
        <button type="button" onClick={() => verPDF(url)}
          className="inline-flex items-center gap-1 text-primary hover:underline text-xs"><ExternalLink size={12}/> {isZh ? '查看' : 'Ver'}</button>
        {referencia && <span className="text-xs text-gray-400">{referencia}</span>}
      </div>
    : <span className="text-gray-300 text-xs">—</span>

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="flex items-center gap-2">
            <FileArchive size={22} className="text-primary"/> {isZh ? '海关通关管理' : 'Aduana'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isZh ? `已登记 ${registros.length} 笔进口清关档案` : `${registros.length} trámite(s) de importación registrados`}
          </p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditando(null); setModal(true) }} className="btn-primary btn-sm">
            <Plus size={14}/> {isZh ? '新建清关手续' : 'Nuevo trámite'}
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {registros.length === 0 ? <EmptyState mensaje={isZh ? '暂无海关清关手续记录' : 'No hay trámites de aduana registrados'}/> : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full">
              <thead><tr>
                {[isZh ? '申报货物描述' : 'Descripción de la mercadería', 'BL', isZh ? '发票' : 'Factura', isZh ? '装箱单' : 'Lista de empaque', 'DIM', isZh ? '日期' : 'Fecha', isZh ? '经办人' : 'Registrado por', canEdit ? (isZh ? '操作' : 'Acciones') : null].filter(Boolean).map(h => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {registros.map(r => (
                  <tr key={r.id} className="tr-hover">
                    <td className="td font-medium max-w-xs">
                      <div className="truncate" title={r.descripcionMercaderia}>{r.descripcionMercaderia}</div>
                    </td>
                    <td className="td">{linkArchivo(r.blUrl, r.blReferencia)}</td>
                    <td className="td">{linkArchivo(r.facturaUrl, r.facturaReferencia)}</td>
                    <td className="td">{linkArchivo(r.listaEmpaqueUrl, r.listaEmpaqueReferencia)}</td>
                    <td className="td">{linkArchivo(r.dimUrl, r.dimReferencia)}</td>
                    <td className="td text-xs text-gray-500">
                      {r.fecha ? format(new Date(r.fecha + 'T00:00:00'), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="td text-xs text-gray-400">{r.creadoPor}</td>
                    {canEdit && (
                      <td className="td">
                        <div className="flex gap-1.5">
                          <button onClick={() => { setEditando(r); setModal(true) }}
                            className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors" title={isZh ? '编辑' : 'Editar'}>
                            <Edit2 size={14}/>
                          </button>
                          {canDelete && (
                            <button onClick={() => setDelRegistro(r)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title={isZh ? '删除' : 'Eliminar'}>
                              <Trash2 size={14}/>
                            </button>
                          )}
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

      <Modal open={modalOpen} onClose={() => { setModal(false); setEditando(null) }}
        title={editando ? (isZh ? '编辑海关手续' : 'Editar trámite de aduana') : (isZh ? '新建海关清关手续' : 'Nuevo trámite de aduana')} size="md">
        <FormAduana registro={editando} onGuardar={handleGuardar}
          onCancelar={() => { setModal(false); setEditando(null) }} />
      </Modal>

      <Confirm open={!!delRegistro}
        mensaje={isZh ? `确定要删除手续 "${delRegistro?.descripcionMercaderia}" 吗？此操作无法撤销。` : `¿Eliminar el trámite "${delRegistro?.descripcionMercaderia}"? Esta acción no se puede deshacer.`}
        onConfirm={handleEliminar} onCancel={() => setDelRegistro(null)} />
    </div>
  )
}
