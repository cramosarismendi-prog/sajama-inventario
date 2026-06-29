import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { db } from '../services/firebase'
import { traducirAlChino } from '../services/traduccion'
import { registrarAccion } from '../services/auditoria'
import {
  collection, query, where, getDocs, addDoc, updateDoc,
  doc, serverTimestamp, increment, orderBy
} from 'firebase/firestore'
import { PageLoader } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import {
  Scan, Package, ArrowDownCircle, ArrowUpCircle,
  CheckCircle, AlertTriangle, Plus, History, Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ── Parsear texto del QR ─────────────────────────────────────────────
// Formato: 11212087_RETEN_保留  o  11212087_RETEN_????
// Extrae código y descripción ignorando la parte china/corrupta
const parsearQR = (texto) => {
  if (!texto) return null
  const limpio = texto.trim()

  // Separar por _ o espacios
  const partes = limpio.split(/[_\s]+/).filter(Boolean)
  if (partes.length === 0) return null

  // Primera parte: código (puede ser número o alfanumérico)
  const codigo = partes[0]

  // Segunda parte: descripción en español (ignorar todo lo que no sea ASCII legible)
  const descRaw = partes.slice(1)
    .map(p => p.replace(/[^\x20-\x7E]/g, '').trim())
    .filter(p => p.length > 0)
    .join(' ')

  const descripcion = descRaw.trim()

  // Código numérico
  const codigoNum = Number(codigo)
  const codigoFinal = isNaN(codigoNum) ? codigo : codigoNum

  return { codigo: codigoFinal, descripcion: descripcion || codigo }
}

const CATEGORIAS = ['Maquinarias','Equipos','Repuestos','Materiales','Insumos']

export default function ScannerQR() {
  const { perfil } = useAuth()
  const inputRef   = useRef()
  const bufferRef  = useRef('')
  const timerRef   = useRef()

  const [escuchando,  setEscuchando]  = useState(false)
  const [itemLeido,   setItemLeido]   = useState(null)   // ítem encontrado/creado
  const [qrRaw,       setQrRaw]       = useState('')     // texto crudo del QR
  const [modalAccion, setModalAccion] = useState(false)  // modal ingreso/salida
  const [accion,      setAccion]      = useState('')     // 'ingreso' | 'salida'
  const [cantidad,    setCantidad]    = useState(1)
  const [procesando,  setProcesando]  = useState(false)
  const [historial,   setHistorial]   = useState([])
  const [modalNuevo,  setModalNuevo]  = useState(false)  // modal crear ítem nuevo
  const [nuevoItem,   setNuevoItem]   = useState({})

  // ── Activar escucha del scanner ──────────────────────────────────
  const activarScanner = () => {
    setEscuchando(true)
    setTimeout(() => inputRef.current?.focus(), 100)
    toast('Scanner activado — escanea un QR', { icon: '📡', duration: 2000 })
  }

  const desactivarScanner = () => {
    setEscuchando(false)
    bufferRef.current = ''
    toast('Scanner desactivado', { duration: 1500 })
  }

  // ── Procesar input del scanner ────────────────────────────────────
  // El scanner actúa como teclado: envía caracteres + Enter al final
  const handleKeyDown = useCallback((e) => {
    if (!escuchando) return

    if (e.key === 'Enter') {
      const texto = bufferRef.current.trim()
      bufferRef.current = ''
      if (texto.length > 2) procesarQR(texto)
      return
    }

    // Acumular caracteres (ignorar teclas especiales)
    if (e.key.length === 1) {
      bufferRef.current += e.key
    }

    // Auto-procesar si hay pausa de 300ms (algunos scanners no envían Enter)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const texto = bufferRef.current.trim()
      bufferRef.current = ''
      if (texto.length > 2) procesarQR(texto)
    }, 400)
  }, [escuchando])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ── Procesar el QR leído ─────────────────────────────────────────
  const procesarQR = async (textoQR) => {
    setQrRaw(textoQR)
    setProcesando(true)
    toast.loading('Buscando ítem...', { id: 'scan' })

    try {
      const parsed = parsearQR(textoQR)
      if (!parsed) {
        toast.error('QR no reconocido', { id: 'scan' })
        setProcesando(false)
        return
      }

      // Buscar en Firestore por código
      const q = query(
        collection(db, 'inventario'),
        where('codigo', '==', parsed.codigo)
      )
      const snap = await getDocs(q)

      if (!snap.empty) {
        // ── Ítem encontrado ──────────────────────────────────────
        const itemDoc = snap.docs[0]
        const item = { id: itemDoc.id, ...itemDoc.data() }
        setItemLeido(item)
        toast.success(`Encontrado: ${item.descripcion}`, { id: 'scan' })
        setModalAccion(true)
      } else {
        // ── Ítem NO existe → preguntar si crear ──────────────────
        toast.dismiss('scan')
        // Autocompletar descripción ZH desde diccionario
        const descZh = parsed.descripcion ? await traducirAlChino(parsed.descripcion) : ''
        setNuevoItem({
          codigo:        parsed.codigo,
          descripcion:   parsed.descripcion,
          descripcionZh: descZh,
          categoria:     'Repuestos',
          unidad:        'unidad',
          stock:         0,
          stockMin:      5,
          precio:        0,
          notas:         '',
          ubicacion:     '',
        })
        setModalNuevo(true)
      }
    } catch (e) {
      toast.error('Error: ' + e.message, { id: 'scan' })
    } finally {
      setProcesando(false)
    }
  }

  // ── Confirmar ingreso o salida ───────────────────────────────────
  const confirmarAccion = async () => {
    if (!itemLeido || !accion || cantidad < 1) return
    setProcesando(true)
    try {
      const delta = accion === 'ingreso' ? Number(cantidad) : -Number(cantidad)

      if (accion === 'salida' && (itemLeido.stock || 0) < Number(cantidad)) {
        toast.error(`Stock insuficiente. Disponible: ${itemLeido.stock || 0}`)
        setProcesando(false)
        return
      }

      // Actualizar stock
      await updateDoc(doc(db, 'inventario', itemLeido.id), {
        stock: increment(delta),
        ...(accion === 'salida' ? { totalSalidas: increment(Number(cantidad)) } : {}),
        actualizadoEn: serverTimestamp(),
        actualizadoPor: perfil?.nombre,
      })

      // Registrar en colección de movimientos
      await addDoc(collection(db, accion === 'ingreso' ? 'ingresos' : 'salidas'), {
        itemId:          itemLeido.id,
        itemCodigo:      itemLeido.codigo,
        itemDescripcion: itemLeido.descripcion,
        cantidad:        Number(cantidad),
        estado:          accion === 'ingreso' ? 'confirmado' : 'aprobado',
        fuente:          accion === 'ingreso' ? 'scanner_qr' : undefined,
        destino:         accion === 'salida'  ? 'scanner_qr' : undefined,
        creadoPor:       perfil?.nombre,
        solicitante:     perfil?.nombre,
        autorizadoPor:   perfil?.nombre,
        creadoEn:        serverTimestamp(),
      })

      // Auditoría
      await registrarAccion({
        usuario: perfil?.nombre, rol: perfil?.rol,
        modulo: 'Scanner QR',
        accion: accion === 'ingreso' ? 'CREAR' : 'APROBAR',
        detalle: `Scanner QR: ${accion} de ${cantidad} x [${itemLeido.codigo}] ${itemLeido.descripcion}`,
      })

      // Agregar al historial local
      setHistorial(prev => [{
        tipo:   accion,
        item:   itemLeido,
        cantidad: Number(cantidad),
        hora:   new Date(),
      }, ...prev].slice(0, 20))

      toast.success(`${accion === 'ingreso' ? '✅ Ingreso' : '📤 Salida'} registrado: ${cantidad} x ${itemLeido.descripcion}`)
      setModalAccion(false)
      setItemLeido(null)
      setAccion('')
      setCantidad(1)

    } catch (e) {
      toast.error('Error: ' + e.message)
    } finally {
      setProcesando(false)
    }
  }

  // ── Crear ítem nuevo desde QR ────────────────────────────────────
  const crearItemNuevo = async () => {
    if (!nuevoItem.descripcion) return
    setProcesando(true)
    try {
      const ref = await addDoc(collection(db, 'inventario'), {
        ...nuevoItem,
        totalSalidas:  0,
        fotoUrl:       null,
        creadoEn:      serverTimestamp(),
        creadoPor:     perfil?.nombre,
        actualizadoEn: serverTimestamp(),
      })
      await registrarAccion({
        usuario: perfil?.nombre, rol: perfil?.rol,
        modulo: 'Scanner QR', accion: 'CREAR',
        detalle: `Scanner QR: Creó nuevo ítem [${nuevoItem.codigo}] ${nuevoItem.descripcion}`,
        datosDespues: nuevoItem,
      })

      // Abrir modal de acción con el ítem recién creado
      const itemCreado = { id: ref.id, ...nuevoItem }
      setItemLeido(itemCreado)
      setModalNuevo(false)
      setModalAccion(true)
      toast.success(`Ítem creado: ${nuevoItem.descripcion}`)
    } catch (e) {
      toast.error('Error al crear: ' + e.message)
    } finally {
      setProcesando(false)
    }
  }

  // ── Input oculto para capturar el scanner ────────────────────────
  const handleInputChange = (e) => {
    // Algunos scanners llenan un input directamente
    const val = e.target.value
    if (val.includes('\n') || val.length > 5) {
      const texto = val.replace(/\n/g, '').trim()
      e.target.value = ''
      if (texto.length > 2) procesarQR(texto)
    }
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2">
            <Scan size={22} className="text-primary"/> Lector QR / 扫码器
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Escanea el QR de un producto para registrar ingreso o salida
          </p>
        </div>
        <button
          onClick={escuchando ? desactivarScanner : activarScanner}
          className={escuchando ? 'btn-danger' : 'btn-primary'}>
          <Scan size={15}/>
          {escuchando ? 'Desactivar Scanner' : 'Activar Scanner'}
        </button>
      </div>

      {/* Input oculto para capturar scanner */}
      <input
        ref={inputRef}
        className="opacity-0 absolute w-0 h-0"
        onChange={handleInputChange}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Estado del scanner */}
      <div className={`card text-center py-10 border-2 transition-all ${
        escuchando ? 'border-primary bg-primary-pale' : 'border-gray-200 bg-gray-50'
      }`}>
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
          escuchando ? 'bg-primary animate-pulse' : 'bg-gray-200'
        }`}>
          <Scan size={36} className={escuchando ? 'text-white' : 'text-gray-400'}/>
        </div>
        {escuchando ? (
          <>
            <p className="font-bold text-primary text-lg">Scanner activo 📡</p>
            <p className="text-sm text-primary-light mt-1">Apunta el scanner al QR del producto</p>
            <p className="text-xs text-gray-400 mt-3 font-mono bg-white rounded-lg px-3 py-1 inline-block">
              {procesando ? 'Procesando...' : 'Esperando lectura...'}
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-gray-500 text-lg">Scanner inactivo</p>
            <p className="text-sm text-gray-400 mt-1">Haz clic en "Activar Scanner" para comenzar</p>
          </>
        )}
        {qrRaw && (
          <div className="mt-3 bg-white rounded-lg px-4 py-2 inline-block">
            <p className="text-xs text-gray-400">Último QR leído:</p>
            <p className="font-mono text-xs text-gray-600 mt-0.5">{qrRaw}</p>
          </div>
        )}
      </div>

      {/* Historial de escaneos */}
      {historial.length > 0 && (
        <div className="card">
          <h3 className="mb-3 flex items-center gap-2">
            <History size={16} className="text-gray-400"/> Historial de esta sesión
          </h3>
          <div className="space-y-2">
            {historial.map((h, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    h.tipo === 'ingreso' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {h.tipo === 'ingreso'
                      ? <ArrowDownCircle size={16} className="text-success"/>
                      : <ArrowUpCircle   size={16} className="text-danger"/>}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{h.item.descripcion}</p>
                    <p className="text-xs text-gray-400">
                      [{h.item.codigo}] · {format(h.hora, 'HH:mm:ss', { locale: es })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm ${h.tipo === 'ingreso' ? 'text-success' : 'text-danger'}`}>
                    {h.tipo === 'ingreso' ? '+' : '-'}{h.cantidad}
                  </p>
                  <p className="text-xs text-gray-400">{h.item.unidad}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL: Ingreso o Salida ── */}
      <Modal open={modalAccion} onClose={() => { setModalAccion(false); setItemLeido(null); setAccion(''); setCantidad(1) }}
        title="¿Qué deseas registrar? / 选择操作" size="md">
        {itemLeido && (
          <div className="space-y-4">
            {/* Info del ítem */}
            <div className="bg-primary-pale rounded-xl p-4">
              <div className="flex items-start gap-3">
                {itemLeido.fotoUrl
                  ? <img src={itemLeido.fotoUrl} className="w-14 h-14 rounded-lg object-cover shrink-0"/>
                  : <div className="w-14 h-14 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                      <Package size={24} className="text-primary"/>
                    </div>
                }
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-primary">{itemLeido.descripcion}</p>
                  {itemLeido.descripcionZh && <p className="text-gray-500 text-sm">{itemLeido.descripcionZh}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    Código: <span className="font-mono font-bold">{itemLeido.codigo}</span>
                    {itemLeido.modelo && ` · Modelo: ${itemLeido.modelo}`}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge tipo={itemLeido.stock > 0 ? 'green' : 'red'}>
                      Stock: {itemLeido.stock ?? 0} {itemLeido.unidad}
                    </Badge>
                    {itemLeido.categoria && <Badge tipo="blue">{itemLeido.categoria}</Badge>}
                  </div>
                </div>
              </div>
            </div>

            {/* Selección de acción */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAccion('ingreso')}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  accion === 'ingreso'
                    ? 'border-success bg-green-50'
                    : 'border-gray-200 hover:border-success hover:bg-green-50'
                }`}>
                <ArrowDownCircle size={24} className="text-success mb-2"/>
                <p className="font-bold text-green-800">Ingreso / 入库</p>
                <p className="text-xs text-gray-500 mt-1">Agregar stock al inventario</p>
              </button>
              <button
                onClick={() => setAccion('salida')}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  accion === 'salida'
                    ? 'border-danger bg-red-50'
                    : 'border-gray-200 hover:border-danger hover:bg-red-50'
                }`}>
                <ArrowUpCircle size={24} className="text-danger mb-2"/>
                <p className="font-bold text-red-800">Salida / 出库</p>
                <p className="text-xs text-gray-500 mt-1">Descontar stock del inventario</p>
              </button>
            </div>

            {/* Cantidad */}
            {accion && (
              <div>
                <label className="label">Cantidad / 数量</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setCantidad(p => Math.max(1, p - 1))}
                    className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 font-bold text-lg flex items-center justify-center">−</button>
                  <input type="number" min="1"
                    max={accion === 'salida' ? itemLeido.stock : undefined}
                    className="input text-center text-xl font-bold w-24"
                    value={cantidad} onChange={e => setCantidad(Number(e.target.value))}/>
                  <button onClick={() => setCantidad(p => p + 1)}
                    className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 font-bold text-lg flex items-center justify-center">+</button>
                  <span className="text-gray-500 text-sm">{itemLeido.unidad}</span>
                </div>
                {accion === 'salida' && cantidad > (itemLeido.stock || 0) && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertTriangle size={12}/> Supera el stock disponible ({itemLeido.stock || 0})
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
              <button onClick={() => { setModalAccion(false); setAccion(''); setCantidad(1) }}
                className="btn-secondary">Cancelar</button>
              <button onClick={confirmarAccion}
                disabled={!accion || procesando || cantidad < 1 || (accion === 'salida' && cantidad > (itemLeido.stock || 0))}
                className={accion === 'ingreso' ? 'btn-success' : 'btn-danger'}>
                {procesando ? 'Registrando...' : `Confirmar ${accion === 'ingreso' ? 'Ingreso' : 'Salida'}`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL: Ítem nuevo ── */}
      <Modal open={modalNuevo} onClose={() => setModalNuevo(false)}
        title="Ítem nuevo — No existe en inventario / 新项目" size="lg">
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2 text-yellow-800 text-sm">
            <AlertTriangle size={16} className="shrink-0"/>
            Este código no existe en el inventario. Completa los datos para crearlo.
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Código</label>
              <input className="input font-mono bg-gray-50" readOnly value={nuevoItem.codigo || ''}/>
            </div>
            <div>
              <label className="label">Categoría</label>
              <select className="input" value={nuevoItem.categoria || 'Repuestos'}
                onChange={e => setNuevoItem(p => ({...p, categoria: e.target.value}))}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Descripción en Español</label>
            <input className="input" value={nuevoItem.descripcion || ''}
              onChange={e => setNuevoItem(p => ({...p, descripcion: e.target.value}))}/>
          </div>

          <div>
            <label className="label flex items-center gap-2">
              Descripción en Chino
              <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full">中文</span>
            </label>
            <input className="input" value={nuevoItem.descripcionZh || ''}
              onChange={e => setNuevoItem(p => ({...p, descripcionZh: e.target.value}))}
              placeholder="Autocompletado desde diccionario local"/>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Modelo</label>
              <input className="input" value={nuevoItem.modelo || ''}
                onChange={e => setNuevoItem(p => ({...p, modelo: e.target.value}))}/>
            </div>
            <div>
              <label className="label">Unidad</label>
              <select className="input" value={nuevoItem.unidad || 'unidad'}
                onChange={e => setNuevoItem(p => ({...p, unidad: e.target.value}))}>
                {['unidad','par','juego','litro','balde','caja','rollo','metro','kg'].map(u =>
                  <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Stock mínimo</label>
              <input type="number" className="input" value={nuevoItem.stockMin || 5}
                onChange={e => setNuevoItem(p => ({...p, stockMin: Number(e.target.value)}))}/>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button onClick={() => setModalNuevo(false)} className="btn-secondary">Cancelar</button>
            <button onClick={crearItemNuevo} disabled={procesando || !nuevoItem.descripcion}
              className="btn-primary">
              <Plus size={14}/> {procesando ? 'Creando...' : 'Crear ítem y continuar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
