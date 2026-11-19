import { useForm } from 'react-hook-form'
import { useEffect, useRef, useState } from 'react'
import { Image, MapPin, X, Loader2, Languages, Scan, PackageSearch } from 'lucide-react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { storage } from '../../services/firebase'
import { traducirAlChino } from '../../services/traduccion'
import { useScannerQR, parsearQR } from '../../hooks/useScannerQR'
import toast from 'react-hot-toast'

// Obtener el siguiente código correlativo disponible revisando el valor numérico máximo guardado
export const obtenerSiguienteCodigo = async () => {
  try {
    const snap = await getDocs(collection(db, 'inventario'))
    if (snap.empty) return '001'
    let max = 0
    let maxStrLen = 3
    let hasLeadingZeros = false

    snap.docs.forEach(doc => {
      const c = doc.data().codigo
      if (c !== undefined && c !== null && c !== '') {
        const strVal = String(c).trim()
        const num = parseInt(strVal, 10)
        if (!isNaN(num) && num > max) {
          max = num
          if (strVal.startsWith('0') && strVal.length > 1) {
            hasLeadingZeros = true
            maxStrLen = strVal.length
          } else {
            maxStrLen = Math.max(maxStrLen, strVal.length)
          }
        }
      }
    })

    const siguienteNum = max + 1
    if (hasLeadingZeros && maxStrLen > 0) {
      return String(siguienteNum).padStart(maxStrLen, '0')
    }
    return String(siguienteNum)
  } catch (e) {
    console.warn('Error al calcular siguiente codigo:', e)
    return '001'
  }
}

const CATEGORIAS  = ['Maquinarias','Equipos','Repuestos','Materiales','Insumos']
const EMPRESAS    = ['SAJAMA S.R.L.', 'RUNXINCORP S.R.L.', 'GOLDEN SHIELD S.R.L.', 'EMPRESA JIM ALEX', 'SUPERCADENA']
const UNIDADES    = ['unidad','par','juego','litro','balde','caja','rollo','metro','kg','pieza']
const UBICACIONES = [
  'Estante A',
  'Estante B',
  'Estante C',
  'Estante D',
  'Estante E',
  'Estante F',
  'Estante G',
  'Estante H',
  'Bodega 1',
  'Bodega 2',
  'Piso',
  'Otro'
]

