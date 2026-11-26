import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { db, storage } from '../services/firebase'
import { registrarAccion } from '../services/auditoria'
import { traducirAlChino } from '../services/traduccion'
import {
  collection, doc, setDoc, updateDoc, deleteDoc, addDoc,
  query, orderBy, onSnapshot, serverTimestamp, limit, where
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { PageLoader } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'
import { ModalVerFotoZoom } from '../components/ui/ModalVerFotoZoom'
import { EmptyState } from '../components/ui/EmptyState'
import { Confirm } from '../components/ui/Confirm'
import {
  Plus, Edit2, Trash2, Truck, Image as ImageIcon, Printer,
  Loader2, CheckSquare, Square, Languages, Tag, FileText,
  Paperclip, ExternalLink, History, DollarSign, Search, ShoppingBag, RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { obtenerCotizacionUSD, suscribirCotizacionUSD } from '../services/cotizacion'

const UNIDADES = ['Volqueta', 'Excavadora', 'Pala', 'Retroexcavadora', 'Uni', 'Juego', 'Litro', 'Caja', 'Par', 'Kg']

const EMPRESAS = [
  'SAJAMA S.R.L.',
  'RUNXINCORP S.R.L.',
  'GOLDEN SHIELD S.R.L.',
  'EMPRESA JIM ALEX',
  'SUPERCADENA'
]

const ESTADOS = [
  { id: 'A la venta',      label: 'A la venta',      labelZh: '待售',      color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { id: 'En operación',    label: 'En operación',    labelZh: '运行中',    color: 'bg-[#16241F] text-[#E4D825] border-[#233830]' },
  { id: 'En mantenimiento',label: 'En mantenimiento',labelZh: '维修中',    color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'Vendido',         label: 'Vendido',         labelZh: '已售',      color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'Despachado',      label: 'Despachado',      labelZh: '已派送',    color: 'bg-[#EDF1EF] text-[#16241F] border-[#CBD4CF]' },
  { id: 'Entregado',       label: 'Entregado',       labelZh: '已交付',    color: 'bg-teal-100 text-teal-800 border-teal-300' },
  { id: 'Existente',       label: 'Existente',       labelZh: '在库',      color: 'bg-slate-100 text-slate-800 border-slate-300' }
]

// ── Selector de foto individual ──────────────────────────────────────
function CampoFoto({ label, urlActual, archivoSeleccionado, onSeleccionar }) {
  const inputId = 'foto-' + label.replace(/\s+/g, '-')
  const preview = archivoSeleccionado ? URL.createObjectURL(archivoSeleccionado) : urlActual
  return (
    <div>
      <label className="label">{label}</label>
      <div
        onClick={() => document.getElementById(inputId).click()}
        className="w-full h-32 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary cursor-pointer flex items-center justify-center overflow-hidden bg-gray-50 transition-colors relative">
        {preview
          ? <img src={preview} alt={label} className="w-full h-full object-cover"/>
          : <div className="text-center text-gray-400">
              <ImageIcon size={22} className="mx-auto mb-1"/>
              <p className="text-xs">Clic para subir foto</p>
            </div>
        }
      </div>
      <input id={inputId} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files[0]) onSeleccionar(e.target.files[0]) }} />
    </div>
  )
}

