import { useForm } from 'react-hook-form'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image, MapPin, X } from 'lucide-react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../../services/firebase'

const CATEGORIAS = ['Maquinarias', 'Equipos', 'Repuestos', 'Materiales', 'Insumos']
const UNIDADES   = ['unidad', 'par', 'juego', 'litro', 'balde', 'caja', 'rollo', 'metro', 'kg']
const UBICACIONES = ['Estante A', 'Estante B', 'Estante C', 'Bodega 1', 'Bodega 2', 'Piso', 'Otro']

export default function FormItem({ item, onGuardar, onCancelar }) {
  const { i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm()
  const [fotoPreview, setFotoPreview] = useState(null)
  const [fotoFile,    setFotoFile]    = useState(null)
  const [subiendo,    setSubiendo]    = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    if (item) {
      reset(item)
      setFotoPreview(item.fotoUrl || null)
    } else {
      reset({
        codigo: '', descripcion: '', descripcionZh: '', modelo: '',
        serie: '', categoria: '', unidad: 'unidad', precio: '',
        stockMin: 5, stockInicial: 0, ubicacion: '', notas: ''
      })
      setFotoPreview(null)
      setFotoFile(null)
    }
  }, [item, reset])

  const handleFoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert(isZh ? '图片不能超过5MB' : 'La imagen no puede superar 5MB')
      return
    }
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  const onSubmit = async (data) => {
    let fotoUrl = item?.fotoUrl || null
    if (fotoFile) {
      setSubiendo(true)
      try {
        const storageRef = ref(storage, `items/${data.codigo}_${Date.now()}`)
        await uploadBytes(storageRef, fotoFile)
        fotoUrl = await getDownloadURL(storageRef)
      } catch (e) {
        console.warn('Error subiendo foto:', e.message)
      } finally {
        setSubiendo(false)
      }
    }
    await onGuardar({ ...data, fotoUrl })
  }

  const label = (es, zh) => isZh ? zh : es

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

      {/* Foto */}
      <div className="flex items-start gap-4">
        <div>
          <p className="label mb-2">{label('Foto del producto', '产品图片')}</p>
          <div
            onClick={() => fileRef.current.click()}
            className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary cursor-pointer flex items-center justify-center overflow-hidden bg-gray-50 transition-colors relative group"
          >
            {fotoPreview
              ? <>
                  <img src={fotoPreview} alt="preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Image size={20} className="text-white" />
                  </div>
                </>
              : <div className="text-center text-gray-400">
                  <Image size={24} className="mx-auto mb-1" />
                  <p className="text-xs">{label('Clic para subir', '点击上传')}</p>
                </div>
            }
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
          {fotoPreview && (
            <button type="button" onClick={() => { setFotoPreview(null); setFotoFile(null) }}
              className="mt-1 text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
              <X size={11} /> {label('Quitar foto', '删除图片')}
            </button>
          )}
        </div>

        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{label('Código *', '编号 *')}</label>
              <input className="input" type="number" placeholder="Ej: 001"
                {...register('codigo', { required: label('Requerido','必填'), valueAsNumber: true })} />
              {errors.codigo && <p className="text-red-500 text-xs mt-1">{errors.codigo.message}</p>}
            </div>
            <div>
              <label className="label">{label('Categoría *', '类别 *')}</label>
              <select className="input" {...register('categoria', { required: label('Requerido','必填') })}>
                <option value="">{label('Seleccionar...','选择...')}</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.categoria && <p className="text-red-500 text-xs mt-1">{errors.categoria.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{label('Unidad *', '单位 *')}</label>
              <select className="input" {...register('unidad', { required: true })}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{label('Precio (Bs)', '价格 (Bs)')}</label>
              <input className="input" type="number" step="0.01" placeholder="0.00"
                {...register('precio', { valueAsNumber: true })} />
            </div>
          </div>
        </div>
      </div>

      {/* Descripción ES */}
      <div>
        <label className="label">{label('Descripción (Español) *', '描述（西班牙语）*')}</label>
        <input className="input" placeholder="Descripción completa del ítem"
          {...register('descripcion', { required: label('Requerido','必填') })} />
        {errors.descripcion && <p className="text-red-500 text-xs mt-1">{errors.descripcion.message}</p>}
      </div>

      {/* Descripción ZH */}
      <div>
        <label className="label flex items-center gap-2">
          {label('Descripción en Chino simplificado', '中文描述（简体）')}
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">中文</span>
        </label>
        <input className="input" placeholder="中文描述（可选）"
          {...register('descripcionZh')} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">{label('Modelo', '型号')}</label>
          <input className="input" placeholder="Ej: 8PK1068" {...register('modelo')} />
        </div>
        <div>
          <label className="label">{label('N° de Serie', '序列号')}</label>
          <input className="input" placeholder="Opcional / 可选" {...register('serie')} />
        </div>
        <div>
          <label className="label">{label('Stock mínimo', '最低库存')}</label>
          <input className="input" type="number" placeholder="5"
            {...register('stockMin', { valueAsNumber: true })} />
        </div>
      </div>

      {/* Ubicación */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label flex items-center gap-1">
            <MapPin size={13} className="text-primary-light" />
            {label('Ubicación en almacén', '仓库位置')}
          </label>
          <select className="input" {...register('ubicacion')}>
            <option value="">{label('Seleccionar ubicación...', '选择位置...')}</option>
            {UBICACIONES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        {!item && (
          <div>
            <label className="label">{label('Stock inicial', '初始库存')}</label>
            <input className="input" type="number" placeholder="0"
              {...register('stockInicial', { valueAsNumber: true })} />
          </div>
        )}
      </div>

      {/* Notas */}
      <div>
        <label className="label">{label('Notas / Observaciones', '备注')}</label>
        <textarea className="input resize-none" rows={2}
          placeholder={label('Información adicional...', '附加信息...')}
          {...register('notas')} />
      </div>

      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancelar} className="btn-secondary">
          {label('Cancelar', '取消')}
        </button>
        <button type="submit" disabled={isSubmitting || subiendo} className="btn-primary">
          {subiendo ? label('Subiendo foto...', '上传图片中...') :
           isSubmitting ? label('Guardando...', '保存中...') :
           item ? label('Actualizar ítem', '更新项目') : label('Crear ítem', '创建项目')}
        </button>
      </div>
    </form>
  )
}