export default function FormItem({ item, onGuardar, onCancelar }) {
  const { register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting } } = useForm()
  const [fotoPreview,  setFotoPreview]  = useState(null)
  const [fotoFile,     setFotoFile]     = useState(null)
  const [subiendo,     setSubiendo]     = useState(false)
  const [traduciendoD, setTraduciendoD] = useState(false)
  const fileRef   = useRef()
  const timerDesc = useRef()

  // Stock con el que abrió el modal, para poder comparar y avisar si se está ajustando manualmente
  const stockOriginal = item?.stock ?? 0
  const stockActual = watch('stock')
  const stockCambiado = item && stockActual !== undefined && Number(stockActual) !== Number(stockOriginal)

  const { escuchando, activar, desactivar } = useScannerQR(async (textoQR) => {
    const parsed = parsearQR(textoQR)
    if (!parsed) { toast.error('QR no reconocido'); return }

    // El QR contiene: serie (ej: 11212087) y descripcion (ej: RETEN 130 X 120 X 7)
    if (parsed.serie)       setValue('serie',       parsed.serie)
    if (parsed.descripcion) setValue('descripcion', parsed.descripcion)

    // Obtener siguiente código correlativo automáticamente
    const siguienteCodigo = await obtenerSiguienteCodigo()
    setValue('codigo', siguienteCodigo)

    toast.success('QR leído: ' + parsed.descripcion + ' — Código asignado: ' + siguienteCodigo)
    toast('Revisa y completa los campos restantes antes de guardar', { icon: 'ℹ️', duration: 3000 })

    // Autotraducir descripcion al chino
    if (parsed.descripcion && parsed.descripcion.length > 2) {
      setTraduciendoD(true)
      try {
        const zh = await traducirAlChino(parsed.descripcion)
        if (zh) setValue('descripcionZh', zh)
      } finally { setTraduciendoD(false) }
    }
    desactivar()
  })

  useEffect(() => {
    if (item) {
      reset({ empresa: 'SAJAMA S.R.L.', ...item })
      setFotoPreview(item.fotoUrl || null)
    } else {
      // Calcular automáticamente el código correlativo de forma inmediata al abrir el modal para nuevo ítem
      obtenerSiguienteCodigo().then(siguienteCod => {
        reset({
          codigo: siguienteCod,
          descripcion: '',
          descripcionZh: '',
          modelo: '',
          serie: '',
          categoria: 'Repuestos',
          empresa: 'SAJAMA S.R.L.',
          unidad: 'unidad',
          precio: '',
          stockMin: 5,
          stockInicial: 0,
          ubicacion: '',
          notas: ''
        })
      })
      setFotoPreview(null)
      setFotoFile(null)
    }
  }, [item, reset])

  const handleDescChange = (e) => {
    const texto = e.target.value
    clearTimeout(timerDesc.current)
    if (texto.trim().length < 3) return
    timerDesc.current = setTimeout(async () => {
      setTraduciendoD(true)
      try {
        const zh = await traducirAlChino(texto)
        if (zh) setValue('descripcionZh', zh)
      } finally { setTraduciendoD(false) }
    }, 900)
  }

  const handleFoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Máximo 5MB'); return }
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  const onSubmit = async (data) => {
    let fotoUrl = item?.fotoUrl || null
    if (fotoFile) {
      setSubiendo(true)
      try {
        const storageRef = ref(storage, 'items/' + data.codigo + '_' + Date.now())
        await uploadBytes(storageRef, fotoFile)
        fotoUrl = await getDownloadURL(storageRef)
      } catch (e) { console.warn('Error foto:', e.message) }
      finally { setSubiendo(false) }
    }
    await onGuardar({ ...data, fotoUrl })
  }

  const traducirManual = async () => {
    const desc = watch('descripcion')
    if (!desc) return
    setTraduciendoD(true)
    try {
      const zh = await traducirAlChino(desc)
      if (zh) setValue('descripcionZh', zh)
    } finally { setTraduciendoD(false) }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {!item && (
        <div className={"flex items-center gap-3 p-3 rounded-xl border-2 transition-all " + (escuchando ? 'border-primary bg-primary-pale' : 'border-dashed border-gray-300 bg-gray-50')}>
          <div className={"w-10 h-10 rounded-full flex items-center justify-center shrink-0 " + (escuchando ? 'bg-primary animate-pulse' : 'bg-gray-200')}>
            <Scan size={18} className={escuchando ? 'text-white' : 'text-gray-500'}/>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">
              {escuchando ? 'Scanner activo — escanea el QR del producto' : 'Autocompletar desde QR'}
            </p>
            <p className="text-xs text-gray-400">
              {escuchando ? 'Código y descripción se llenarán automáticamente' : 'Activa el scanner para leer el QR'}
            </p>
          </div>
          <button type="button" onClick={escuchando ? desactivar : activar}
            className={escuchando ? 'btn-danger btn-sm' : 'btn-secondary btn-sm'}>
            <Scan size={13}/> {escuchando ? 'Cancelar' : 'Activar Scanner'}
          </button>
        </div>
      )}

      <div className="flex items-start gap-4">
        <div>
          <p className="label mb-2">Foto del producto</p>
          <div onClick={() => fileRef.current.click()}
            className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary cursor-pointer flex items-center justify-center overflow-hidden bg-gray-50 transition-colors relative group">
            {fotoPreview
              ? <><img src={fotoPreview} alt="preview" className="w-full h-full object-cover"/>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Image size={20} className="text-white"/>
                  </div></>
              : <div className="text-center text-gray-400">
                  <Image size={24} className="mx-auto mb-1"/>
                  <p className="text-xs">Clic para subir</p>
                </div>
            }
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFoto}/>
          {fotoPreview && (
            <button type="button" onClick={() => { setFotoPreview(null); setFotoFile(null) }}
              className="mt-1 text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
              <X size={11}/> Quitar
            </button>
          )}
        </div>

        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Código *</label>
              <input className="input font-mono font-bold text-gray-900" type="text" placeholder="Ej: 001"
                {...register('codigo', { required: 'Requerido' })}/>
              {errors.codigo && <p className="text-red-500 text-xs mt-1">{errors.codigo.message}</p>}
            </div>
            <div>
              <label className="label">Categoría *</label>
              <select className="input" {...register('categoria', { required: 'Requerido' })}>
                <option value="">Seleccionar...</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.categoria && <p className="text-red-500 text-xs mt-1">{errors.categoria.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label font-semibold text-gray-700">Empresa *</label>
              <select className="input font-medium text-gray-900 border-primary/40" {...register('empresa')}>
                {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Unidad *</label>
              <select className="input" {...register('unidad', { required: true })}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Precio (Bs)</label>
              <input className="input" type="number" step="0.01"
                {...register('precio', { valueAsNumber: true })}/>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="label">Descripción en Español *</label>
        <input className="input" placeholder="Descripción completa del ítem"
          {...register('descripcion', { required: 'Requerido', onChange: handleDescChange })}/>
        {errors.descripcion && <p className="text-red-500 text-xs mt-1">{errors.descripcion.message}</p>}
      </div>

      <div>
        <label className="label flex items-center gap-2">
          Descripción en Chino Simplificado
          <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-medium">中文</span>
          {traduciendoD
            ? <span className="flex items-center gap-1 text-xs text-primary-light">
                <Loader2 size={12} className="animate-spin"/> Traduciendo...
              </span>
            : <button type="button" onClick={traducirManual}
                className="flex items-center gap-1 text-xs text-primary-light hover:text-primary transition-colors">
                <Languages size={12}/> Traducir
              </button>
          }
        </label>
        <input className="input" placeholder="Se completa automáticamente..."
          {...register('descripcionZh')}/>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Modelo</label>
          <input className="input" placeholder="Ej: 8PK1068" {...register('modelo')}/>
        </div>
        <div>
          <label className="label">N de Serie</label>
          <input className="input" placeholder="Opcional" {...register('serie')}/>
        </div>
        <div>
          <label className="label">Stock mínimo</label>
          <input className="input" type="number" {...register('stockMin', { valueAsNumber: true })}/>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label flex items-center gap-1">
            <MapPin size={13} className="text-primary-light"/> Ubicación
          </label>
          <select className="input" {...register('ubicacion')}>
            <option value="">Seleccionar...</option>
            {UBICACIONES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        {!item && (
          <div>
            <label className="label">Stock inicial</label>
            <input className="input" type="number" {...register('stockInicial', { valueAsNumber: true })}/>
          </div>
        )}

        {item && (
          <div>
            <label className="label flex items-center gap-1">
              <PackageSearch size={13} className="text-primary-light"/> Stock actual
            </label>
            <input className="input" type="number"
              {...register('stock', { valueAsNumber: true, min: { value: 0, message: 'No puede ser negativo' } })}/>
            {errors.stock && <p className="text-red-500 text-xs mt-1">{errors.stock.message}</p>}
            {stockCambiado && (
              <p className="text-xs text-yellow-700 bg-yellow-50 rounded-md px-2 py-1 mt-1">
                Ajuste manual: {stockOriginal} → {stockActual}. Se registrará en auditoría.
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="label">Notas</label>
        <textarea className="input resize-none" rows={2} {...register('notas')}/>
      </div>

      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancelar} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={isSubmitting || subiendo} className="btn-primary">
          {subiendo ? 'Subiendo foto...' : isSubmitting ? 'Guardando...' :
           item ? 'Actualizar ítem' : 'Crear ítem'}
        </button>
      </div>
    </form>
  )
}