// ── Formulario de ficha de máquina ────────────────────────────────────
function FormMaquina({ maquina, onGuardar, onCancelar }) {
  const [empresa,   setEmpresa]   = useState(maquina?.empresa || 'SAJAMA S.R.L.')
  const [nombreEs,  setNombreEs]  = useState(maquina?.nombreEs || '')
  const [nombreZh,  setNombreZh]  = useState(maquina?.nombreZh || '')
  const [modelo,    setModelo]    = useState(maquina?.modelo || '')
  const [serie,     setSerie]     = useState(maquina?.serie || '') // Chasis / Placa
  const [tipoCambio, setTipoCambio] = useState(maquina?.tipoCambio || 12.58)
  const initialUsd = maquina?.precioUsd ? String(maquina.precioUsd) : (maquina?.precio ? (Number(maquina.precio) / (maquina?.tipoCambio || 12.58)).toFixed(2) : '')
  const initialBs = maquina?.precio ? String(maquina.precio) : (initialUsd ? (Number(initialUsd) * (maquina?.tipoCambio || 12.58)).toFixed(2) : '')
  const [precioUsd, setPrecioUsd] = useState(initialUsd)
  const [precio,    setPrecio]    = useState(initialBs)
  const [unidad,    setUnidad]    = useState(maquina?.unidad || 'Volqueta')
  const [estado,    setEstado]    = useState(maquina?.estado || 'A la venta')
  const [numPoliza, setNumPoliza] = useState(maquina?.numPoliza || '')
  const [fecha,     setFecha]     = useState(maquina?.fecha || format(new Date(), 'yyyy-MM-dd'))
  const [observaciones, setObservaciones] = useState(maquina?.observaciones || '')
  const [fotoMaquina, setFotoMaquina] = useState(null)
  const [fotoPlaca,   setFotoPlaca]   = useState(null)
  const [archivoPoliza, setArchivoPoliza] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [traduciendo, setTraduciendo] = useState(false)
  const [error, setError] = useState('')
  const timerRef = useRef(null)

  useEffect(() => {
    obtenerCotizacionUSD().then(tc => {
      if (tc) {
        setTipoCambio(tc)
        if (precioUsd) {
          setPrecio((Number(precioUsd) * tc).toFixed(2))
        } else if (precio) {
          setPrecioUsd((Number(precio) / tc).toFixed(2))
        }
      }
    })
  }, [maquina])

  const handlePrecioUsdChange = (val) => {
    setPrecioUsd(val)
    if (val === '') { setPrecio(''); return }
    const num = parseFloat(val)
    if (!isNaN(num)) {
      setPrecio((num * tipoCambio).toFixed(2))
    }
  }

  const handlePrecioBsChange = (val) => {
    setPrecio(val)
    if (val === '') { setPrecioUsd(''); return }
    const num = parseFloat(val)
    if (!isNaN(num)) {
      setPrecioUsd((num / tipoCambio).toFixed(2))
    }
  }

  const handleNombreEsChange = (e) => {
    const val = e.target.value
    setNombreEs(val)
    clearTimeout(timerRef.current)
    if (val.trim().length < 2) return
    timerRef.current = setTimeout(async () => {
      setTraduciendo(true)
      try {
        const zh = await traducirAlChino(val)
        if (zh) setNombreZh(zh)
      } finally { setTraduciendo(false) }
    }, 700)
  }

  const handleTraducirManual = async () => {
    if (!nombreEs.trim()) return
    setTraduciendo(true)
    try {
      const zh = await traducirAlChino(nombreEs)
      if (zh) setNombreZh(zh)
    } finally { setTraduciendo(false) }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!nombreEs.trim()) { setError('El nombre en español es requerido'); return }
    setGuardando(true)
    try {
      await onGuardar({
        empresa,
        nombreEs: nombreEs.trim(), nombreZh: nombreZh.trim(), modelo: modelo.trim(),
        serie: serie.trim(), precioUsd: Number(precioUsd) || 0, precio: Number(precio) || 0,
        tipoCambio, unidad, estado, numPoliza: numPoliza.trim(), fecha,
        observaciones: observaciones.trim(),
        fotoMaquina, fotoPlaca, archivoPoliza,
      })
    } finally { setGuardando(false) }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <CampoFoto label="Foto de la máquina" urlActual={maquina?.fotoMaquinaUrl}
          archivoSeleccionado={fotoMaquina} onSeleccionar={setFotoMaquina} />
        <CampoFoto label="Foto de la placa / serie" urlActual={maquina?.fotoPlacaUrl}
          archivoSeleccionado={fotoPlaca} onSeleccionar={setFotoPlaca} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Nombre en Español *</label>
          <input className="input" value={nombreEs} onChange={handleNombreEsChange}
            placeholder="Ej: Excavadora CAT" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label">
              Nombre en Chino {traduciendo && <span className="text-xs text-primary font-normal">(traduciendo...)</span>}
            </label>
            <button type="button" onClick={handleTraducirManual} className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1">
              <Languages size={12}/> Traducir
            </button>
          </div>
          <input className="input" value={nombreZh} onChange={e => setNombreZh(e.target.value)}
            placeholder="Ej: 卡特挖掘机" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="label font-bold text-gray-700">Empresa *</label>
          <select className="input font-semibold text-gray-900 border-primary/40" value={empresa} onChange={e => setEmpresa(e.target.value)}>
            {EMPRESAS.map(emp => <option key={emp} value={emp}>{emp}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Modelo</label>
          <input className="input" value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Ej: 336D" />
        </div>
        <div>
          <label className="label">Chasis / Placa</label>
          <input className="input" value={serie} onChange={e => setSerie(e.target.value)} placeholder="Ej: CAT0336DVHBK10311" />
        </div>
        <div>
          <label className="label">Unidad</label>
          <select className="input" value={unidad} onChange={e => setUnidad(e.target.value)}>
            {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="label">Estado</label>
          <select className="input text-xs" value={estado} onChange={e => setEstado(e.target.value)}>
            {ESTADOS.map(est => <option key={est.id} value={est.id}>{est.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Precio ($ USD)</label>
          <input className="input text-xs font-semibold text-emerald-700" type="number" min="0" step="0.01" value={precioUsd} onChange={e => handlePrecioUsdChange(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="label">Precio (Bs)</label>
          <input className="input text-xs font-semibold" type="number" min="0" step="0.01" value={precio} onChange={e => handlePrecioBsChange(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="label">T. Cambio (BCB)</label>
          <input className="input text-xs font-mono bg-gray-50" type="number" step="0.01" value={tipoCambio} onChange={e => setTipoCambio(parseFloat(e.target.value)||12.58)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">N° de Póliza</label>
          <input className="input" value={numPoliza} onChange={e => setNumPoliza(e.target.value)} placeholder="Ej: POL-2026-889" />
        </div>
        <div>
          <label className="label">Póliza PDF</label>
          <div className="flex items-center gap-2 mt-1">
            <input id="pdf-poliza-maquina" type="file" accept="application/pdf" className="hidden"
              onChange={e => {
                const f = e.target.files[0]
                if (f) {
                  if (f.type !== 'application/pdf') return toast.error('Solo se permiten archivos PDF')
                  setArchivoPoliza(f)
                }
              }} />
            <label htmlFor="pdf-poliza-maquina" className="btn-secondary btn-sm cursor-pointer whitespace-nowrap">
              <Paperclip size={13}/> {archivoPoliza || maquina?.polizaUrl ? 'Cambiar PDF' : 'Adjuntar PDF'}
            </label>
            {(archivoPoliza || maquina?.polizaUrl) && (
              <span className="text-xs text-gray-500 truncate max-w-[130px]" title={archivoPoliza?.name || maquina?.polizaNombre || 'Póliza PDF'}>
                {archivoPoliza?.name || maquina?.polizaNombre || 'Póliza PDF'}
              </span>
            )}
            {maquina?.polizaUrl && !archivoPoliza && (
              <a href={maquina.polizaUrl} target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors" title="Ver PDF actual">
                <ExternalLink size={14}/>
              </a>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="label">Observaciones</label>
        <textarea className="input resize-none" rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)} />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancelar} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={guardando} className="btn-primary">
          {guardando ? <><Loader2 size={14} className="animate-spin inline mr-1"/> Guardando...</> : maquina ? 'Actualizar' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

// ── Formulario de datos de transporte (previo a imprimir) ─────────────
function FormTransporte({ maquinasSeleccionadas = [], cotizacionActual, onImprimir, onCancelar, onVerFoto }) {
  const [placaCamion, setPlacaCamion] = useState('')
  const [conductorNombre, setConductorNombre] = useState('')
  const [conductorTelefono, setConductorTelefono] = useState('')
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [enviaNombre, setEnviaNombre] = useState('')
  const [enviaTelefono, setEnviaTelefono] = useState('')
  const [destino, setDestino] = useState('')
  const [descripcionCargos, setDescripcionCargos] = useState('')
  const [clienteFirma, setClienteFirma] = useState('')
  
  // Estado / Acción de movimiento (Vendido, Despachado, Entregado)
  const [estadoOperacion, setEstadoOperacion] = useState('Despachado')
  
  // Tipo de cambio de dólar del día (por defecto cotización BCB en tiempo real)
  const [tipoCambioDolar, setTipoCambioDolar] = useState(cotizacionActual || 12.58)

  useEffect(() => {
    if (cotizacionActual) setTipoCambioDolar(cotizacionActual)
  }, [cotizacionActual])

  const montoTotalUsd = maquinasSeleccionadas.reduce((a, m) => {
    const usd = m.precioUsd ? Number(m.precioUsd) : (m.precio ? Number(m.precio) / tipoCambioDolar : 0)
    return a + usd
  }, 0)
  const montoTotalBs = montoTotalUsd * tipoCambioDolar

  return (
    <div className="space-y-4">
      {/* Recuadro de Resumen Comercial y Tipo de Cambio BCB del Día */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white rounded-xl p-4 shadow-md space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-emerald-600/40 pb-2">
          <div className="flex items-center gap-2">
            <DollarSign size={20} className="text-yellow-300"/>
            <span className="font-extrabold text-sm uppercase tracking-wide">Cotización y Valor de Venta (BCB)</span>
          </div>
          <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-lg border border-white/10">
            <span className="text-xs text-emerald-200 font-medium">1 USD =</span>
            <input
              type="number"
              step="0.01"
              className="w-20 bg-white text-gray-900 px-2 py-0.5 rounded text-xs font-mono font-bold text-center focus:outline-none"
              value={tipoCambioDolar}
              onChange={e => setTipoCambioDolar(parseFloat(e.target.value) || 12.58)}
            />
            <span className="text-xs text-yellow-300 font-bold">BOB (BCB)</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-emerald-200 block text-[11px]">Total en Bolivianos:</span>
            <span className="text-lg font-black text-white font-mono">{montoTotalBs.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs</span>
          </div>
          <div>
            <span className="text-emerald-200 block text-[11px]">Total Venta en Dólares ($ USD):</span>
            <span className="text-lg font-black text-yellow-300 font-mono">$ {montoTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
          </div>
        </div>
      </div>

      {/* Desglose de máquinas seleccionadas con fotos y ficha técnica */}
      <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3 max-h-60 overflow-y-auto space-y-3 text-xs">
        <p className="font-extrabold text-emerald-900 text-xs uppercase tracking-wider flex items-center justify-between">
          <span>Máquinas seleccionadas ({maquinasSeleccionadas.length}):</span>
          <span className="text-[10px] font-normal text-emerald-700">Con fotos de máquina, placa y datos completos</span>
        </p>
        {maquinasSeleccionadas.map(m => {
          const usd = m.precioUsd ? Number(m.precioUsd) : (m.precio ? Number(m.precio) / tipoCambioDolar : 0)
          const bs = usd * tipoCambioDolar
          return (
            <div key={m.id} className="bg-white p-3 rounded-lg border border-emerald-200 shadow-sm space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                    {m.empresa || 'SAJAMA S.R.L.'}
                  </span>
                  <span className="font-bold text-gray-900 text-sm">{m.nombreEs}</span>
                  {m.nombreZh && <span className="text-gray-500 font-medium text-xs">({m.nombreZh})</span>}
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-gray-800 font-bold">{bs.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs</span>
                  <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">$ {usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
                </div>
              </div>

              {/* Muestra de las 2 Fotos (Máquina y Placa/Serie) */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded border border-gray-200">
                  {m.fotoMaquinaUrl ? (
                    <img
                      src={m.fotoMaquinaUrl}
                      alt="Foto Máquina"
                      className="w-12 h-12 rounded object-cover border border-gray-300 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => onVerFoto && onVerFoto({
                        fotoUrl: m.fotoMaquinaUrl,
                        titulo: `${m.nombreEs} (Máquina)`,
                        subtitulo: `Modelo: ${m.modelo || '—'} | Serie: ${m.serie || '—'}`
                      })}
                      title="Haz clic para ampliar con zoom"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-[10px] shrink-0 text-center leading-tight">Sin Foto Máquina</div>
                  )}
                  <div className="text-[10px] leading-tight">
                    <span className="font-bold text-gray-700 block">Foto de la máquina</span>
                    <span className="text-gray-500 truncate block max-w-[120px]">{m.modelo ? `Mod: ${m.modelo}` : 'Vista general'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded border border-gray-200">
                  {m.fotoPlacaUrl ? (
                    <img
                      src={m.fotoPlacaUrl}
                      alt="Foto Placa"
                      className="w-12 h-12 rounded object-cover border border-gray-300 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => onVerFoto && onVerFoto({
                        fotoUrl: m.fotoPlacaUrl,
                        titulo: `${m.nombreEs} (Placa / Serie)`,
                        subtitulo: `Modelo: ${m.modelo || '—'} | Serie: ${m.serie || '—'}`
                      })}
                      title="Haz clic para ampliar con zoom"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-[10px] shrink-0 text-center leading-tight">Sin Foto Placa</div>
                  )}
                  <div className="text-[10px] leading-tight">
                    <span className="font-bold text-gray-700 block">Foto de placa / serie</span>
                    <span className="text-gray-500 font-mono block truncate max-w-[120px]">{m.serie || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Ficha resumida */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-gray-50/70 p-2 rounded border border-gray-100">
                <div><span className="text-gray-400 block text-[10px]">Modelo:</span> <span className="font-semibold text-gray-800">{m.modelo || '—'}</span></div>
                <div><span className="text-gray-400 block text-[10px]">Chasis / Serie:</span> <span className="font-mono font-semibold text-gray-800">{m.serie || '—'}</span></div>
                <div><span className="text-gray-400 block text-[10px]">Póliza Aduana:</span> <span className="font-semibold text-primary">{m.numPoliza || '—'}</span></div>
                <div><span className="text-gray-400 block text-[10px]">Unidad:</span> <span className="font-semibold text-gray-800">{m.unidad || 'Volqueta'}</span></div>
              </div>
              {m.observaciones && (
                <p className="text-[10px] text-gray-500 italic bg-gray-50 px-2 py-1 rounded">Obs: {m.observaciones}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Selección de Acción / Estado Final */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Estado de Operación *</label>
          <select
            className="input font-bold text-primary"
            value={estadoOperacion}
            onChange={e => setEstadoOperacion(e.target.value)}
          >
            <option value="Vendido">Vendido</option>
            <option value="Despachado">Despachado</option>
            <option value="Entregado">Entregado</option>
          </select>
        </div>
        <div><label className="label">Fecha de Salida / Venta</label>
          <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
        <div><label className="label">Placa de Camión</label>
          <input className="input" value={placaCamion} onChange={e => setPlacaCamion(e.target.value)} placeholder="Ej: 2342-KZR" /></div>
        <div><label className="label">Nombre del conductor</label>
          <input className="input" value={conductorNombre} onChange={e => setConductorNombre(e.target.value)} /></div>
        <div><label className="label">Teléfono del conductor</label>
          <input className="input" value={conductorTelefono} onChange={e => setConductorTelefono(e.target.value)} /></div>
        <div><label className="label">Nombre de quien envía (SAJAMA)</label>
          <input className="input" value={enviaNombre} onChange={e => setEnviaNombre(e.target.value)} /></div>
        <div><label className="label">Teléfono de quien envía</label>
          <input className="input" value={enviaTelefono} onChange={e => setEnviaTelefono(e.target.value)} /></div>
        <div><label className="label">Destino / Cliente</label>
          <input className="input" value={destino} onChange={e => setDestino(e.target.value)} placeholder="Ej: Mina San Cristóbal / Cliente Juan Pérez" /></div>
        <div><label className="label">Firma de Cliente / Recibido</label>
          <input className="input" value={clienteFirma} onChange={e => setClienteFirma(e.target.value)} /></div>
      </div>
      <div>
        <label className="label">Descripción de cargos</label>
        <textarea className="input resize-none" rows={2} value={descripcionCargos} onChange={e => setDescripcionCargos(e.target.value)} />
      </div>
      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button onClick={onCancelar} className="btn-secondary">Cancelar</button>
        <button onClick={() => onImprimir({
          placaCamion, conductorNombre, conductorTelefono, fecha,
          enviaNombre, enviaTelefono, destino, descripcionCargos, clienteFirma,
          estadoOperacion, tipoCambioDolar, montoTotalBs, montoTotalUsd
        })} className="btn-primary">
          <Printer size={14} className="inline mr-1"/> Generar, Actualizar Estado e Imprimir
        </button>
      </div>
    </div>
  )
}

// ── Formulario de Venta de Maquinaria ──────────────────────────────────
function FormVenta({ maquinasSeleccionadas = [], cotizacionActual, onImprimir, onCancelar, onVerFoto }) {
  const [compradorNombre, setCompradorNombre] = useState('')
  const [compradorCiNit, setCompradorCiNit] = useState('')
  const [compradorTelefono, setCompradorTelefono] = useState('')
  const [compradorDireccion, setCompradorDireccion] = useState('')
  const [vendedorNombre, setVendedorNombre] = useState('')
  const [vendedorTelefono, setVendedorTelefono] = useState('')
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [formaPago, setFormaPago] = useState('Efectivo')
  const [estadoOperacion, setEstadoOperacion] = useState('Vendido')
  const [tipoCambioDolar, setTipoCambioDolar] = useState(cotizacionActual || 12.58)
  const [observacionesVenta, setObservacionesVenta] = useState('')
  const [compradorFirma, setCompradorFirma] = useState('')

  useEffect(() => {
    if (cotizacionActual) setTipoCambioDolar(cotizacionActual)
  }, [cotizacionActual])

  const montoTotalUsd = maquinasSeleccionadas.reduce((a, m) => {
    const usd = m.precioUsd ? Number(m.precioUsd) : (m.precio ? Number(m.precio) / tipoCambioDolar : 0)
    return a + usd
  }, 0)
  const montoTotalBs = montoTotalUsd * tipoCambioDolar

  return (
    <div className="space-y-4">
      {/* Banner Informativo de Guardado Automático */}
      <div className="bg-purple-100 border-l-4 border-purple-600 text-purple-950 p-3 rounded-r-xl text-xs flex items-center gap-2 shadow-sm font-medium">
        <CheckSquare size={18} className="text-purple-700 shrink-0" />
        <span>
          <strong>Guardado Automático de Estado:</strong> Al generar este formulario, el estado de las máquinas seleccionadas se actualizará automáticamente a <strong className="text-purple-800 uppercase">"Vendido"</strong> en la base de datos y se desmarcarán de la lista. <u>No necesita llenar ningún otro formulario.</u>
        </span>
      </div>

      {/* Recuadro de Cotización y Valores en Dólares/Bolivianos */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 text-white rounded-xl p-4 shadow-md space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-purple-700/40 pb-2">
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} className="text-yellow-300"/>
            <span className="font-extrabold text-sm uppercase tracking-wide">Formulario de Venta y Cotización Oficial (BCB)</span>
          </div>
          <div className="flex items-center gap-2 bg-black/30 px-3 py-1 rounded-lg border border-white/10">
            <span className="text-xs text-purple-200 font-medium">1 USD =</span>
            <input
              type="number"
              step="0.01"
              className="w-20 bg-white text-gray-900 px-2 py-0.5 rounded text-xs font-mono font-bold text-center focus:outline-none"
              value={tipoCambioDolar}
              onChange={e => setTipoCambioDolar(parseFloat(e.target.value) || 12.58)}
            />
            <span className="text-xs text-yellow-300 font-bold">BOB (BCB)</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-purple-200 block text-[11px]">Monto Total en Bolivianos:</span>
            <span className="text-lg font-black text-white font-mono">{montoTotalBs.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs</span>
          </div>
          <div>
            <span className="text-purple-200 block text-[11px]">Monto Total Venta en Dólares ($ USD):</span>
            <span className="text-lg font-black text-yellow-300 font-mono">$ {montoTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
          </div>
        </div>
      </div>

      {/* Lista de Máquinas a Vender con Fotos y Todos los Datos */}
      <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-3 max-h-60 overflow-y-auto space-y-3 text-xs">
        <p className="font-extrabold text-purple-900 text-xs uppercase tracking-wider flex items-center justify-between">
          <span>Máquinas Seleccionadas para Venta ({maquinasSeleccionadas.length}):</span>
          <span className="text-[10px] font-normal text-purple-700">Con fotos de máquina, placa y datos completos</span>
        </p>
        {maquinasSeleccionadas.map(m => {
          const usd = m.precioUsd ? Number(m.precioUsd) : (m.precio ? Number(m.precio) / tipoCambioDolar : 0)
          const bs = usd * tipoCambioDolar
          return (
            <div key={m.id} className="bg-white p-3 rounded-lg border border-purple-200 shadow-sm space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px] uppercase">
                    {m.empresa || 'SAJAMA S.R.L.'}
                  </span>
                  <span className="font-bold text-gray-900 text-sm">{m.nombreEs}</span>
                  {m.nombreZh && <span className="text-gray-500 font-medium text-xs">({m.nombreZh})</span>}
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-gray-800 font-bold">{bs.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs</span>
                  <span className="text-purple-700 font-extrabold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">$ {usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
                </div>
              </div>

              {/* Muestra de las 2 Fotos (Máquina y Placa/Serie) */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded border border-gray-200">
                  {m.fotoMaquinaUrl ? (
                    <img
                      src={m.fotoMaquinaUrl}
                      alt="Foto Máquina"
                      className="w-12 h-12 rounded object-cover border border-gray-300 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => onVerFoto && onVerFoto({
                        fotoUrl: m.fotoMaquinaUrl,
                        titulo: `${m.nombreEs} (Máquina)`,
                        subtitulo: `Modelo: ${m.modelo || '—'} | Serie: ${m.serie || '—'}`
                      })}
                      title="Haz clic para ampliar con zoom"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-[10px] shrink-0 text-center leading-tight">Sin Foto Máquina</div>
                  )}
                  <div className="text-[10px] leading-tight">
                    <span className="font-bold text-gray-700 block">Foto de la máquina</span>
                    <span className="text-gray-500 truncate block max-w-[120px]">{m.modelo ? `Mod: ${m.modelo}` : 'Vista general'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded border border-gray-200">
                  {m.fotoPlacaUrl ? (
                    <img
                      src={m.fotoPlacaUrl}
                      alt="Foto Placa"
                      className="w-12 h-12 rounded object-cover border border-gray-300 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => onVerFoto && onVerFoto({
                        fotoUrl: m.fotoPlacaUrl,
                        titulo: `${m.nombreEs} (Placa / Serie)`,
                        subtitulo: `Modelo: ${m.modelo || '—'} | Serie: ${m.serie || '—'}`
                      })}
                      title="Haz clic para ampliar con zoom"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-[10px] shrink-0 text-center leading-tight">Sin Foto Placa</div>
                  )}
                  <div className="text-[10px] leading-tight">
                    <span className="font-bold text-gray-700 block">Foto de placa / serie</span>
                    <span className="text-gray-500 font-mono block truncate max-w-[120px]">{m.serie || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Ficha resumida */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-gray-50/70 p-2 rounded border border-gray-100">
                <div><span className="text-gray-400 block text-[10px]">Modelo:</span> <span className="font-semibold text-gray-800">{m.modelo || '—'}</span></div>
                <div><span className="text-gray-400 block text-[10px]">Chasis / Serie:</span> <span className="font-mono font-semibold text-gray-800">{m.serie || '—'}</span></div>
                <div><span className="text-gray-400 block text-[10px]">Póliza Aduana:</span> <span className="font-semibold text-primary">{m.numPoliza || '—'}</span></div>
                <div><span className="text-gray-400 block text-[10px]">Unidad:</span> <span className="font-semibold text-gray-800">{m.unidad || 'Volqueta'}</span></div>
              </div>
              {m.observaciones && (
                <p className="text-[10px] text-gray-500 italic bg-gray-50 px-2 py-1 rounded">Obs: {m.observaciones}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Campos del Contrato / Formulario de Venta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Nombre del Comprador / Razón Social *</label>
          <input className="input font-semibold" value={compradorNombre} onChange={e => setCompradorNombre(e.target.value)} placeholder="Ej: Minera San Juan S.R.L. / Juan Pérez" required />
        </div>
        <div>
          <label className="label">CI / NIT del Comprador</label>
          <input className="input" value={compradorCiNit} onChange={e => setCompradorCiNit(e.target.value)} placeholder="Ej: 10239482019 / 4839201-LP" />
        </div>
        <div>
          <label className="label">Teléfono del Comprador</label>
          <input className="input" value={compradorTelefono} onChange={e => setCompradorTelefono(e.target.value)} placeholder="Ej: 715-28394" />
        </div>
        <div>
          <label className="label">Dirección / Ubicación del Comprador</label>
          <input className="input" value={compradorDireccion} onChange={e => setCompradorDireccion(e.target.value)} placeholder="Ej: Av. Principal N° 450, Potosí" />
        </div>
        <div>
          <label className="label">Vendedor Responsable (SAJAMA)</label>
          <input className="input" value={vendedorNombre} onChange={e => setVendedorNombre(e.target.value)} placeholder="Ej: Carlos Ramos" />
        </div>
        <div>
          <label className="label">Teléfono del Vendedor</label>
          <input className="input" value={vendedorTelefono} onChange={e => setVendedorTelefono(e.target.value)} placeholder="Ej: 694-82910" />
        </div>
        <div>
          <label className="label">Forma de Pago</label>
          <select className="input" value={formaPago} onChange={e => setFormaPago(e.target.value)}>
            <option value="Efectivo">Efectivo</option>
            <option value="Transferencia Bancaria">Transferencia Bancaria</option>
            <option value="Depósito">Depósito Bancario</option>
            <option value="Crédito / Cuotas">Crédito / En Cuotas</option>
          </select>
        </div>
        <div>
          <label className="label">Fecha de Venta</label>
          <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
        <div>
          <label className="label">Estado de la Máquina</label>
          <select className="input font-bold text-purple-700" value={estadoOperacion} onChange={e => setEstadoOperacion(e.target.value)}>
            <option value="Vendido">Vendido</option>
            <option value="Despachado">Despachado</option>
            <option value="Entregado">Entregado</option>
          </select>
        </div>
        <div>
          <label className="label">Firma de Conformidad / Comprador</label>
          <input className="input" value={compradorFirma} onChange={e => setCompradorFirma(e.target.value)} placeholder="Nombre para pie de firma" />
        </div>
      </div>

      <div>
        <label className="label">Observaciones y Condiciones de Venta</label>
        <textarea className="input resize-none" rows={2} value={observacionesVenta} onChange={e => setObservacionesVenta(e.target.value)} placeholder="Ej: Venta al contado con garantía de 6 meses. Se entregará póliza de importación original." />
      </div>

      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button onClick={onCancelar} className="btn-secondary">Cancelar</button>
        <button onClick={() => onImprimir({
          compradorNombre, compradorCiNit, compradorTelefono, compradorDireccion,
          vendedorNombre, vendedorTelefono, fecha, formaPago, estadoOperacion,
          tipoCambioDolar, observacionesVenta, compradorFirma, esFormularioVenta: true,
          montoTotalBs, montoTotalUsd
        })} className="btn-primary bg-purple-700 hover:bg-purple-800 border-purple-800">
          <ShoppingBag size={14} className="inline mr-1"/> Generar Venta, Actualizar Estado e Imprimir
        </button>
      </div>
    </div>
  )
}

// ── Impresión del Formulario de Venta y Transferencia de Maquinaria (A4 Horizontal) ──
function imprimirFormularioVenta(maquinas, datosVenta) {
  const fechaFmt = datosVenta.fecha ? format(new Date(datosVenta.fecha + 'T00:00:00'), 'dd/MM/yyyy') : ''
  const tcDolar = datosVenta.tipoCambioDolar || 12.58
  const estadoOp = (datosVenta.estadoOperacion || 'VENDIDO').toUpperCase()

  let montoTotalBs = 0
  let montoTotalUsd = 0

  const filasHTML = maquinas.map((m, i) => {
    const precioUsd = m.precioUsd ? Number(m.precioUsd) : (m.precio ? Number(m.precio) / tcDolar : 0)
    const precioBs = tcDolar > 0 ? (precioUsd * tcDolar) : (m.precio ? Number(m.precio) : 0)
    montoTotalBs += precioBs
    montoTotalUsd += precioUsd

    const polizaText = m.numPoliza ? `N° ${m.numPoliza}` : (m.polizaUrl ? 'PDF Adjunto' : 'Sin póliza')

    return `
      <tr>
        <td style="text-align:center;border:1px solid #777;padding:5px">${i + 1}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:700;color:#5b21b6;font-size:7.5pt">${m.empresa || 'SAJAMA S.R.L.'}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:600">${m.nombreZh || ''}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:600">${m.nombreEs || ''}</td>
        <td style="border:1px solid #777;padding:5px">${m.modelo || ''}</td>
        <td style="border:1px solid #777;padding:5px;font-family:monospace;font-weight:bold">${m.serie || ''}</td>
        <td style="border:1px solid #777;padding:5px;font-size:7.5pt;text-align:center;font-weight:bold;color:#1e3a8a">${polizaText}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold">${precioBs ? precioBs.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs' : '—'}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold;color:#6b21a8">$ ${precioUsd ? precioUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD' : '—'}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px">${m.unidad || 'Volqueta'}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px;font-weight:bold">1</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold">${precioBs ? precioBs.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs' : '—'}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold;color:#6b21a8">$ ${precioUsd ? precioUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD' : '—'}</td>
        <td style="border:1px solid #777;padding:5px;font-size:7.5pt">${m.observaciones || ''}</td>
      </tr>`
  }).join('')

  const fotosHTML = maquinas.map(m => {
    if (!m.fotoMaquinaUrl && !m.fotoPlacaUrl) return ''
    return `
      <div class="seccion-fotos">
        <div style="width:100%;font-weight:bold;color:#5b21b6;margin-bottom:6px;font-size:8.5pt;border-bottom:1px solid #ddd;padding-bottom:2px">
          [${m.empresa || 'SAJAMA S.R.L.'}] ${m.nombreEs || ''} ${m.nombreZh ? '(' + m.nombreZh + ')' : ''} - Serie/Chasis: ${m.serie || 'N/A'}
        </div>
        <div style="display:flex;gap:12px;width:100%">
          ${m.fotoMaquinaUrl ? `
            <div class="foto-card">
              <div class="foto-titulo">设备照片 / FOTO DE LA MÁQUINA EN VENTA</div>
              <img src="${m.fotoMaquinaUrl}" class="foto-img" alt="Foto Maquina"/>
            </div>
          ` : `
            <div class="foto-card">
              <div class="foto-titulo">设备照片 / FOTO DE LA MÁQUINA EN VENTA</div>
              <div style="height:220px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;color:#9ca3af;border:1px solid #ccc;width:100%">Sin Foto Registrada</div>
            </div>
          `}
          ${m.fotoPlacaUrl ? `
            <div class="foto-card">
              <div class="foto-titulo">铭牌/底盘照片 / FOTO DE CHASIS Y PLACA DE SERIE</div>
              <img src="${m.fotoPlacaUrl}" class="foto-img" alt="Foto Chasis y Placa"/>
            </div>
          ` : `
            <div class="foto-card">
              <div class="foto-titulo">铭牌/底盘照片 / FOTO DE CHASIS Y PLACA DE SERIE</div>
              <div style="height:220px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;color:#9ca3af;border:1px solid #ccc;width:100%">Sin Foto Registrada</div>
            </div>
          `}
        </div>
      </div>
    `
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Formulario de Venta y Transferencia - SAJAMA</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans SC','Microsoft YaHei',Arial,sans-serif; font-size:8.5pt; color:#111; padding:6mm 8mm; }
.header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; border-bottom:2px solid #5b21b6; padding-bottom:6px; }
.logo { font-size:16pt; font-weight:900; color:#5b21b6; letter-spacing:0.5px; }
.htxt { flex:1; text-align:center; }
.titzh { font-size:13pt; font-weight:700; line-height:1.2; }
.tites { font-size:9pt; color:#5b21b6; font-weight:600; margin-top:2px; }

.box-cotizacion { display:flex; justify-content:space-between; align-items:center; background:#faf5ff; border:1.5px solid #7e22ce; padding:6px 12px; border-radius:6px; margin-bottom:8px; font-size:8.5pt; }
.badge-estado { display:inline-block; padding:4px 12px; background:#6b21a8; color:#fff; font-weight:bold; border-radius:4px; font-size:8.5pt; letter-spacing:0.5px; }

table { width:100%; border-collapse:collapse; margin-bottom:6px; font-size:7.5pt; }
th { background:#f3e8ff; border:1px solid #666; padding:4px 3px; text-align:center; font-weight:700; line-height:1.2; font-size:7.5pt; }
td { border:1px solid #777; padding:4px 4px; }
.total-row td { font-weight:700; background:#f5f3ff; }

.seccion-fotos { display:flex; flex-direction:column; gap:6px; margin:8px 0; border:1.5px solid #666; padding:8px; background:#fff; border-radius:4px; page-break-inside:avoid; }
.foto-card { flex:1; text-align:center; display:flex; flex-direction:column; align-items:center; }
.foto-titulo { font-size:8pt; font-weight:bold; color:#5b21b6; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.3px; }
.foto-img { width:100%; height:220px; object-fit:contain; border:1px solid #888; background:#fafafa; border-radius:3px; }

.datos { border:1.5px solid #666; margin-top:6px; font-size:8pt; }
.fila-datos { display:flex; border-bottom:1px solid #666; }
.fila-datos:last-child { border-bottom:none; }
.celda-dato { flex:1; padding:5px 8px; border-right:1px solid #666; min-height:36px; }
.celda-dato:last-child { border-right:none; }
.celda-dato b { display:block; font-size:7.5pt; color:#333; margin-bottom:2px; font-weight:700; }
.celda-valor { font-size:8.5pt; color:#000; }

@page { size:A4 landscape; margin:8mm 8mm; }
@media print {
  body { padding:0; }
  .seccion-fotos { page-break-inside:avoid; }
}
</style></head><body>
<div class="header">
  <div class="logo" style="display:flex;align-items:center;gap:8px"><img src="${window.location.origin}/logo-sajama.jpg" alt="Sajama 4x4" style="width:42px;height:42px;border-radius:7px;object-fit:cover;border:1px solid #16241F" /><span>Sajama.SRL</span></div>
  <div class="htxt">
    <div class="titzh">SAJAMA 公司工程机械设备销售与过户确认单</div>
    <div class="tites">Formulario de Confirmación de Venta y Transferencia de Maquinaria y Equipos - SAJAMA</div>
  </div>
  <div style="text-align:right">
    <span class="badge-estado">ESTADO: ${estadoOp}</span>
  </div>
</div>

<div class="box-cotizacion">
  <div>
    <b>💵 Cotización Oficial Dólar (BCB del Día):</b>
    <span style="color:#6b21a8;font-family:monospace;font-weight:bold;font-size:9.5pt;margin-left:5px">1 USD = ${tcDolar.toFixed(2)} BOB</span>
  </div>
  <div>
    <b>Monto Total Venta (Bs):</b> <span style="font-weight:bold;margin-right:15px">${montoTotalBs.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs</span>
    <b>Monto Total Venta ($ USD):</b> <span style="color:#6b21a8;font-weight:bold;font-size:9.5pt">$ ${montoTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
  </div>
</div>

<table>
  <thead><tr>
    <th style="width:3%">No.</th>
    <th style="width:9%">Empresa</th>
    <th style="width:11%">Nombre Chino<br/>中文名称</th>
    <th style="width:13%">Nombre Español</th>
    <th style="width:7%">Modelo</th>
    <th style="width:11%">N° Serie / Chasis</th>
    <th style="width:9%">N° Póliza Aduanera</th>
    <th style="width:8%">Precio (Bs)</th>
    <th style="width:8%">Precio ($ USD)</th>
    <th style="width:5%">Unidad</th>
    <th style="width:4%">Cant.</th>
    <th style="width:7%">Total (Bs)</th>
    <th style="width:7%">Total ($ USD)</th>
    <th style="width:8%">Observaciones</th>
  </tr></thead>
  <tbody>
    ${filasHTML}
    <tr class="total-row">
      <td colspan="11" style="text-align:right;padding-right:8px;font-size:8.5pt">MONTO TOTAL VENTA DE MAQUINARIA:</td>
      <td style="text-align:right;font-size:8.5pt;font-weight:bold">${montoTotalBs.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs</td>
      <td style="text-align:right;font-size:8.5pt;font-weight:bold;color:#6b21a8">$ ${montoTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
      <td></td>
    </tr>
  </tbody>
</table>

${fotosHTML}

<div class="datos">
  <div class="fila-datos">
    <div class="celda-dato"><b>Comprador / Razón Social</b><span class="celda-valor" style="font-weight:bold;color:#5b21b6">${datosVenta.compradorNombre || ''}</span></div>
    <div class="celda-dato"><b>CI / NIT Comprador</b><span class="celda-valor">${datosVenta.compradorCiNit || ''}</span></div>
    <div class="celda-dato"><b>Teléfono Comprador</b><span class="celda-valor">${datosVenta.compradorTelefono || ''}</span></div>
    <div class="celda-dato"><b>Fecha de Venta</b><span class="celda-valor">${fechaFmt}</span></div>
  </div>
  <div class="fila-datos">
    <div class="celda-dato"><b>Dirección / Ubicación Comprador</b><span class="celda-valor">${datosVenta.compradorDireccion || ''}</span></div>
    <div class="celda-dato"><b>Vendedor Responsable (SAJAMA)</b><span class="celda-valor">${datosVenta.vendedorNombre || ''} ${datosVenta.vendedorTelefono ? '· ' + datosVenta.vendedorTelefono : ''}</span></div>
    <div class="celda-dato"><b>Forma de Pago</b><span class="celda-valor" style="font-weight:bold">${datosVenta.formaPago || 'Efectivo'}</span></div>
    <div class="celda-dato"><b>Tipo de Cambio BCB</b><span class="celda-valor" style="font-family:monospace;font-weight:bold">1 USD = ${tcDolar.toFixed(2)} BOB</span></div>
  </div>
  <div class="fila-datos">
    <div class="celda-dato" style="flex:2"><b>Observaciones / Términos de Venta</b><span class="celda-valor">${datosVenta.observacionesVenta || ''}</span></div>
    <div class="celda-dato"><b>Firma Comprador / Conformidad</b><span class="celda-valor">${datosVenta.compradorFirma || datosVenta.compradorNombre || ''}</span></div>
  </div>
</div>

<script>
window.onload = () => {
  const images = document.querySelectorAll('img');
  let loaded = 0;
  if (images.length === 0) {
    setTimeout(() => window.print(), 300);
    return;
  }
  const checkDone = () => {
    loaded++;
    if (loaded >= images.length) {
      setTimeout(() => window.print(), 400);
    }
  };
  images.forEach(img => {
    if (img.complete) {
      checkDone();
    } else {
      img.onload = checkDone;
      img.onerror = checkDone;
    }
  });
  setTimeout(() => window.print(), 2000);
};
</script>
</body></html>`

  const w = window.open('', '_blank', 'width=1100,height=800')
  w.document.write(html)
  w.document.close()
}

// ── Impresión del formulario de transporte bilingüe con fotos (A4 Horizontal) ──
function imprimirFormularioTransporte(maquinas, datosTransporte) {
  const fechaFmt = datosTransporte.fecha ? format(new Date(datosTransporte.fecha + 'T00:00:00'), 'dd/MM/yyyy') : ''
  const tcDolar = datosTransporte.tipoCambioDolar || 12.58
  const estadoOp = (datosTransporte.estadoOperacion || 'Despachado').toUpperCase()

  let montoTotalBs = 0
  let montoTotalUsd = 0

  const filasHTML = maquinas.map((m, i) => {
    const precioUsd = m.precioUsd ? Number(m.precioUsd) : (m.precio ? Number(m.precio) / tcDolar : 0)
    const precioBs = tcDolar > 0 ? (precioUsd * tcDolar) : (m.precio ? Number(m.precio) : 0)
    montoTotalBs += precioBs
    montoTotalUsd += precioUsd

    const polizaText = m.numPoliza ? `N° ${m.numPoliza}` : (m.polizaUrl ? 'PDF Adjunto' : 'Sin póliza')

    return `
      <tr>
        <td style="text-align:center;border:1px solid #777;padding:5px">${i + 1}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:700;color:#047857;font-size:7.5pt">${m.empresa || 'SAJAMA S.R.L.'}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:600">${m.nombreZh || ''}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:600">${m.nombreEs || ''}</td>
        <td style="border:1px solid #777;padding:5px">${m.modelo || ''}</td>
        <td style="border:1px solid #777;padding:5px;font-family:monospace;font-weight:bold">${m.serie || ''}</td>
        <td style="border:1px solid #777;padding:5px;font-size:7.5pt;text-align:center;font-weight:bold;color:#1e3a8a">${polizaText}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold">${precioBs ? precioBs.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs' : '—'}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold;color:#047857">$ ${precioUsd ? precioUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD' : '—'}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px">${m.unidad || 'Volqueta'}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px;font-weight:bold">1</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold">${precioBs ? precioBs.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs' : '—'}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold;color:#047857">$ ${precioUsd ? precioUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD' : '—'}</td>
        <td style="border:1px solid #777;padding:5px;font-size:7.5pt">${m.observaciones || ''}</td>
      </tr>`
  }).join('')

  const fotosHTML = maquinas.map(m => {
    if (!m.fotoMaquinaUrl && !m.fotoPlacaUrl) return ''
    return `
      <div class="seccion-fotos">
        <div style="width:100%;font-weight:bold;color:#047857;margin-bottom:6px;font-size:8.5pt;border-bottom:1px solid #ddd;padding-bottom:2px">
          [${m.empresa || 'SAJAMA S.R.L.'}] ${m.nombreEs || ''} ${m.nombreZh ? '(' + m.nombreZh + ')' : ''} - Serie/Chasis: ${m.serie || 'N/A'}
        </div>
        <div style="display:flex;gap:12px;width:100%">
          ${m.fotoMaquinaUrl ? `
            <div class="foto-card">
              <div class="foto-titulo">设备照片 / FOTO DE LA MÁQUINA</div>
              <img src="${m.fotoMaquinaUrl}" class="foto-img" alt="Foto Maquina"/>
            </div>
          ` : `
            <div class="foto-card">
              <div class="foto-titulo">设备照片 / FOTO DE LA MÁQUINA</div>
              <div style="height:220px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;color:#9ca3af;border:1px solid #ccc;width:100%">Sin Foto Registrada</div>
            </div>
          `}
          ${m.fotoPlacaUrl ? `
            <div class="foto-card">
              <div class="foto-titulo">铭牌/底盘照片 / FOTO DE CHASIS Y PLACA DE SERIE</div>
              <img src="${m.fotoPlacaUrl}" class="foto-img" alt="Foto Chasis y Placa"/>
            </div>
          ` : `
            <div class="foto-card">
              <div class="foto-titulo">铭牌/底盘照片 / FOTO DE CHASIS Y PLACA DE SERIE</div>
              <div style="height:220px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;color:#9ca3af;border:1px solid #ccc;width:100%">Sin Foto Registrada</div>
            </div>
          `}
        </div>
      </div>
    `
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Formulario de Despacho y Transporte - SAJAMA</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans SC','Microsoft YaHei',Arial,sans-serif; font-size:8.5pt; color:#111; padding:6mm 8mm; }
.header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; border-bottom:2px solid #047857; padding-bottom:6px; }
.logo { font-size:16pt; font-weight:900; color:#047857; letter-spacing:0.5px; }
.htxt { flex:1; text-align:center; }
.titzh { font-size:13pt; font-weight:700; line-height:1.2; }
.tites { font-size:9pt; color:#047857; font-weight:600; margin-top:2px; }

.box-cotizacion { display:flex; justify-content:space-between; align-items:center; background:#ecfdf5; border:1.5px solid #059669; padding:6px 12px; border-radius:6px; margin-bottom:8px; font-size:8.5pt; }
.badge-estado { display:inline-block; padding:4px 12px; background:#047857; color:#fff; font-weight:bold; border-radius:4px; font-size:8.5pt; letter-spacing:0.5px; }

table { width:100%; border-collapse:collapse; margin-bottom:6px; font-size:7.5pt; }
th { background:#d1fae5; border:1px solid #666; padding:4px 3px; text-align:center; font-weight:700; line-height:1.2; font-size:7.5pt; color:#065f46; }
td { border:1px solid #777; padding:4px 4px; }
.total-row td { font-weight:700; background:#ecfdf5; }

.seccion-fotos { display:flex; flex-direction:column; gap:6px; margin:8px 0; border:1.5px solid #666; padding:8px; background:#fff; border-radius:4px; page-break-inside:avoid; }
.foto-card { flex:1; text-align:center; display:flex; flex-direction:column; align-items:center; }
.foto-titulo { font-size:8pt; font-weight:bold; color:#047857; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.3px; }
.foto-img { width:100%; height:220px; object-fit:contain; border:1px solid #888; background:#fafafa; border-radius:3px; }

.datos { border:1.5px solid #666; margin-top:6px; font-size:8pt; }
.fila-datos { display:flex; border-bottom:1px solid #666; }
.fila-datos:last-child { border-bottom:none; }
.celda-dato { flex:1; padding:5px 8px; border-right:1px solid #666; min-height:36px; }
.celda-dato:last-child { border-right:none; }
.celda-dato b { display:block; font-size:7.5pt; color:#333; margin-bottom:2px; font-weight:700; }
.celda-valor { font-size:8.5pt; color:#000; }

@page { size:A4 landscape; margin:8mm 8mm; }
@media print {
  body { padding:0; }
  .seccion-fotos { page-break-inside:avoid; }
}
</style></head><body>
<div class="header">
  <div class="logo" style="display:flex;align-items:center;gap:8px"><img src="${window.location.origin}/logo-sajama.jpg" alt="Sajama 4x4" style="width:42px;height:42px;border-radius:7px;object-fit:cover;border:1px solid #16241F" /><span>Sajama.SRL</span></div>
  <div class="htxt">
    <div class="titzh">SAJAMA 公司工程机械设备运输与交付确认单</div>
    <div class="tites">Formulario de Confirmación de Transporte y Entregas - SAJAMA</div>
  </div>
  <div style="text-align:right">
    <span class="badge-estado">ESTADO: ${estadoOp}</span>
  </div>
</div>

<div class="box-cotizacion">
  <div>
    <b>💵 Cotización Oficial Dólar (BCB del Día):</b>
    <span style="color:#047857;font-family:monospace;font-weight:bold;font-size:9.5pt;margin-left:5px">1 USD = ${tcDolar.toFixed(2)} BOB</span>
  </div>
  <div>
    <b>Total Venta (Bs):</b> <span style="font-weight:bold;margin-right:15px">${montoTotalBs.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs</span>
    <b>Total Venta ($ USD):</b> <span style="color:#047857;font-weight:bold;font-size:9.5pt">$ ${montoTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
  </div>
</div>

<table>
  <thead><tr>
    <th style="width:3%">No.</th>
    <th style="width:9%">Empresa</th>
    <th style="width:11%">Nombre Chino<br/>中文名称</th>
    <th style="width:13%">Nombre Español</th>
    <th style="width:7%">Modelo</th>
    <th style="width:11%">N° Serie / Chasis</th>
    <th style="width:9%">N° Póliza Aduanera</th>
    <th style="width:8%">Precio (Bs)</th>
    <th style="width:8%">Precio ($ USD)</th>
    <th style="width:5%">Unidad</th>
    <th style="width:4%">Cant.</th>
    <th style="width:7%">Total (Bs)</th>
    <th style="width:7%">Total ($ USD)</th>
    <th style="width:8%">Observaciones</th>
  </tr></thead>
  <tbody>
    ${filasHTML}
    <tr class="total-row">
      <td colspan="11" style="text-align:right;padding-right:8px;font-size:8.5pt">MONTO TOTAL VENTA / TRANSPORTE:</td>
      <td style="text-align:right;font-size:8.5pt;font-weight:bold">${montoTotalBs.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs</td>
      <td style="text-align:right;font-size:8.5pt;font-weight:bold;color:#047857">$ ${montoTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
      <td></td>
    </tr>
  </tbody>
</table>

${fotosHTML}

<div class="datos">
  <div class="fila-datos">
    <div class="celda-dato"><b>Estado de Operación</b><span class="celda-valor" style="font-weight:bold;color:#1e3a8a">${estadoOp}</span></div>
    <div class="celda-dato"><b>Cotización Dólar BCB</b><span class="celda-valor" style="font-family:monospace;font-weight:bold">1 USD = ${tcDolar.toFixed(2)} BOB</span></div>
    <div class="celda-dato"><b>Placa de Camión</b><span class="celda-valor">${datosTransporte.placaCamion || ''}</span></div>
    <div class="celda-dato"><b>Fecha</b><span class="celda-valor">${fechaFmt}</span></div>
  </div>
  <div class="fila-datos">
    <div class="celda-dato"><b>Nombre y firma (Conductor)</b><span class="celda-valor">${datosTransporte.conductorNombre || ''}</span></div>
    <div class="celda-dato"><b>Teléfono Conductor</b><span class="celda-valor">${datosTransporte.conductorTelefono || ''}</span></div>
    <div class="celda-dato"><b>Nombre de quien envía (SAJAMA)</b><span class="celda-valor">${datosTransporte.enviaNombre || ''} ${datosTransporte.enviaTelefono ? '· ' + datosTransporte.enviaTelefono : ''}</span></div>
    <div class="celda-dato"><b>Destino / Cliente</b><span class="celda-valor">${datosTransporte.destino || ''}</span></div>
  </div>
  <div class="fila-datos">
    <div class="celda-dato" style="flex:2"><b>Descripción de cargos</b><span class="celda-valor">${datosTransporte.descripcionCargos || ''}</span></div>
    <div class="celda-dato"><b>Firma de Cliente / Recibido</b><span class="celda-valor">${datosTransporte.clienteFirma || ''}</span></div>
  </div>
</div>

<script>
window.onload = () => {
  const images = document.querySelectorAll('img');
  let loaded = 0;
  if (images.length === 0) {
    setTimeout(() => window.print(), 300);
    return;
  }
  const checkDone = () => {
    loaded++;
    if (loaded >= images.length) {
      setTimeout(() => window.print(), 400);
    }
  };
  images.forEach(img => {
    if (img.complete) {
      checkDone();
    } else {
      img.onload = checkDone;
      img.onerror = checkDone;
    }
  });
  setTimeout(() => window.print(), 2000);
};
</script>
</body></html>`

  const w = window.open('', '_blank', 'width=1100,height=800')
  w.document.write(html)
  w.document.close()
}

// ── Impresión de Planilla General de Maquinaria (A4 Horizontal por defecto) ──
function imprimirPlanillaMaquinaria(maquinas) {
  const montoTotal = maquinas.reduce((a, m) => a + (Number(m.precio) || 0), 0)
  const fechaHoy = format(new Date(), 'dd/MM/yyyy')

  const filasHTML = maquinas.map((m, i) => {
    const fechaFmt = m.fecha ? format(new Date(m.fecha + 'T00:00:00'), 'dd/MM/yyyy') : (m.creadoEn?.toDate ? format(m.creadoEn.toDate(), 'dd/MM/yyyy') : '—')
    return `
      <tr>
        <td style="text-align:center;border:1px solid #777;padding:5px">${i + 1}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:600">${m.nombreEs || ''}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:600">${m.nombreZh || '—'}</td>
        <td style="border:1px solid #777;padding:5px">${m.modelo || '—'}</td>
        <td style="border:1px solid #777;padding:5px;font-family:monospace;font-weight:bold">${m.serie || '—'}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px">${m.precio ? Number(m.precio).toLocaleString() + ' Bs' : '—'}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px">${m.unidad || '—'}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px"><span class="badge">${m.estado || 'A la venta'}</span></td>
        <td style="border:1px solid #777;padding:5px;font-size:7.5pt">
          ${m.polizaUrl ? '📄 Póliza adjunta' : 'Sin póliza'}
          ${m.numPoliza ? `<br/><b>N°: ${m.numPoliza}</b>` : ''}
        </td>
        <td style="text-align:center;border:1px solid #777;padding:5px">${fechaFmt}</td>
      </tr>
    `
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Planilla de Maquinaria - SAJAMA</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans SC','Microsoft YaHei',Arial,sans-serif; font-size:8.5pt; color:#111; padding:6mm 8mm; }
.header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; border-bottom:2px solid #16241F; padding-bottom:6px; }
.logo { font-size:16pt; font-weight:900; color:#16241F; }
.htxt { flex:1; text-align:center; }
.titzh { font-size:14pt; font-weight:700; color:#16241F; }
.tites { font-size:10pt; color:#233830; font-weight:600; margin-top:2px; }

table { width:100%; border-collapse:collapse; margin-top:8px; font-size:8pt; }
th { background:#E2E7E4; border:1px solid #555; padding:5px 4px; text-align:center; font-weight:700; line-height:1.2; font-size:8pt; color:#16241F; }
td { border:1px solid #777; padding:4px 6px; }
.total-row td { font-weight:700; background:#f1f5f9; }
.badge { display:inline-block; padding:2px 6px; border-radius:4px; font-size:7.5pt; font-weight:bold; background:#EEF2F0; color:#16241F; border:1px solid #CBD4CF; }

@page { size:A4 landscape; margin:8mm 8mm; }
@media print { body { padding:0; } }
</style></head><body>
<div class="header">
  <div class="logo" style="display:flex;align-items:center;gap:8px"><img src="${window.location.origin}/logo-sajama.jpg" alt="Sajama 4x4" style="width:42px;height:42px;border-radius:7px;object-fit:cover;border:1px solid #16241F" /><span>Sajama.SRL</span></div>
  <div class="htxt">
    <div class="titzh">SAJAMA 公司工程机械设备清单</div>
    <div class="tites">Planilla de Control de Maquinaria y Equipos Pesados - SAJAMA</div>
  </div>
  <div style="font-size:8pt;text-align:right;color:#555">Fecha de impresión:<br/><b>${fechaHoy}</b></div>
</div>

<table>
  <thead><tr>
    <th style="width:4%">No.</th>
    <th style="width:16%">Nombre (ES)</th>
    <th style="width:14%">中文名称</th>
    <th style="width:10%">Modelo</th>
    <th style="width:14%">Chasis / Placa</th>
    <th style="width:11%">Precio (Bs)</th>
    <th style="width:6%">Unidad</th>
    <th style="width:8%">Estado</th>
    <th style="width:11%">Póliza PDF</th>
    <th style="width:6%">Fecha</th>
  </tr></thead>
  <tbody>
    ${filasHTML}
    <tr class="total-row">
      <td colspan="5" style="text-align:right;padding-right:8px;font-size:8.5pt">Total acumulado (${maquinas.length} ítems):</td>
      <td style="text-align:right;font-size:9pt;font-weight:bold;padding-right:6px">${montoTotal.toLocaleString()} Bs</td>
      <td colspan="4"></td>
    </tr>
  </tbody>
</table>
<script>
window.onload = function() {
  setTimeout(() => window.print(), 500);
};
</script>
</body></html>`

  const w = window.open('', '_blank', 'width=1100,height=800')
  w.document.write(html)
  w.document.close()
}

// ── Impresión de Planilla de Registros y Procesos de Maquinaria (A4 Horizontal) ──
function imprimirPlanillaRegistroMaquinaria(registros) {
  const fechaHoy = format(new Date(), 'dd/MM/yyyy HH:mm')

  const filasHTML = registros.map((r, i) => {
    const fechaFmt = r.fecha?.toDate ? format(r.fecha.toDate(), 'dd/MM/yyyy HH:mm') : '—'
    return `
      <tr>
        <td style="text-align:center;border:1px solid #777;padding:5px">${i + 1}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px;font-size:7.5pt;white-space:nowrap">${fechaFmt}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:600">${r.usuario || 'Sistema'} ${r.rol ? `<span style="font-size:7pt;color:#666">(${r.rol})</span>` : ''}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px"><span class="badge">${r.accion || 'PROCESO'}</span></td>
        <td style="border:1px solid #777;padding:5px;font-size:8pt">${r.detalle || ''}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px;font-weight:bold">${r.estadoNuevo || r.estadoAnterior || '—'}</td>
      </tr>
    `
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Registro de Procesos - SAJAMA</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans SC','Microsoft YaHei',Arial,sans-serif; font-size:8.5pt; color:#111; padding:6mm 8mm; }
.header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; border-bottom:2px solid #16241F; padding-bottom:6px; }
.logo { font-size:16pt; font-weight:900; color:#16241F; }
.htxt { flex:1; text-align:center; }
.titzh { font-size:13pt; font-weight:700; color:#16241F; }
.tites { font-size:9.5pt; color:#233830; font-weight:600; margin-top:2px; }

table { width:100%; border-collapse:collapse; margin-top:8px; font-size:8pt; }
th { background:#E2E7E4; border:1px solid #555; padding:5px 4px; text-align:center; font-weight:700; line-height:1.2; font-size:8pt; color:#16241F; }
td { border:1px solid #777; padding:4px 6px; }
.total-row td { font-weight:700; background:#f1f5f9; }
.badge { display:inline-block; padding:2px 6px; border-radius:4px; font-size:7.5pt; font-weight:bold; background:#EEF2F0; color:#16241F; border:1px solid #CBD4CF; }

@page { size:A4 landscape; margin:8mm 8mm; }
@media print { body { padding:0; } }
</style></head><body>
<div class="header">
  <div class="logo" style="display:flex;align-items:center;gap:8px"><img src="${window.location.origin}/logo-sajama.jpg" alt="Sajama 4x4" style="width:42px;height:42px;border-radius:7px;object-fit:cover;border:1px solid #16241F" /><span>Sajama.SRL</span></div>
  <div class="htxt">
    <div class="titzh">SAJAMA 公司工程机械设备操作与交易记录清单</div>
    <div class="tites">Planilla de Registro de Procesos y Transacciones de Maquinaria - SAJAMA</div>
  </div>
  <div style="font-size:8pt;text-align:right;color:#555">Fecha de impresión:<br/><b>${fechaHoy}</b></div>
</div>

<table>
  <thead><tr>
    <th style="width:4%">No.</th>
    <th style="width:13%">Fecha / 时间</th>
    <th style="width:15%">Usuario / 用户</th>
    <th style="width:10%">Acción / 操作</th>
    <th style="width:46%">Detalle del Proceso / 详细描述</th>
    <th style="width:12%">Estado / 状态</th>
  </tr></thead>
  <tbody>
    ${filasHTML}
    <tr class="total-row">
      <td colspan="6" style="text-align:right;padding-right:8px;font-size:8.5pt">Total de registros (${registros.length}):</td>
    </tr>
  </tbody>
</table>
<script>
window.onload = function() {
  setTimeout(() => window.print(), 500);
};
</script>
</body></html>`

  const w = window.open('', '_blank', 'width=1100,height=800')
  w.document.write(html)
  w.document.close()
}

// ── Modal Registro de Procesos y Transacciones de Maquinaria ────────────────
// ── Modal Registro de Control de Ventas y Formularios de Transporte ────────
function ModalRegistroMaquinaria({ open, onClose, maquinas }) {
  const { perfil, tienePermiso } = useAuth()
  const canEdit = tienePermiso('maquinaria', 'editar')
  const canDelete = tienePermiso('maquinaria', 'eliminar')

  const [auditorias, setAuditorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  // Modales internos
  const [editandoFormulario, setEditandoFormulario] = useState(null)
  const [delRegistro, setDelRegistro] = useState(null)

  // Estado del formulario de edición de transporte
  const [formEditTransporte, setFormEditTransporte] = useState({
    placaCamion: '',
    conductorNombre: '',
    conductorTelefono: '',
    fecha: '',
    enviaNombre: '',
    enviaTelefono: '',
    destino: '',
    descripcionCargos: '',
    clienteFirma: '',
    estadoOperacion: 'Despachado',
    tipoCambioDolar: 12.58
  })

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const q = query(collection(db, 'auditoria'), where('modulo', '==', 'Maquinaria'))
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const tA = a.fecha?.seconds ? a.fecha.seconds * 1000 : (a.fecha?.toMillis ? a.fecha.toMillis() : (a.fecha ? new Date(a.fecha).getTime() : 0))
          const tB = b.fecha?.seconds ? b.fecha.seconds * 1000 : (b.fecha?.toMillis ? b.fecha.toMillis() : (b.fecha ? new Date(b.fecha).getTime() : 0))
          return tB - tA
        })
      setAuditorias(docs)
      setLoading(false)
    })
    return () => unsub()
  }, [open])

  // Filtrar ÚNICAMENTE registros de Ventas, Despachos, Entregas y Formularios de Transporte
  const registrosVentasDespachos = auditorias.filter(a => {
    const accionUpper = (a.accion || '').toUpperCase()
    const esAccionVentaDespacho = ['VENTA', 'VENDIDO', 'DESPACHO', 'DESPACHADO', 'ENTREGA', 'ENTREGADO'].includes(accionUpper)
    const esEstadoVentaDespacho = ['VENDIDO', 'DESPACHADO', 'ENTREGADO'].includes(a.estadoNuevo)
    const tieneTransporte = Boolean(a.datosTransporte)

    if (!esAccionVentaDespacho && !esEstadoVentaDespacho && !tieneTransporte) return false

    const term = busqueda.toLowerCase()
    return (
      (a.detalle && a.detalle.toLowerCase().includes(term)) ||
      (a.usuario && a.usuario.toLowerCase().includes(term)) ||
      (a.accion && a.accion.toLowerCase().includes(term)) ||
      (a.estadoNuevo && a.estadoNuevo.toLowerCase().includes(term)) ||
      (a.datosTransporte?.destino && a.datosTransporte.destino.toLowerCase().includes(term)) ||
      (a.datosTransporte?.conductorNombre && a.datosTransporte.conductorNombre.toLowerCase().includes(term)) ||
      (a.datosTransporte?.placaCamion && a.datosTransporte.placaCamion.toLowerCase().includes(term))
    )
  })

  // Helper para obtener datosTransporte y máquinas para impresión
  const obtenerDatosFormulario = (item) => {
    const dt = item.datosTransporte || {
      placaCamion: item.placaCamion || '',
      conductorNombre: item.conductorNombre || '',
      conductorTelefono: item.conductorTelefono || '',
      fecha: item.fechaFormulario || (item.fecha?.toDate ? format(item.fecha.toDate(), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')),
      enviaNombre: item.enviaNombre || '',
      enviaTelefono: item.enviaTelefono || '',
      destino: item.destino || '',
      descripcionCargos: item.descripcionCargos || item.detalle || '',
      clienteFirma: item.clienteFirma || '',
      estadoOperacion: item.estadoNuevo || item.accion || 'Despachado',
      tipoCambioDolar: item.tipoCambioDolar || 12.58,
      montoTotalBs: item.montoTotalBs || 0,
      montoTotalUsd: item.montoTotalUsd || 0
    }

    let listMaquinas = []
    if (item.maquinasInfo && item.maquinasInfo.length > 0) {
      listMaquinas = item.maquinasInfo
    } else if (item.maquinasIds && item.maquinasIds.length > 0) {
      listMaquinas = maquinas.filter(m => item.maquinasIds.includes(m.id))
    } else if (item.maquinaId) {
      const m = maquinas.find(x => x.id === item.maquinaId)
      if (m) listMaquinas = [m]
      else if (item.datosDespues || item.datosAntes) listMaquinas = [item.datosDespues || item.datosAntes]
    }

    if (listMaquinas.length === 0) {
      const match = maquinas.find(m => item.detalle && item.detalle.includes(m.nombreEs))
      if (match) listMaquinas = [match]
      else listMaquinas = [{
        nombreEs: item.detalle || 'Máquina en Registro',
        nombreZh: '', modelo: '', serie: '', precio: 0, precioUsd: 0, unidad: 'Volqueta', observaciones: ''
      }]
    }

    return { dt, listMaquinas }
  }

  // 1. Ver / Imprimir Formulario
  const handleVerImprimir = (item) => {
    const { dt, listMaquinas } = obtenerDatosFormulario(item)
    imprimirFormularioTransporte(listMaquinas, dt)
  }

  // 2. Abrir Modal de Edición de Formulario
  const handleAbrirEditar = (item) => {
    const { dt } = obtenerDatosFormulario(item)
    setEditandoFormulario(item)
    setFormEditTransporte({
      placaCamion: dt.placaCamion || '',
      conductorNombre: dt.conductorNombre || '',
      conductorTelefono: dt.conductorTelefono || '',
      fecha: dt.fecha || format(new Date(), 'yyyy-MM-dd'),
      enviaNombre: dt.enviaNombre || '',
      enviaTelefono: dt.enviaTelefono || '',
      destino: dt.destino || '',
      descripcionCargos: dt.descripcionCargos || '',
      clienteFirma: dt.clienteFirma || '',
      estadoOperacion: dt.estadoOperacion || item.estadoNuevo || 'Despachado',
      tipoCambioDolar: dt.tipoCambioDolar || 12.58
    })
  }

  // 3. Guardar Edición de Formulario de Transporte
  const handleGuardarEditFormulario = async (e) => {
    e.preventDefault()
    if (!editandoFormulario) return
    try {
      const { listMaquinas } = obtenerDatosFormulario(editandoFormulario)
      const tcDolar = Number(formEditTransporte.tipoCambioDolar) || 12.58

      let montoTotalUsd = 0
      for (const m of listMaquinas) {
        const usd = m.precioUsd ? Number(m.precioUsd) : (m.precio ? Number(m.precio) / tcDolar : 0)
        montoTotalUsd += usd
      }
      const montoTotalBs = montoTotalUsd * tcDolar

      const datosTransporteActualizados = {
        ...formEditTransporte,
        montoTotalBs,
        montoTotalUsd
      }

      const estadoNuevo = formEditTransporte.estadoOperacion || 'Despachado'
      const nombresMaq = listMaquinas.map(m => m.nombreEs).join(', ')

      const docRef = doc(db, 'auditoria', editandoFormulario.id)
      await updateDoc(docRef, {
        datosTransporte: datosTransporteActualizados,
        estadoNuevo: estadoNuevo,
        accion: estadoNuevo.toUpperCase(),
        detalle: `Formulario de Transporte (${estadoNuevo}): ${nombresMaq} [Total: $${montoTotalUsd.toFixed(2)} USD / ${montoTotalBs.toFixed(2)} Bs @ TC BCB: ${tcDolar}]`,
        actualizadoPor: perfil?.nombre || 'Sistema',
        actualizadoEn: serverTimestamp()
      })

      // Actualizar estado de las máquinas en inventario
      const mIds = editandoFormulario.maquinasIds || (editandoFormulario.maquinaId ? [editandoFormulario.maquinaId] : listMaquinas.map(m => m.id).filter(Boolean))
      for (const mId of mIds) {
        if (mId) {
          await updateDoc(doc(db, 'maquinaria', mId), {
            estado: estadoNuevo,
            actualizadoPor: perfil?.nombre || 'Sistema',
            actualizadoEn: serverTimestamp()
          })
        }
      }

      toast.success(`Formulario de Transporte actualizado y estado sincronizado a "${estadoNuevo}" en inventario.`)
      setEditandoFormulario(null)
    } catch (e) {
      toast.error('Error al actualizar formulario: ' + e.message)
    }
  }

  // 4. Eliminar Registro con Sincronización a Inventario
  const handleEliminarRegistro = async () => {
    if (!delRegistro) return
    try {
      const item = delRegistro
      const { listMaquinas } = obtenerDatosFormulario(item)
      const mIds = item.maquinasIds || (item.maquinaId ? [item.maquinaId] : listMaquinas.map(m => m.id).filter(Boolean))

      const estadoARestaurar = item.estadoAnterior || 'A la venta'

      for (const mId of mIds) {
        if (mId) {
          await updateDoc(doc(db, 'maquinaria', mId), {
            estado: estadoARestaurar,
            actualizadoPor: perfil?.nombre || 'Sistema',
            actualizadoEn: serverTimestamp()
          })
        }
      }

      await deleteDoc(doc(db, 'auditoria', item.id))
      toast.success(`Registro eliminado. Estado de máquina(s) restaurado a "${estadoARestaurar}" en el inventario.`)
      setDelRegistro(null)
    } catch (e) {
      toast.error('Error al eliminar registro: ' + e.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Control de Ventas y Formularios de Transporte" size="xl">
      <div className="space-y-4">
        {/* Buscador + Resumen */}
        <div className="flex items-center justify-between flex-wrap gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xs uppercase tracking-wide text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-300">
              Ventas y Despachos Registrados ({registrosVentasDespachos.length})
            </span>
          </div>

          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, camión, máquina, conductor..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
            />
          </div>
        </div>

        {/* Lista de Registros de Ventas y Transporte */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-primary" size={24}/></div>
          ) : registrosVentasDespachos.length === 0 ? (
            <div className="py-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <Truck size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-gray-600 font-bold text-sm">No hay formularios de venta o transporte registrados.</p>
              <p className="text-xs text-gray-400 mt-1">Al emitir un Formulario de Transporte desde la pantalla principal, aparecerán aquí.</p>
            </div>
          ) : (
            registrosVentasDespachos.map(item => {
              const { dt, listMaquinas } = obtenerDatosFormulario(item)
              const fechaFmt = item.fecha?.toDate ? format(item.fecha.toDate(), 'dd/MM/yyyy HH:mm') : (dt.fecha || '—')
              const estadoOp = (dt.estadoOperacion || item.estadoNuevo || item.accion || 'Despachado').toUpperCase()

              const badgeClass =
                estadoOp === 'VENDIDO' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                estadoOp === 'DESPACHADO' ? 'bg-[#EDF1EF] text-[#16241F] border-[#CBD4CF]' :
                'bg-teal-100 text-teal-800 border-teal-300'

              return (
                <div key={item.id} className="p-3.5 bg-white rounded-xl border border-gray-200 text-xs shadow-sm hover:border-primary/40 transition-colors space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap border-b border-gray-100 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] border ${badgeClass}`}>
                        {estadoOp}
                      </span>
                      <span className="font-bold text-gray-900">{item.usuario || 'Sistema'}</span>
                      {item.rol && <span className="text-gray-400 font-normal">({item.rol})</span>}
                    </div>
                    <span className="text-gray-400 text-[11px] font-mono">{fechaFmt}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500 font-medium">Máquina(s):</p>
                      <p className="font-bold text-gray-900">
                        {listMaquinas.map(m => m.nombreEs + (m.serie ? ` (${m.serie})` : '')).join(', ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-gray-500 font-medium">T.C. Dólar (BCB):</p>
                        <p className="font-mono font-bold text-gray-800">1 USD = {Number(dt.tipoCambioDolar || 12.58).toFixed(2)} BOB</p>
                      </div>
                      {dt.montoTotalUsd > 0 && (
                        <div>
                          <p className="text-emerald-700 font-medium">Monto Total USD:</p>
                          <p className="font-mono font-black text-emerald-800 text-sm">$ {Number(dt.montoTotalUsd).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {(dt.destino || dt.conductorNombre || dt.placaCamion) && (
                    <div className="bg-gray-50 p-2 rounded-lg text-[11px] text-gray-600 grid grid-cols-3 gap-2 border border-gray-100">
                      <div><span className="font-semibold text-gray-700">Placa:</span> {dt.placaCamion || '—'}</div>
                      <div><span className="font-semibold text-gray-700">Conductor:</span> {dt.conductorNombre || '—'}</div>
                      <div><span className="font-semibold text-gray-700">Destino/Cliente:</span> {dt.destino || '—'}</div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => handleVerImprimir(item)}
                      className="btn-secondary btn-sm flex items-center gap-1 text-xs text-primary border-primary/30 hover:bg-primary-pale"
                      title="Ver e Imprimir Formulario de Transporte"
                    >
                      <Printer size={13}/> Ver / Imprimir Formulario
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => handleAbrirEditar(item)}
                        className="btn-secondary btn-sm flex items-center gap-1 text-xs text-gray-700 hover:bg-gray-100"
                        title="Editar datos del Formulario de Transporte"
                      >
                        <Edit2 size={13}/> Editar Formulario
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => setDelRegistro(item)}
                        className="btn-secondary btn-sm flex items-center gap-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
                        title="Eliminar este registro y devolver máquina a disponible"
                      >
                        <Trash2 size={13}/> Eliminar
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Sub-modal: Editar Formulario de Transporte */}
        {editandoFormulario && (
          <Modal open={true} onClose={() => setEditandoFormulario(null)} title="Editar Formulario de Transporte y Venta" size="lg">
            <form onSubmit={handleGuardarEditFormulario} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Estado de Operación *</label>
                  <select
                    className="input font-bold text-primary"
                    value={formEditTransporte.estadoOperacion}
                    onChange={e => setFormEditTransporte({ ...formEditTransporte, estadoOperacion: e.target.value })}
                  >
                    <option value="Vendido">Vendido</option>
                    <option value="Despachado">Despachado</option>
                    <option value="Entregado">Entregado</option>
                  </select>
                </div>

                <div>
                  <label className="label">Tipo de Cambio Dólar (BCB del Día) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input font-mono font-bold text-emerald-700"
                    value={formEditTransporte.tipoCambioDolar}
                    onChange={e => setFormEditTransporte({ ...formEditTransporte, tipoCambioDolar: parseFloat(e.target.value) || 12.58 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Placa de Camión</label>
                  <input
                    className="input"
                    value={formEditTransporte.placaCamion}
                    onChange={e => setFormEditTransporte({ ...formEditTransporte, placaCamion: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Fecha</label>
                  <input
                    type="date"
                    className="input"
                    value={formEditTransporte.fecha}
                    onChange={e => setFormEditTransporte({ ...formEditTransporte, fecha: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Nombre del Conductor</label>
                  <input
                    className="input"
                    value={formEditTransporte.conductorNombre}
                    onChange={e => setFormEditTransporte({ ...formEditTransporte, conductorNombre: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Teléfono Conductor</label>
                  <input
                    className="input"
                    value={formEditTransporte.conductorTelefono}
                    onChange={e => setFormEditTransporte({ ...formEditTransporte, conductorTelefono: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Quien Envía (SAJAMA)</label>
                  <input
                    className="input"
                    value={formEditTransporte.enviaNombre}
                    onChange={e => setFormEditTransporte({ ...formEditTransporte, enviaNombre: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Teléfono Envía</label>
                  <input
                    className="input"
                    value={formEditTransporte.enviaTelefono}
                    onChange={e => setFormEditTransporte({ ...formEditTransporte, enviaTelefono: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Destino / Cliente</label>
                  <input
                    className="input"
                    value={formEditTransporte.destino}
                    onChange={e => setFormEditTransporte({ ...formEditTransporte, destino: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Firma de Cliente / Recibido</label>
                  <input
                    className="input"
                    value={formEditTransporte.clienteFirma}
                    onChange={e => setFormEditTransporte({ ...formEditTransporte, clienteFirma: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Descripción de cargos / Observaciones</label>
                <textarea
                  rows={2}
                  className="input resize-none"
                  value={formEditTransporte.descripcionCargos}
                  onChange={e => setFormEditTransporte({ ...formEditTransporte, descripcionCargos: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setEditandoFormulario(null)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Guardar Cambios y Actualizar Inventario</button>
              </div>
            </form>
          </Modal>
        )}

        {/* Sub-modal: Confirmar Eliminar Registro */}
        {delRegistro && (
          <Confirm
            open={true}
            title="Eliminar Registro de Transporte / Venta"
            message={`¿Estás seguro de eliminar el registro de ${delRegistro.datosTransporte?.estadoOperacion || delRegistro.estadoNuevo || 'venta'}? El estado de la(s) máquina(s) asociada(s) en el inventario se restaurará automáticamente a "${delRegistro.estadoAnterior || 'A la venta'}".`}
            confirmText="Sí, eliminar y devolver a disponible"
            danger={true}
            onConfirm={handleEliminarRegistro}
            onCancel={() => setDelRegistro(null)}
          />
        )}
      </div>
    </Modal>
  )
}

// ── Componente Principal Maquinaria ──────────────────────────────────
export default function Maquinaria() {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const { perfil, tienePermiso } = useAuth()
  const canEdit = tienePermiso('maquinaria', 'editar')
  const canDelete = tienePermiso('maquinaria', 'eliminar')

  const [maquinas, setMaquinas] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [cotizacionBcb, setCotizacionBcb] = useState(12.58)
  const [modalOpen, setModal] = useState(false)
  const [modalTransporte, setModalTransporte] = useState(false)
  const [modalVenta, setModalVenta] = useState(false)
  const [modalRegistro, setModalRegistro] = useState(false)
  const [editando, setEditando] = useState(null)
  const [delMaquina, setDelMaquina] = useState(null)
  const [seleccionadas, setSeleccionadas] = useState(new Set())
  const [verFoto, setVerFoto] = useState(null)

  const maquinasFiltradas = maquinas.filter(m => {
    const empMatch = !empresaFiltro || (m.empresa || 'SAJAMA S.R.L.') === empresaFiltro
    if (!empMatch) return false

    if (!busqueda.trim()) return true
    const q = busqueda.toLowerCase()
    return (
      m.nombreEs?.toLowerCase().includes(q) ||
      m.nombreZh?.toLowerCase().includes(q) ||
      m.modelo?.toLowerCase().includes(q) ||
      m.serie?.toLowerCase().includes(q) ||
      m.numPoliza?.toLowerCase().includes(q) ||
      m.estado?.toLowerCase().includes(q) ||
      (m.empresa || 'SAJAMA S.R.L.').toLowerCase().includes(q)
    )
  })

  useEffect(() => {
    const unsubCot = suscribirCotizacionUSD(tc => { if (tc) setCotizacionBcb(tc) })
    const q = query(collection(db, 'maquinaria'), orderBy('creadoEn', 'desc'))
    const unsubMaq = onSnapshot(q, snap => {
      setMaquinas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return () => {
      unsubCot()
      unsubMaq()
    }
  }, [])

  const handleGuardar = async (data) => {
    try {
      const esNuevo = !editando?.id
      const docRef = esNuevo ? doc(collection(db, 'maquinaria')) : doc(db, 'maquinaria', editando.id)

      let fotoMaquinaUrl = editando?.fotoMaquinaUrl || ''
      let fotoPlacaUrl = editando?.fotoPlacaUrl || ''
      let polizaUrl = editando?.polizaUrl || ''

      if (data.fotoMaquina) {
        const r = ref(storage, `maquinaria/${docRef.id}_maquina_${Date.now()}`)
        await uploadBytes(r, data.fotoMaquina)
        fotoMaquinaUrl = await getDownloadURL(r)
      }
      if (data.fotoPlaca) {
        const r = ref(storage, `maquinaria/${docRef.id}_placa_${Date.now()}`)
        await uploadBytes(r, data.fotoPlaca)
        fotoPlacaUrl = await getDownloadURL(r)
      }
      if (data.archivoPoliza) {
        const r = ref(storage, `maquinaria/${docRef.id}_poliza_${Date.now()}`)
        await uploadBytes(r, data.archivoPoliza)
        polizaUrl = await getDownloadURL(r)
      }

      const payload = {
        empresa: data.empresa || 'SAJAMA S.R.L.',
        nombreEs: data.nombreEs,
        nombreZh: data.nombreZh,
        modelo: data.modelo,
        serie: data.serie,
        precioUsd: data.precioUsd,
        precio: data.precio,
        tipoCambio: data.tipoCambio,
        unidad: data.unidad,
        estado: data.estado,
        numPoliza: data.numPoliza,
        fecha: data.fecha,
        observaciones: data.observaciones,
        fotoMaquinaUrl,
        fotoPlacaUrl,
        polizaUrl,
      }
      if (data.archivoPoliza) payload.polizaNombre = data.archivoPoliza.name

      if (esNuevo) {
        await setDoc(docRef, { ...payload, creadoPor: perfil?.nombre, creadoEn: serverTimestamp() })
        await registrarAccion({
          usuario: perfil?.nombre,
          rol: perfil?.rol,
          modulo: 'Maquinaria',
          accion: 'CREAR',
          detalle: `Registró máquina: ${payload.nombreEs} (Chasis/Placa: ${payload.serie || 's/s'})`,
          maquinaId: docRef.id,
          estadoNuevo: payload.estado,
          datosDespues: payload
        })
        toast.success('Máquina registrada correctamente')
      } else {
        const estadoCambiado = editando.estado !== payload.estado
        await updateDoc(docRef, { ...payload, actualizadoPor: perfil?.nombre, actualizadoEn: serverTimestamp() })
        await registrarAccion({
          usuario: perfil?.nombre,
          rol: perfil?.rol,
          modulo: 'Maquinaria',
          accion: estadoCambiado ? 'CAMBIO_ESTADO' : 'EDITAR',
          detalle: `Editó máquina: ${payload.nombreEs}${estadoCambiado ? ` (Estado: ${editando.estado} ➔ ${payload.estado})` : ''}`,
          maquinaId: docRef.id,
          estadoAnterior: editando.estado,
          estadoNuevo: payload.estado,
          datosAntes: editando,
          datosDespues: payload
        })
        toast.success('Máquina actualizada correctamente')
      }
      setModal(false); setEditando(null)
    } catch (e) { toast.error('Error al guardar: ' + e.message) }
  }

  const handleEliminar = async () => {
    try {
      await deleteDoc(doc(db, 'maquinaria', delMaquina.id))
      await registrarAccion({
        usuario: perfil?.nombre,
        rol: perfil?.rol,
        modulo: 'Maquinaria',
        accion: 'ELIMINAR',
        detalle: `Eliminó máquina: ${delMaquina.nombreEs}`,
        maquinaId: delMaquina.id,
        estadoAnterior: delMaquina.estado,
        datosAntes: delMaquina
      })
      toast.success('Máquina eliminada')
      setDelMaquina(null)
      setSeleccionadas(prev => { const n = new Set(prev); n.delete(delMaquina.id); return n })
    } catch (e) { toast.error('Error al eliminar: ' + e.message) }
  }

  const toggleSeleccion = (id) => {
    setSeleccionadas(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const toggleSeleccionarTodas = () => {
    if (seleccionadas.size === maquinas.length && maquinas.length > 0) {
      setSeleccionadas(new Set())
    } else {
      setSeleccionadas(new Set(maquinas.map(m => m.id)))
    }
  }

  const maquinasSeleccionadas = maquinas.filter(m => seleccionadas.has(m.id))

  const handleImprimirPlanilla = () => {
    if (seleccionadas.size === 0) {
      toast.error('Por favor tikea o selecciona al menos una máquina para imprimir la planilla.')
      return
    }
    imprimirPlanillaMaquinaria(maquinasSeleccionadas)
  }

  const handleImprimirTransporte = async (datosTransporte) => {
    try {
      const estadoNuevo = datosTransporte.estadoOperacion || 'Despachado'

      const maquinasInfo = maquinasSeleccionadas.map(m => ({
        id: m.id,
        nombreEs: m.nombreEs,
        nombreZh: m.nombreZh || '',
        modelo: m.modelo || '',
        serie: m.serie || '',
        precio: m.precio || 0,
        precioUsd: m.precioUsd || 0,
        unidad: m.unidad || 'Volqueta',
        observaciones: m.observaciones || '',
        fotoMaquinaUrl: m.fotoMaquinaUrl || '',
        fotoPlacaUrl: m.fotoPlacaUrl || ''
      }))

      // Actualizar estado de las máquinas seleccionadas en Firestore
      for (const m of maquinasSeleccionadas) {
        await updateDoc(doc(db, 'maquinaria', m.id), {
          estado: estadoNuevo,
          actualizadoPor: perfil?.nombre || 'Sistema',
          actualizadoEn: serverTimestamp()
        })
      }

      const nombresMaquinas = maquinasSeleccionadas.map(m => m.nombreEs).join(', ')

      await registrarAccion({
        usuario: perfil?.nombre || 'Sistema',
        rol: perfil?.rol || 'Administrador',
        modulo: 'Maquinaria',
        accion: estadoNuevo.toUpperCase(),
        detalle: `Formulario de Transporte (${estadoNuevo}): ${nombresMaquinas} [Total: $${(datosTransporte.montoTotalUsd || 0).toFixed(2)} USD / ${(datosTransporte.montoTotalBs || 0).toFixed(2)} Bs @ TC BCB: ${datosTransporte.tipoCambioDolar || cotizacionBcb}]`,
        maquinaId: maquinasSeleccionadas[0]?.id || null,
        maquinasIds: maquinasSeleccionadas.map(m => m.id),
        maquinasInfo: maquinasInfo,
        datosTransporte: datosTransporte,
        estadoAnterior: maquinasSeleccionadas[0]?.estado || 'A la venta',
        estadoNuevo: estadoNuevo
      })

      imprimirFormularioTransporte(maquinasSeleccionadas, datosTransporte)
      toast.success(`¡Formulario registrado con éxito! El estado de ${maquinasSeleccionadas.length} máquina(s) se actualizó automáticamente a "${estadoNuevo}" en la base de datos.`, { duration: 6000 })
      setSeleccionadas(new Set())
      setModalTransporte(false)
    } catch (e) {
      toast.error('Error al procesar el formulario de transporte: ' + e.message)
    }
  }

  const handleImprimirVenta = async (datosVenta) => {
    try {
      const estadoNuevo = datosVenta.estadoOperacion || 'Vendido'

      const maquinasInfo = maquinasSeleccionadas.map(m => ({
        id: m.id,
        nombreEs: m.nombreEs,
        nombreZh: m.nombreZh || '',
        modelo: m.modelo || '',
        serie: m.serie || '',
        precio: m.precio || 0,
        precioUsd: m.precioUsd || 0,
        unidad: m.unidad || 'Volqueta',
        observaciones: m.observaciones || '',
        fotoMaquinaUrl: m.fotoMaquinaUrl || '',
        fotoPlacaUrl: m.fotoPlacaUrl || ''
      }))

      // Actualizar estado de las máquinas seleccionadas en Firestore a Vendido
      for (const m of maquinasSeleccionadas) {
        await updateDoc(doc(db, 'maquinaria', m.id), {
          estado: estadoNuevo,
          actualizadoPor: perfil?.nombre || 'Sistema',
          actualizadoEn: serverTimestamp()
        })
      }

      const nombresMaquinas = maquinasSeleccionadas.map(m => m.nombreEs).join(', ')

      await registrarAccion({
        usuario: perfil?.nombre || 'Sistema',
        rol: perfil?.rol || 'Administrador',
        modulo: 'Maquinaria',
        accion: 'VENTA',
        detalle: `Formulario de Venta (${estadoNuevo}): ${nombresMaquinas} [Comprador: ${datosVenta.compradorNombre || 's/n'}] Total: $${(datosVenta.montoTotalUsd || 0).toFixed(2)} USD / ${(datosVenta.montoTotalBs || 0).toFixed(2)} Bs @ TC BCB: ${datosVenta.tipoCambioDolar || cotizacionBcb}`,
        maquinaId: maquinasSeleccionadas[0]?.id || null,
        maquinasIds: maquinasSeleccionadas.map(m => m.id),
        maquinasInfo: maquinasInfo,
        datosTransporte: datosVenta,
        estadoAnterior: maquinasSeleccionadas[0]?.estado || 'A la venta',
        estadoNuevo: estadoNuevo
      })

      imprimirFormularioVenta(maquinasSeleccionadas, datosVenta)
      toast.success(`¡Venta registrada con éxito! El estado de ${maquinasSeleccionadas.length} máquina(s) se actualizó automáticamente a "${estadoNuevo}" en la base de datos.`, { duration: 7000 })
      setSeleccionadas(new Set())
      setModalVenta(false)
    } catch (e) {
      toast.error('Error al procesar el formulario de venta: ' + e.message)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <Truck size={24} className="text-primary"/> {isZh ? '机械设备' : 'Maquinaria'}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {maquinas.length} {isZh ? '台已登记机械' : 'máquina(s) registradas'} — {seleccionadas.size} {isZh ? '台已选中' : 'seleccionada(s)'}
            </p>
          </div>

          {/* Tarjeta Prominente Cotización Oficial BCB */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white px-4 py-2.5 rounded-xl shadow-md border border-emerald-500/40">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <DollarSign size={24} className="text-yellow-300"/>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                <p className="text-[10px] uppercase tracking-wider text-emerald-100 font-extrabold">{isZh ? '官方央行汇率' : 'Cotización Oficial BCB'}</p>
              </div>
              <p className="text-base sm:text-lg font-black tracking-wide font-mono leading-tight mt-0.5">
                1 USD = <span className="text-yellow-300 font-black text-lg sm:text-2xl drop-shadow-sm">{Number(cotizacionBcb).toFixed(2)}</span> BOB
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={() => setModalRegistro(true)} className="btn-secondary btn-sm flex items-center gap-1.5" title={isZh ? '查看操作与运输记录' : 'Ver registro de procesos y transacciones'}>
            <FileText size={14}/> {isZh ? '历史记录' : 'Registro'}
          </button>
          <button onClick={handleImprimirPlanilla} className="btn-secondary btn-sm flex items-center gap-1.5">
            <Printer size={14}/> {isZh ? '打印表格' : 'Imprimir Planilla'} {seleccionadas.size > 0 ? `(${seleccionadas.size})` : ''}
          </button>
          {seleccionadas.size > 0 && (
            <button onClick={() => setModalVenta(true)} className="btn-primary btn-sm bg-purple-700 hover:bg-purple-800 border-purple-800 flex items-center gap-1.5 whitespace-nowrap">
              <ShoppingBag size={14}/> {isZh ? '销售表单' : 'Formulario de Venta'} ({seleccionadas.size})
            </button>
          )}
          {canEdit && (
            <button onClick={() => { setEditando(null); setModal(true) }} className="btn-primary btn-sm">
              <Plus size={14}/> {isZh ? '新建机械' : 'Nueva máquina'}
            </button>
          )}
        </div>
      </div>

      {/* Buscador y Filtro por Empresa */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={isZh ? '按名称、型号、底盘号、报关单或公司搜索...' : 'Buscar por nombre, modelo, chasis, póliza o empresa...'}
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <select
          value={empresaFiltro}
          onChange={e => setEmpresaFiltro(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold text-gray-700 bg-white"
        >
          <option value="">{isZh ? '全部公司' : 'Todas las empresas'}</option>
          {EMPRESAS.map(emp => (
            <option key={emp} value={emp}>{emp}</option>
          ))}
        </select>
        {(busqueda || empresaFiltro) && (
          <button onClick={() => { setBusqueda(''); setEmpresaFiltro('') }} className="btn-secondary btn-sm flex items-center gap-1">
            <RefreshCw size={14} /> {t('common.limpiar')}
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {maquinasFiltradas.length === 0 ? <EmptyState mensaje={isZh ? '未找到符合所选筛选条件的机械设备' : 'No se encontraron máquinas con los filtros seleccionados'}/> : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full min-w-[850px]">
              <thead><tr>
                <th className="th w-10">
                  <button onClick={() => {
                    if (seleccionadas.size === maquinasFiltradas.length && maquinasFiltradas.length > 0) {
                      setSeleccionadas(new Set())
                    } else {
                      setSeleccionadas(new Set(maquinasFiltradas.map(m => m.id)))
                    }
                  }} className="text-primary hover:scale-105 transition-transform" title={isZh ? '全选 / 取消全选' : 'Seleccionar todas / Deseleccionar todas'}>
                    {seleccionadas.size > 0 && seleccionadas.size === maquinasFiltradas.length ? <CheckSquare size={18}/> : <Square size={18} className="text-gray-300"/>}
                  </button>
                </th>
                <th className="th w-14">{isZh ? '照片' : 'Foto'}</th>
                <th className="th">{isZh ? '所属公司' : 'Empresa'}</th>
                <th className="th">{isZh ? '西语名称' : 'Nombre (ES)'}</th>
                <th className="th">{isZh ? '中文名称' : 'Nombre (ZH)'}</th>
                <th className="th">{isZh ? '型号' : 'Modelo'}</th>
                <th className="th">{isZh ? '底盘号 / 车牌' : 'Chasis / Placa'}</th>
                <th className="th text-right">{isZh ? '价格 ($ USD)' : 'Precio ($ USD)'}</th>
                <th className="th text-right">{isZh ? '价格 (Bs)' : 'Precio (Bs)'}</th>
                <th className="th">{isZh ? '单位' : 'Unidad'}</th>
                <th className="th">{isZh ? '状态' : 'Estado'}</th>
                <th className="th">{isZh ? '报关单 PDF' : 'Póliza PDF'}</th>
                <th className="th">{isZh ? '日期' : 'Fecha'}</th>
                {canEdit && <th className="th">{isZh ? '操作' : 'Acciones'}</th>}
              </tr></thead>
              <tbody>
                {maquinasFiltradas.map(m => {
                  const estObj = ESTADOS.find(e => e.id === m.estado) || ESTADOS[0]
                  const fechaFmt = m.fecha ? format(new Date(m.fecha + 'T00:00:00'), 'dd/MM/yyyy') : (m.creadoEn?.toDate ? format(m.creadoEn.toDate(), 'dd/MM/yyyy') : '—')
                  // Fuente de verdad: Precio en Dólares ($ USD) registrado en la base de datos (m.precioUsd)
                  const usdVal = m.precioUsd ? Number(m.precioUsd) : (m.precio ? Number(m.precio) / cotizacionBcb : 0)
                  // El precio en Bolivianos (Bs) se actualiza dinámicamente según la cotización del dólar actual
                  const bsVal = usdVal > 0 ? (usdVal * cotizacionBcb) : (m.precio ? Number(m.precio) : 0)
                  return (
                    <tr key={m.id} className={`tr-hover ${seleccionadas.has(m.id) ? 'bg-primary-pale' : ''}`}>
                      <td className="td">
                        <button onClick={() => toggleSeleccion(m.id)} className="text-primary">
                          {seleccionadas.has(m.id) ? <CheckSquare size={18}/> : <Square size={18} className="text-gray-300"/>}
                        </button>
                      </td>
                      <td className="td">
                        {m.fotoMaquinaUrl ? (
                          <img
                            src={m.fotoMaquinaUrl}
                            alt="foto"
                            className="w-10 h-10 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                            onClick={() => setVerFoto({
                              fotoUrl: m.fotoMaquinaUrl,
                              titulo: m.nombreEs,
                              subtitulo: `Modelo: ${m.modelo || '—'} | Serie: ${m.serie || '—'} | Empresa: ${m.empresa || 'SAJAMA S.R.L.'}`
                            })}
                            title="Haz clic para ampliar con zoom"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <ImageIcon size={16} className="text-gray-300"/>
                          </div>
                        )}
                      </td>
                      <td className="td font-semibold text-xs text-gray-700">{m.empresa || 'SAJAMA S.R.L.'}</td>
                      <td className="td font-medium">{m.nombreEs}</td>
                      <td className="td text-gray-600">{m.nombreZh || '—'}</td>
                      <td className="td text-gray-500 text-sm">{m.modelo || '—'}</td>
                      <td className="td text-gray-500 text-xs font-mono font-bold">{m.serie || '—'}</td>
                      <td className="td font-bold text-emerald-600 font-mono text-right">{usdVal > 0 ? `$ ${usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
                      <td className="td font-bold text-gray-800 font-mono text-right">{bsVal > 0 ? `${bsVal.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs` : '—'}</td>
                      <td className="td text-gray-500 text-sm">{m.unidad || '—'}</td>
                      <td className="td">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${estObj.color}`}>
                          <Tag size={11}/> {isZh ? (estObj.labelZh || estObj.label) : (estObj.label || 'A la venta')}
                        </span>
                      </td>
                      <td className="td text-xs">
                        {m.polizaUrl ? (
                          <a href={m.polizaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline font-medium">
                            <FileText size={13}/> {m.numPoliza ? `N° ${m.numPoliza}` : (isZh ? '查看 PDF' : 'Ver PDF')}
                          </a>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="td text-gray-500 text-xs">{fechaFmt}</td>
                      {canEdit && (
                        <td className="td">
                          <div className="flex gap-1.5">
                            <button onClick={() => { setEditando(m); setModal(true) }}
                              className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors" title={isZh ? '编辑' : 'Editar'}>
                              <Edit2 size={14}/>
                            </button>
                            {canDelete && (
                              <button onClick={() => setDelMaquina(m)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title={isZh ? '删除' : 'Eliminar'}>
                                <Trash2 size={14}/>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => { setModal(false); setEditando(null) }}
        title={editando ? (isZh ? '编辑机械' : 'Editar máquina') : (isZh ? '新建机械' : 'Nueva máquina')} size="md">
        <FormMaquina maquina={editando} onGuardar={handleGuardar}
          onCancelar={() => { setModal(false); setEditando(null) }} />
      </Modal>

      <ModalRegistroMaquinaria open={modalRegistro} onClose={() => setModalRegistro(false)} maquinas={maquinas} />

      <Modal open={modalVenta} onClose={() => setModalVenta(false)}
        title={isZh ? '机械设备销售及交接表单' : 'Formulario de Venta y Transferencia de Maquinaria y Equipos'} size="lg">
        <FormVenta maquinasSeleccionadas={maquinasSeleccionadas}
          cotizacionActual={cotizacionBcb}
          onImprimir={handleImprimirVenta}
          onCancelar={() => setModalVenta(false)}
          onVerFoto={setVerFoto} />
      </Modal>

      {delMaquina && (
        <Confirm open={true}
          title={isZh ? '删除机械' : 'Eliminar máquina'}
          message={isZh ? `确定要删除 "${delMaquina.nombreEs}" 吗？此操作无法撤销。` : `¿Estás seguro de eliminar "${delMaquina.nombreEs}"? Esta acción no se puede deshacer.`}
          confirmText={isZh ? '是的，删除' : 'Sí, eliminar'}
          danger={true}
          onConfirm={handleEliminar}
          onCancel={() => setDelMaquina(null)}
        />
      )}

      {/* Modal Ver Foto Zoom Interactivo */}
      <ModalVerFotoZoom
        open={!!verFoto}
        onClose={() => setVerFoto(null)}
        fotoUrl={verFoto?.fotoUrl}
        titulo={verFoto?.titulo || 'Foto de la maquinaria'}
        subtitulo={verFoto?.subtitulo}
      />
    </div>
  )
}
