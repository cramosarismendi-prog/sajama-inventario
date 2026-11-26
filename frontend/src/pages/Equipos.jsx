import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  collection, query, orderBy, onSnapshot, doc,
  setDoc, updateDoc, deleteDoc, serverTimestamp, limit, where
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { registrarAccion } from '../services/auditoria'
import { traducirAlChino } from '../services/traduccion'
import { PageLoader } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'
import { ModalReporteExcel } from '../components/ui/ModalReporteExcel'
import { ModalVerFotoZoom } from '../components/ui/ModalVerFotoZoom'
import {
  HardHat, Plus, Search, FileText, Trash2, Edit3,
  ExternalLink, Paperclip, CheckCircle2, Tag, AlertCircle, Languages,
  Printer, Image as ImageIcon, CheckSquare, Square, DollarSign,
  ShoppingBag, Truck, RotateCcw, Loader2, FileSpreadsheet
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { obtenerCotizacionUSD, suscribirCotizacionUSD, convertirBOBaUSD, convertirUSDaBOB } from '../services/cotizacion'
import { exportarEquiposExcel, filtrarPorRangoFechas } from '../utils/exportar'

const EMPRESAS = [
  'SAJAMA S.R.L.',
  'RUNXINCORP S.R.L.',
  'GOLDEN SHIELD S.R.L.',
  'EMPRESA JIM ALEX',
  'SUPERCADENA'
]

const ESTADOS = [
  { id: 'A la venta',  label: 'A la venta',  labelZh: '待售',  color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { id: 'Vendido',     label: 'Vendido',     labelZh: '已售',  color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'Despachado',  label: 'Despachado',  labelZh: '已派送',color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'Entregado',   label: 'Entregado',   labelZh: '已交付',color: 'bg-[#16241F] text-[#E4D825] border-[#233830]' },
  { id: 'Existente',   label: 'Existente',   labelZh: '在库',  color: 'bg-slate-100 text-slate-800 border-slate-300' }
]

// ── Selector de foto individual para Equipos ─────────────────────────
function CampoFoto({ label, urlActual, archivoSeleccionado, onSeleccionar }) {
  const inputId = 'foto-eq-' + label.replace(/\s+/g, '-')
  const preview = archivoSeleccionado ? URL.createObjectURL(archivoSeleccionado) : urlActual
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div
        onClick={() => document.getElementById(inputId).click()}
        className="w-full h-28 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary cursor-pointer flex items-center justify-center overflow-hidden bg-gray-50 transition-colors relative">
        {preview
          ? <img src={preview} alt={label} className="w-full h-full object-cover"/>
          : <div className="text-center text-gray-400">
              <ImageIcon size={20} className="mx-auto mb-1"/>
              <p className="text-[11px]">Clic para subir foto</p>
            </div>
        }
      </div>
      <input id={inputId} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files[0]) onSeleccionar(e.target.files[0]) }} />
    </div>
  )
}

// ── Formulario de datos de transporte de Equipos ─────────────────────────────
function FormTransporteEquipos({ equiposSeleccionados = [], cotizacionActual, onImprimir, onCancelar, onVerFoto }) {
  const [placaCamion, setPlacaCamion] = useState('')
  const [conductorNombre, setConductorNombre] = useState('')
  const [conductorTelefono, setConductorTelefono] = useState('')
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [enviaNombre, setEnviaNombre] = useState('')
  const [enviaTelefono, setEnviaTelefono] = useState('')
  const [destino, setDestino] = useState('')
  const [descripcionCargos, setDescripcionCargos] = useState('')
  const [clienteFirma, setClienteFirma] = useState('')
  const [estadoOperacion, setEstadoOperacion] = useState('Despachado')
  const [tipoCambioDolar, setTipoCambioDolar] = useState(cotizacionActual || 12.58)

  useEffect(() => {
    if (cotizacionActual) setTipoCambioDolar(cotizacionActual)
  }, [cotizacionActual])

  const montoTotalUsd = equiposSeleccionados.reduce((a, eq) => {
    const usd = eq.precioUsd ? Number(eq.precioUsd) : (eq.precio ? Number(eq.precio) : (eq.precioBs ? Number(eq.precioBs) / tipoCambioDolar : 0))
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
            <span className="font-extrabold text-sm uppercase tracking-wide">Cotización Oficial BCB del Día</span>
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

      {/* Desglose de equipos seleccionados con fotos y ficha técnica */}
      <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3 max-h-60 overflow-y-auto space-y-3 text-xs">
        <p className="font-extrabold text-emerald-900 text-xs uppercase tracking-wider flex items-center justify-between">
          <span>Equipos seleccionados ({equiposSeleccionados.length}):</span>
          <span className="text-[10px] font-normal text-emerald-700">Con fotos del equipo, placa y datos completos</span>
        </p>
        {equiposSeleccionados.map(eq => {
          const usd = eq.precioUsd ? Number(eq.precioUsd) : (eq.precio ? Number(eq.precio) : (eq.precioBs ? Number(eq.precioBs) / tipoCambioDolar : 0))
          const bs = usd * tipoCambioDolar
          const fotoEq = eq.fotoEquipoUrl || eq.fotoMaquinaUrl
          const fotoPl = eq.fotoPlacaUrl
          return (
            <div key={eq.id} className="bg-white p-3 rounded-lg border border-emerald-200 shadow-sm space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                    {eq.empresa || 'SAJAMA S.R.L.'}
                  </span>
                  <span className="font-bold text-gray-900 text-sm">{eq.nombreEs}</span>
                  {eq.nombreZh && <span className="text-gray-500 font-medium text-xs">({eq.nombreZh})</span>}
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-gray-800 font-bold">{bs.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs</span>
                  <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">$ {usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
                </div>
              </div>

              {/* Muestra de las 2 Fotos (Equipo y Placa/Serie) */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded border border-gray-200">
                  {fotoEq ? (
                    <img
                      src={fotoEq}
                      alt="Foto Equipo"
                      className="w-12 h-12 rounded object-cover border border-gray-300 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => onVerFoto && onVerFoto({
                        fotoUrl: fotoEq,
                        titulo: `${eq.nombreEs} (Equipo)`,
                        subtitulo: `Modelo: ${eq.modelo || '—'} | Serie: ${eq.serie || '—'}`
                      })}
                      title="Haz clic para ampliar con zoom"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-[10px] shrink-0 text-center leading-tight">Sin Foto Equipo</div>
                  )}
                  <div className="text-[10px] leading-tight">
                    <span className="font-bold text-gray-700 block">Foto del equipo</span>
                    <span className="text-gray-500 truncate block max-w-[120px]">{eq.modelo ? `Mod: ${eq.modelo}` : 'Vista general'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded border border-gray-200">
                  {fotoPl ? (
                    <img
                      src={fotoPl}
                      alt="Foto Placa"
                      className="w-12 h-12 rounded object-cover border border-gray-300 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => onVerFoto && onVerFoto({
                        fotoUrl: fotoPl,
                        titulo: `${eq.nombreEs} (Placa / Serie)`,
                        subtitulo: `Modelo: ${eq.modelo || '—'} | Serie: ${eq.serie || '—'}`
                      })}
                      title="Haz clic para ampliar con zoom"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-[10px] shrink-0 text-center leading-tight">Sin Foto Placa</div>
                  )}
                  <div className="text-[10px] leading-tight">
                    <span className="font-bold text-gray-700 block">Foto de placa / serie</span>
                    <span className="text-gray-500 font-mono block truncate max-w-[120px]">{eq.serie || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Ficha resumida */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-gray-50/70 p-2 rounded border border-gray-100">
                <div><span className="text-gray-400 block text-[10px]">Modelo:</span> <span className="font-semibold text-gray-800">{eq.modelo || '—'}</span></div>
                <div><span className="text-gray-400 block text-[10px]">N° Serie:</span> <span className="font-mono font-semibold text-gray-800">{eq.serie || '—'}</span></div>
                <div><span className="text-gray-400 block text-[10px]">Póliza Aduana:</span> <span className="font-semibold text-primary">{eq.numPoliza || '—'}</span></div>
                <div><span className="text-gray-400 block text-[10px]">Estado:</span> <span className="font-semibold text-gray-800">{eq.estado || 'A la venta'}</span></div>
              </div>
              {eq.observaciones && (
                <p className="text-[10px] text-gray-500 italic bg-gray-50 px-2 py-1 rounded">Obs: {eq.observaciones}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Campos de Transporte */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Estado de Operación *</label>
          <select
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold text-primary"
            value={estadoOperacion}
            onChange={e => setEstadoOperacion(e.target.value)}
          >
            <option value="Vendido">Vendido</option>
            <option value="Despachado">Despachado</option>
            <option value="Entregado">Entregado</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de Salida / Venta</label>
          <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Placa de Camión</label>
          <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={placaCamion} onChange={e => setPlacaCamion(e.target.value)} placeholder="Ej: 2342-KZR" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del Conductor</label>
          <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={conductorNombre} onChange={e => setConductorNombre(e.target.value)} placeholder="Ej: Juan Quispe" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono del Conductor</label>
          <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={conductorTelefono} onChange={e => setConductorTelefono(e.target.value)} placeholder="Ej: 712-34567" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nombre de quien envía (SAJAMA)</label>
          <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={enviaNombre} onChange={e => setEnviaNombre(e.target.value)} placeholder="Ej: Carlos Ramos" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono de quien envía</label>
          <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={enviaTelefono} onChange={e => setEnviaTelefono(e.target.value)} placeholder="Ej: 694-82910" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Destino / Cliente</label>
          <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={destino} onChange={e => setDestino(e.target.value)} placeholder="Ej: Mina San Cristóbal / Cliente Mario Gómez" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Firma de Cliente / Recibido</label>
          <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={clienteFirma} onChange={e => setClienteFirma(e.target.value)} placeholder="Nombre para pie de firma" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Descripción de cargos / Notas</label>
        <textarea className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" rows={2} value={descripcionCargos} onChange={e => setDescripcionCargos(e.target.value)} placeholder="Detalles del transporte, accesorios entregados..." />
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

// ── Formulario de Venta de Equipos ────────────────────────────────────
function FormVentaEquipos({ equiposSeleccionados = [], cotizacionActual, onImprimir, onCancelar, onVerFoto }) {
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

  const montoTotalUsd = equiposSeleccionados.reduce((a, eq) => {
    const usd = eq.precioUsd ? Number(eq.precioUsd) : (eq.precio ? Number(eq.precio) : (eq.precioBs ? Number(eq.precioBs) / tipoCambioDolar : 0))
    return a + usd
  }, 0)
  const montoTotalBs = montoTotalUsd * tipoCambioDolar

  return (
    <div className="space-y-4">
      {/* Banner Informativo de Guardado Automático */}
      <div className="bg-purple-100 border-l-4 border-purple-600 text-purple-950 p-3 rounded-r-xl text-xs flex items-center gap-2 shadow-sm font-medium">
        <CheckSquare size={18} className="text-purple-700 shrink-0" />
        <span>
          <strong>Guardado Automático de Estado:</strong> Al generar este formulario, el estado de los equipos seleccionados se actualizará automáticamente a <strong className="text-purple-800 uppercase">"Vendido"</strong> en la base de datos y se desmarcarán de la lista. <u>No necesita llenar ningún otro formulario.</u>
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

      {/* Lista de Equipos a Vender con Fotos y Todos los Datos */}
      <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-3 max-h-60 overflow-y-auto space-y-3 text-xs">
        <p className="font-extrabold text-purple-900 text-xs uppercase tracking-wider flex items-center justify-between">
          <span>Equipos Seleccionados para Venta ({equiposSeleccionados.length}):</span>
          <span className="text-[10px] font-normal text-purple-700">Con fotos del equipo, placa y datos completos</span>
        </p>
        {equiposSeleccionados.map(eq => {
          const usd = eq.precioUsd ? Number(eq.precioUsd) : (eq.precio ? Number(eq.precio) : (eq.precioBs ? Number(eq.precioBs) / tipoCambioDolar : 0))
          const bs = usd * tipoCambioDolar
          const fotoEq = eq.fotoEquipoUrl || eq.fotoMaquinaUrl
          const fotoPl = eq.fotoPlacaUrl
          return (
            <div key={eq.id} className="bg-white p-3 rounded-lg border border-purple-200 shadow-sm space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px] uppercase">
                    {eq.empresa || 'SAJAMA S.R.L.'}
                  </span>
                  <span className="font-bold text-gray-900 text-sm">{eq.nombreEs}</span>
                  {eq.nombreZh && <span className="text-gray-500 font-medium text-xs">({eq.nombreZh})</span>}
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-gray-800 font-bold">{bs.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs</span>
                  <span className="text-purple-700 font-extrabold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">$ {usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
                </div>
              </div>

              {/* Muestra de las 2 Fotos (Equipo y Placa/Serie) */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded border border-gray-200">
                  {fotoEq ? (
                    <img
                      src={fotoEq}
                      alt="Foto Equipo"
                      className="w-12 h-12 rounded object-cover border border-gray-300 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => onVerFoto && onVerFoto({
                        fotoUrl: fotoEq,
                        titulo: `${eq.nombreEs} (Equipo)`,
                        subtitulo: `Modelo: ${eq.modelo || '—'} | Serie: ${eq.serie || '—'}`
                      })}
                      title="Haz clic para ampliar con zoom"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-[10px] shrink-0 text-center leading-tight">Sin Foto Equipo</div>
                  )}
                  <div className="text-[10px] leading-tight">
                    <span className="font-bold text-gray-700 block">Foto del equipo</span>
                    <span className="text-gray-500 truncate block max-w-[120px]">{eq.modelo ? `Mod: ${eq.modelo}` : 'Vista general'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded border border-gray-200">
                  {fotoPl ? (
                    <img
                      src={fotoPl}
                      alt="Foto Placa"
                      className="w-12 h-12 rounded object-cover border border-gray-300 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => onVerFoto && onVerFoto({
                        fotoUrl: fotoPl,
                        titulo: `${eq.nombreEs} (Placa / Serie)`,
                        subtitulo: `Modelo: ${eq.modelo || '—'} | Serie: ${eq.serie || '—'}`
                      })}
                      title="Haz clic para ampliar con zoom"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-[10px] shrink-0 text-center leading-tight">Sin Foto Placa</div>
                  )}
                  <div className="text-[10px] leading-tight">
                    <span className="font-bold text-gray-700 block">Foto de placa / serie</span>
                    <span className="text-gray-500 font-mono block truncate max-w-[120px]">{eq.serie || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Ficha resumida */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-gray-50/70 p-2 rounded border border-gray-100">
                <div><span className="text-gray-400 block text-[10px]">Modelo:</span> <span className="font-semibold text-gray-800">{eq.modelo || '—'}</span></div>
                <div><span className="text-gray-400 block text-[10px]">N° Serie:</span> <span className="font-mono font-semibold text-gray-800">{eq.serie || '—'}</span></div>
                <div><span className="text-gray-400 block text-[10px]">Póliza Aduana:</span> <span className="font-semibold text-primary">{eq.numPoliza || '—'}</span></div>
                <div><span className="text-gray-400 block text-[10px]">Estado:</span> <span className="font-semibold text-gray-800">{eq.estado || 'A la venta'}</span></div>
              </div>
              {eq.observaciones && (
                <p className="text-[10px] text-gray-500 italic bg-gray-50 px-2 py-1 rounded">Obs: {eq.observaciones}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Campos del Contrato / Formulario de Venta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del Comprador / Razón Social *</label>
          <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold" value={compradorNombre} onChange={e => setCompradorNombre(e.target.value)} placeholder="Ej: Minera San Juan S.R.L. / Juan Pérez" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">CI / NIT del Comprador</label>
          <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={compradorCiNit} onChange={e => setCompradorCiNit(e.target.value)} placeholder="Ej: 10239482019 / 4839201-LP" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono del Comprador</label>
          <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={compradorTelefono} onChange={e => setCompradorTelefono(e.target.value)} placeholder="Ej: 715-28394" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Dirección / Ubicación del Comprador</label>
          <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={compradorDireccion} onChange={e => setCompradorDireccion(e.target.value)} placeholder="Ej: Av. Principal N° 450, Potosí" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Vendedor Responsable (SAJAMA)</label>
          <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={vendedorNombre} onChange={e => setVendedorNombre(e.target.value)} placeholder="Ej: Carlos Ramos" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono del Vendedor</label>
          <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={vendedorTelefono} onChange={e => setVendedorTelefono(e.target.value)} placeholder="Ej: 694-82910" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Forma de Pago</label>
          <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={formaPago} onChange={e => setFormaPago(e.target.value)}>
            <option value="Efectivo">Efectivo</option>
            <option value="Transferencia Bancaria">Transferencia Bancaria</option>
            <option value="Depósito">Depósito Bancario</option>
            <option value="Crédito / Cuotas">Crédito / En Cuotas</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de Venta</label>
          <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Estado del Equipo</label>
          <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold text-purple-700" value={estadoOperacion} onChange={e => setEstadoOperacion(e.target.value)}>
            <option value="Vendido">Vendido</option>
            <option value="Despachado">Despachado</option>
            <option value="Entregado">Entregado</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Firma de Conformidad / Comprador</label>
          <input className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" value={compradorFirma} onChange={e => setCompradorFirma(e.target.value)} placeholder="Nombre para pie de firma" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones y Condiciones de Venta</label>
        <textarea className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" rows={2} value={observacionesVenta} onChange={e => setObservacionesVenta(e.target.value)} placeholder="Ej: Venta al contado con garantía de 6 meses. Se entregará póliza de importación original." />
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

// ── Impresión del Formulario de Venta y Transferencia de Equipos (A4 Horizontal) ──
function imprimirFormularioVentaEquipos(equipos, datosVenta) {
  const fechaFmt = datosVenta.fecha ? format(new Date(datosVenta.fecha + 'T00:00:00'), 'dd/MM/yyyy') : ''
  const tcDolar = datosVenta.tipoCambioDolar || 12.58
  const estadoOp = (datosVenta.estadoOperacion || 'VENDIDO').toUpperCase()

  let montoTotalBs = 0
  let montoTotalUsd = 0

  const filasHTML = equipos.map((eq, i) => {
    const precioUsd = eq.precioUsd ? Number(eq.precioUsd) : (eq.precio ? Number(eq.precio) : (eq.precioBs ? Number(eq.precioBs) / tcDolar : 0))
    const precioBs = tcDolar > 0 ? (precioUsd * tcDolar) : (eq.precioBs ? Number(eq.precioBs) : 0)
    montoTotalBs += precioBs
    montoTotalUsd += precioUsd

    const polizaText = eq.numPoliza ? `N° ${eq.numPoliza}` : (eq.polizaUrl ? 'PDF Adjunto' : 'Sin póliza')

    return `
      <tr>
        <td style="text-align:center;border:1px solid #777;padding:5px">${i + 1}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:700;color:#6b21a8;font-size:7.5pt">${eq.empresa || 'SAJAMA S.R.L.'}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:600">${eq.nombreZh || ''}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:600">${eq.nombreEs || ''}</td>
        <td style="border:1px solid #777;padding:5px">${eq.modelo || ''}</td>
        <td style="border:1px solid #777;padding:5px;font-family:monospace;font-weight:bold">${eq.serie || ''}</td>
        <td style="border:1px solid #777;padding:5px;font-size:7.5pt;text-align:center;font-weight:bold;color:#1e3a8a">${polizaText}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold">${precioBs ? precioBs.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs' : '—'}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold;color:#6b21a8">$ ${precioUsd ? precioUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD' : '—'}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px">${eq.unidad || 'Unidad'}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px;font-weight:bold">1</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold">${precioBs ? precioBs.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs' : '—'}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold;color:#6b21a8">$ ${precioUsd ? precioUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD' : '—'}</td>
        <td style="border:1px solid #777;padding:5px;font-size:7.5pt">${eq.observaciones || ''}</td>
      </tr>`
  }).join('')

  const fotosHTML = equipos.map(eq => {
    const fotoEq = eq.fotoEquipoUrl || eq.fotoMaquinaUrl
    const fotoPl = eq.fotoPlacaUrl
    if (!fotoEq && !fotoPl) return ''
    return `
      <div class="seccion-fotos">
        <div style="width:100%;font-weight:bold;color:#6b21a8;margin-bottom:6px;font-size:8.5pt;border-bottom:1px solid #ddd;padding-bottom:2px">
          [${eq.empresa || 'SAJAMA S.R.L.'}] ${eq.nombreEs || ''} ${eq.nombreZh ? '(' + eq.nombreZh + ')' : ''} - N° Serie: ${eq.serie || 'N/A'}
        </div>
        <div style="display:flex;gap:12px;width:100%">
          ${fotoEq ? `
            <div class="foto-card">
              <div class="foto-titulo">设备照片 / FOTO DEL EQUIPO EN VENTA</div>
              <img src="${fotoEq}" class="foto-img" alt="Foto Equipo"/>
            </div>
          ` : `
            <div class="foto-card">
              <div class="foto-titulo">设备照片 / FOTO DEL EQUIPO EN VENTA</div>
              <div style="height:220px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;color:#9ca3af;border:1px solid #ccc;width:100%">Sin Foto Registrada</div>
            </div>
          `}
          ${fotoPl ? `
            <div class="foto-card">
              <div class="foto-titulo">铭牌/底盘照片 / FOTO DE SERIE Y PLACA DE EQUIPO</div>
              <img src="${fotoPl}" class="foto-img" alt="Foto Placa"/>
            </div>
          ` : `
            <div class="foto-card">
              <div class="foto-titulo">铭牌/底盘照片 / FOTO DE SERIE Y PLACA DE EQUIPO</div>
              <div style="height:220px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;color:#9ca3af;border:1px solid #ccc;width:100%">Sin Foto Registrada</div>
            </div>
          `}
        </div>
      </div>
    `
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Formulario de Confirmación de Venta - SAJAMA</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans SC','Microsoft YaHei',Arial,sans-serif; font-size:8.5pt; color:#111; padding:6mm 8mm; }
.header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; border-bottom:2px solid #6b21a8; padding-bottom:6px; }
.logo { font-size:16pt; font-weight:900; color:#6b21a8; letter-spacing:0.5px; }
.htxt { flex:1; text-align:center; }
.titzh { font-size:13pt; font-weight:700; line-height:1.2; }
.tites { font-size:9pt; color:#6b21a8; font-weight:600; margin-top:2px; }

.box-cotizacion { display:flex; justify-content:space-between; align-items:center; background:#faf5ff; border:1.5px solid #8b5cf6; padding:6px 12px; border-radius:6px; margin-bottom:8px; font-size:8.5pt; }
.badge-estado { display:inline-block; padding:4px 12px; background:#6b21a8; color:#fff; font-weight:bold; border-radius:4px; font-size:8.5pt; letter-spacing:0.5px; }

table { width:100%; border-collapse:collapse; margin-bottom:6px; font-size:7.5pt; }
th { background:#f3e8ff; border:1px solid #666; padding:4px 3px; text-align:center; font-weight:700; line-height:1.2; font-size:7.5pt; color:#4c1d95; }
td { border:1px solid #777; padding:4px 4px; }
.total-row td { font-weight:700; background:#f5f3ff; }

.seccion-fotos { display:flex; flex-direction:column; gap:6px; margin:8px 0; border:1.5px solid #666; padding:8px; background:#fff; border-radius:4px; page-break-inside:avoid; }
.foto-card { flex:1; text-align:center; display:flex; flex-direction:column; align-items:center; }
.foto-titulo { font-size:8pt; font-weight:bold; color:#6b21a8; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.3px; }
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
    <div class="titzh">SAJAMA 公司设备销售与过户确认单</div>
    <div class="tites">Formulario de Confirmación de Venta y Transferencia de Equipos - SAJAMA</div>
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
    <th style="width:11%">N° Serie / Placa</th>
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
      <td colspan="11" style="text-align:right;padding-right:8px;font-size:8.5pt">MONTO TOTAL CONTRATO VENTA:</td>
      <td style="text-align:right;font-size:8.5pt;font-weight:bold">${montoTotalBs.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs</td>
      <td style="text-align:right;font-size:8.5pt;font-weight:bold;color:#6b21a8">$ ${montoTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</td>
      <td></td>
    </tr>
  </tbody>
</table>

${fotosHTML}

<div class="datos">
  <div class="fila-datos">
    <div class="celda-dato"><b>Estado de Operación</b><span class="celda-valor" style="font-weight:bold;color:#6b21a8">${estadoOp}</span></div>
    <div class="celda-dato"><b>Cotización Dólar BCB</b><span class="celda-valor" style="font-family:monospace;font-weight:bold">1 USD = ${tcDolar.toFixed(2)} BOB</span></div>
    <div class="celda-dato"><b>Forma de Pago</b><span class="celda-valor" style="font-weight:bold">${datosVenta.formaPago || 'Efectivo'}</span></div>
    <div class="celda-dato"><b>Fecha de Venta</b><span class="celda-valor">${fechaFmt}</span></div>
  </div>
  <div class="fila-datos">
    <div class="celda-dato"><b>Nombre / Razón Social Comprador</b><span class="celda-valor" style="font-weight:bold">${datosVenta.compradorNombre || ''}</span></div>
    <div class="celda-dato"><b>CI / NIT Comprador</b><span class="celda-valor">${datosVenta.compradorCiNit || ''}</span></div>
    <div class="celda-dato"><b>Teléfono Comprador</b><span class="celda-valor">${datosVenta.compradorTelefono || ''}</span></div>
    <div class="celda-dato"><b>Dirección / Ubicación Comprador</b><span class="celda-valor">${datosVenta.compradorDireccion || ''}</span></div>
  </div>
  <div class="fila-datos">
    <div class="celda-dato"><b>Vendedor Responsable (SAJAMA)</b><span class="celda-valor">${datosVenta.vendedorNombre || ''} ${datosVenta.vendedorTelefono ? '· ' + datosVenta.vendedorTelefono : ''}</span></div>
    <div class="celda-dato" style="flex:2"><b>Observaciones y Condiciones de Venta</b><span class="celda-valor">${datosVenta.observacionesVenta || ''}</span></div>
    <div class="celda-dato"><b>Firma de Conformidad (Comprador)</b><span class="celda-valor" style="font-weight:bold">${datosVenta.compradorFirma || datosVenta.compradorNombre || ''}</span></div>
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

// ── Impresión del formulario de transporte bilingüe de Equipos con fotos (A4 Horizontal) ──
function imprimirFormularioTransporteEquipos(equipos, datosTransporte) {
  const fechaFmt = datosTransporte.fecha ? format(new Date(datosTransporte.fecha + 'T00:00:00'), 'dd/MM/yyyy') : ''
  const tcDolar = datosTransporte.tipoCambioDolar || 12.58
  const estadoOp = (datosTransporte.estadoOperacion || 'Despachado').toUpperCase()

  let montoTotalBs = 0
  let montoTotalUsd = 0

  const filasHTML = equipos.map((eq, i) => {
    const precioUsd = eq.precioUsd ? Number(eq.precioUsd) : (eq.precio ? Number(eq.precio) : (eq.precioBs ? Number(eq.precioBs) / tcDolar : 0))
    const precioBs = tcDolar > 0 ? (precioUsd * tcDolar) : (eq.precioBs ? Number(eq.precioBs) : 0)
    montoTotalBs += precioBs
    montoTotalUsd += precioUsd

    const polizaText = eq.numPoliza ? `N° ${eq.numPoliza}` : (eq.polizaUrl ? 'PDF Adjunto' : 'Sin póliza')

    return `
      <tr>
        <td style="text-align:center;border:1px solid #777;padding:5px">${i + 1}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:700;color:#047857;font-size:7.5pt">${eq.empresa || 'SAJAMA S.R.L.'}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:600">${eq.nombreZh || ''}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:600">${eq.nombreEs || ''}</td>
        <td style="border:1px solid #777;padding:5px">${eq.modelo || ''}</td>
        <td style="border:1px solid #777;padding:5px;font-family:monospace;font-weight:bold">${eq.serie || ''}</td>
        <td style="border:1px solid #777;padding:5px;font-size:7.5pt;text-align:center;font-weight:bold;color:#1e3a8a">${polizaText}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold">${precioBs ? precioBs.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs' : '—'}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold;color:#047857">$ ${precioUsd ? precioUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD' : '—'}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px">${eq.unidad || 'Unidad'}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px;font-weight:bold">1</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold">${precioBs ? precioBs.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs' : '—'}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold;color:#047857">$ ${precioUsd ? precioUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD' : '—'}</td>
        <td style="border:1px solid #777;padding:5px;font-size:7.5pt">${eq.observaciones || ''}</td>
      </tr>`
  }).join('')

  const fotosHTML = equipos.map(eq => {
    const fotoEq = eq.fotoEquipoUrl || eq.fotoMaquinaUrl
    const fotoPl = eq.fotoPlacaUrl
    if (!fotoEq && !fotoPl) return ''
    return `
      <div class="seccion-fotos">
        <div style="width:100%;font-weight:bold;color:#047857;margin-bottom:6px;font-size:8.5pt;border-bottom:1px solid #ddd;padding-bottom:2px">
          [${eq.empresa || 'SAJAMA S.R.L.'}] ${eq.nombreEs || ''} ${eq.nombreZh ? '(' + eq.nombreZh + ')' : ''} - N° Serie: ${eq.serie || 'N/A'}
        </div>
        <div style="display:flex;gap:12px;width:100%">
          ${fotoEq ? `
            <div class="foto-card">
              <div class="foto-titulo">设备照片 / FOTO DEL EQUIPO</div>
              <img src="${fotoEq}" class="foto-img" alt="Foto Equipo"/>
            </div>
          ` : `
            <div class="foto-card">
              <div class="foto-titulo">设备照片 / FOTO DEL EQUIPO</div>
              <div style="height:220px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;color:#9ca3af;border:1px solid #ccc;width:100%">Sin Foto Registrada</div>
            </div>
          `}
          ${fotoPl ? `
            <div class="foto-card">
              <div class="foto-titulo">铭牌/底盘照片 / FOTO DE SERIE Y PLACA DE EQUIPO</div>
              <img src="${fotoPl}" class="foto-img" alt="Foto Placa"/>
            </div>
          ` : `
            <div class="foto-card">
              <div class="foto-titulo">铭牌/底盘照片 / FOTO DE SERIE Y PLACA DE EQUIPO</div>
              <div style="height:220px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;color:#9ca3af;border:1px solid #ccc;width:100%">Sin Foto Registrada</div>
            </div>
          `}
        </div>
      </div>
    `
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Formulario de Transporte y Venta de Equipos - SAJAMA</title>
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
    <div class="titzh">SAJAMA 公司设备运输与过户确认单</div>
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
    <th style="width:11%">N° Serie / Placa</th>
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

// ── Impresión de Planilla General de Equipos (A4 Horizontal por defecto) ──
function imprimirPlanillaEquipos(equipos) {
  const montoTotal = equipos.reduce((a, eq) => a + (Number(eq.precioBs) || Number(eq.precio) || 0), 0)
  const fechaHoy = format(new Date(), 'dd/MM/yyyy')

  const filasHTML = equipos.map((eq, i) => {
    const fechaFmt = eq.fecha ? format(new Date(eq.fecha + 'T00:00:00'), 'dd/MM/yyyy') : (eq.creadoEn?.toDate ? format(eq.creadoEn.toDate(), 'dd/MM/yyyy') : '—')
    return `
      <tr>
        <td style="text-align:center;border:1px solid #777;padding:5px">${i + 1}</td>
        <td style="border:1px solid #777;padding:5px">
          <div style="font-weight:bold;color:#111">${eq.nombreEs || ''}</div>
          ${eq.nombreZh ? `<div style="font-size:7.5pt;color:#555">${eq.nombreZh}</div>` : ''}
        </td>
        <td style="border:1px solid #777;padding:5px">
          <div>Mod: <b>${eq.modelo || '—'}</b></div>
          <div style="font-size:7.5pt;color:#555">Serie: <b>${eq.serie || '—'}</b></div>
        </td>
        <td style="text-align:center;border:1px solid #777;padding:5px">
          <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:7.5pt;font-weight:bold;background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd">${eq.estado || 'A la venta'}</span>
        </td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold">${eq.precioBs ? Number(eq.precioBs).toLocaleString() + ' Bs' : (eq.precio ? Number(eq.precio).toLocaleString() + ' Bs' : '—')}</td>
        <td style="border:1px solid #777;padding:5px;font-size:7.5pt">
          ${eq.polizaUrl ? '📄 Póliza adjunta' : 'Sin póliza'}
          ${eq.numPoliza ? `<br/><b>N°: ${eq.numPoliza}</b>` : ''}
        </td>
        <td style="text-align:center;border:1px solid #777;padding:5px">${fechaFmt}</td>
      </tr>
    `
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Planilla de Equipos - SAJAMA</title>
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

@page { size:A4 landscape; margin:8mm 8mm; }
@media print { body { padding:0; } }
</style></head><body>
<div class="header">
  <div class="logo" style="display:flex;align-items:center;gap:8px"><img src="${window.location.origin}/logo-sajama.jpg" alt="Sajama 4x4" style="width:42px;height:42px;border-radius:7px;object-fit:cover;border:1px solid #16241F" /><span>Sajama.SRL</span></div>
  <div class="htxt">
    <div class="titzh">SAJAMA 公司设备清单</div>
    <div class="tites">Planilla de Control de Equipos - SAJAMA</div>
  </div>
  <div style="font-size:8pt;text-align:right;color:#555">Fecha de impresión:<br/><b>${fechaHoy}</b></div>
</div>

<table>
  <thead><tr>
    <th style="width:4%">No.</th>
    <th style="width:24%">Equipo / Nombre</th>
    <th style="width:18%">Modelo / Serie</th>
    <th style="width:12%">Estado</th>
    <th style="width:14%">Precio (Bs)</th>
    <th style="width:18%">Póliza PDF</th>
    <th style="width:10%">Fecha</th>
  </tr></thead>
  <tbody>
    ${filasHTML}
    <tr class="total-row">
      <td colspan="4" style="text-align:right;padding-right:8px;font-size:8.5pt">Total acumulado (${equipos.length} ítems):</td>
      <td style="text-align:right;font-size:9pt;font-weight:bold;padding-right:6px">${montoTotal.toLocaleString()} Bs</td>
      <td colspan="2"></td>
    </tr>
  </tbody>
</table>

<script>
window.onload = () => { setTimeout(() => window.print(), 300); };
</script>
</body></html>`

  const w = window.open('', '_blank', 'width=1100,height=800')
  w.document.write(html)
  w.document.close()
}

// ── Modal Registro de Control de Ventas y Formularios de Transporte de Equipos ──
function ModalRegistroEquipos({ open, onClose, equipos }) {
  const { perfil, tienePermiso } = useAuth()

  const [auditorias, setAuditorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const [editandoFormulario, setEditandoFormulario] = useState(null)
  const [delRegistro, setDelRegistro] = useState(null)

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
    const q = query(collection(db, 'auditoria'), where('modulo', '==', 'Equipos'))
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

    let listEquipos = []
    if (item.equiposInfo && item.equiposInfo.length > 0) {
      listEquipos = item.equiposInfo
    } else if (item.equiposIds && item.equiposIds.length > 0) {
      listEquipos = equipos.filter(eq => item.equiposIds.includes(eq.id))
    } else if (item.equipoId) {
      const eq = equipos.find(x => x.id === item.equipoId)
      if (eq) listEquipos = [eq]
      else if (item.datosDespues || item.datosAntes) listEquipos = [item.datosDespues || item.datosAntes]
    }

    if (listEquipos.length === 0) {
      const match = equipos.find(eq => item.detalle && item.detalle.includes(eq.nombreEs))
      if (match) listEquipos = [match]
      else listEquipos = [{
        nombreEs: item.detalle || 'Equipo en Registro',
        nombreZh: '', modelo: '', serie: '', precio: 0, precioBs: 0, unidad: 'Unidad', observaciones: ''
      }]
    }

    return { dt, listEquipos }
  }

  const handleVerImprimir = (item) => {
    const { dt, listEquipos } = obtenerDatosFormulario(item)
    if (dt.esFormularioVenta || (item.accion || '').toUpperCase() === 'VENTA') {
      imprimirFormularioVentaEquipos(listEquipos, dt)
    } else {
      imprimirFormularioTransporteEquipos(listEquipos, dt)
    }
  }

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

  const handleGuardarEditFormulario = async (e) => {
    e.preventDefault()
    if (!editandoFormulario) return
    try {
      const { listEquipos } = obtenerDatosFormulario(editandoFormulario)
      const tcDolar = Number(formEditTransporte.tipoCambioDolar) || 12.58

      let montoTotalUsd = 0
      for (const eq of listEquipos) {
        const usd = eq.precioUsd ? Number(eq.precioUsd) : (eq.precio ? Number(eq.precio) : (eq.precioBs ? Number(eq.precioBs) / tcDolar : 0))
        montoTotalUsd += usd
      }
      const montoTotalBs = montoTotalUsd * tcDolar

      const datosTransporteActualizados = {
        ...formEditTransporte,
        montoTotalBs,
        montoTotalUsd
      }

      const estadoNuevo = formEditTransporte.estadoOperacion || 'Despachado'
      const nombresEq = listEquipos.map(eq => eq.nombreEs).join(', ')

      const docRef = doc(db, 'auditoria', editandoFormulario.id)
      await updateDoc(docRef, {
        datosTransporte: datosTransporteActualizados,
        estadoNuevo: estadoNuevo,
        accion: estadoNuevo.toUpperCase(),
        detalle: `Formulario de Venta/Transporte (${estadoNuevo}): ${nombresEq} [Total: $${montoTotalUsd.toFixed(2)} USD / ${montoTotalBs.toFixed(2)} Bs @ TC BCB: ${tcDolar}]`,
        actualizadoPor: perfil?.nombre || 'Sistema',
        actualizadoEn: serverTimestamp()
      })

      const eqIds = editandoFormulario.equiposIds || (editandoFormulario.equipoId ? [editandoFormulario.equipoId] : listEquipos.map(e => e.id).filter(Boolean))
      for (const eqId of eqIds) {
        if (eqId) {
          await updateDoc(doc(db, 'equipos', eqId), {
            estado: estadoNuevo,
            actualizadoPor: perfil?.nombre || 'Sistema',
            actualizadoEn: serverTimestamp()
          })
        }
      }

      toast.success(`Formulario de Equipos actualizado y estado sincronizado a "${estadoNuevo}".`)
      setEditandoFormulario(null)
    } catch (e) {
      toast.error('Error al actualizar formulario: ' + e.message)
    }
  }

  const handleEliminarRegistro = async () => {
    if (!delRegistro) return
    try {
      const item = delRegistro
      const { listEquipos } = obtenerDatosFormulario(item)
      const eqIds = item.equiposIds || (item.equipoId ? [item.equipoId] : listEquipos.map(e => e.id).filter(Boolean))
      const estadoARestaurar = item.estadoAnterior || 'A la venta'

      for (const eqId of eqIds) {
        if (eqId) {
          await updateDoc(doc(db, 'equipos', eqId), {
            estado: estadoARestaurar,
            actualizadoPor: perfil?.nombre || 'Sistema',
            actualizadoEn: serverTimestamp()
          })
        }
      }

      await deleteDoc(doc(db, 'auditoria', item.id))
      toast.success(`Registro eliminado. Estado de equipo(s) restaurado a "${estadoARestaurar}".`)
      setDelRegistro(null)
    } catch (e) {
      toast.error('Error al eliminar registro: ' + e.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Control de Ventas y Formularios de Equipos" size="xl">
      <div className="space-y-4">
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
              placeholder="Buscar por cliente, camión, equipo, conductor..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
            />
          </div>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-primary" size={24}/></div>
          ) : registrosVentasDespachos.length === 0 ? (
            <div className="py-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <Truck size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-gray-600 font-bold text-sm">No hay formularios de venta o transporte registrados.</p>
              <p className="text-xs text-gray-400 mt-1">Al emitir un Formulario de Venta o Transporte desde la pantalla principal, aparecerán aquí.</p>
            </div>
          ) : (
            registrosVentasDespachos.map(item => {
              const fechaFmt = item.fecha?.toDate ? format(item.fecha.toDate(), 'dd/MM/yyyy HH:mm') : '—'
              const { dt } = obtenerDatosFormulario(item)
              const estadoBadge = item.estadoNuevo || dt.estadoOperacion || 'Despachado'

              return (
                <div key={item.id} className="bg-white border border-gray-200 hover:border-primary/40 rounded-xl p-3.5 shadow-sm transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                        {fechaFmt}
                      </span>
                      <span className="text-xs font-black uppercase tracking-wide text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                        {item.accion || 'TRANSACCIÓN'}
                      </span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Estado: {estadoBadge}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-gray-900 line-clamp-2 mt-1">
                      {item.detalle}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] text-gray-500 flex-wrap pt-0.5">
                      {dt.destino && <span>📍 <b>Destino:</b> {dt.destino}</span>}
                      {dt.conductorNombre && <span>🚛 <b>Conductor:</b> {dt.conductorNombre} ({dt.placaCamion || 'Sin placa'})</span>}
                      {dt.compradorNombre && <span>👤 <b>Comprador:</b> {dt.compradorNombre}</span>}
                      <span>✍️ <b>Registrado por:</b> {item.usuario || 'Sistema'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handleVerImprimir(item)}
                      className="px-3 py-1.5 bg-[#EEF2F0] text-[#16241F] hover:bg-[#E2E7E4] border border-[#CBD4CF] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Ver / Imprimir Formulario en A4"
                    >
                      <Printer size={13}/> Formulario
                    </button>
                    <button
                      onClick={() => handleAbrirEditar(item)}
                      className="p-1.5 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                      title="Editar datos del formulario"
                    >
                      <Edit3 size={15}/>
                    </button>
                    <button
                      onClick={() => setDelRegistro(item)}
                      className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar registro y restaurar estado en inventario"
                    >
                      <Trash2 size={15}/>
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Modal Edición de Formulario */}
      {editandoFormulario && (
        <Modal open={Boolean(editandoFormulario)} onClose={() => setEditandoFormulario(null)} title="Editar Formulario de Venta / Transporte" size="md">
          <form onSubmit={handleGuardarEditFormulario} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Estado Operación</label>
                <select
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded font-bold text-primary"
                  value={formEditTransporte.estadoOperacion}
                  onChange={e => setFormEditTransporte({ ...formEditTransporte, estadoOperacion: e.target.value })}
                >
                  <option value="Vendido">Vendido</option>
                  <option value="Despachado">Despachado</option>
                  <option value="Entregado">Entregado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cotización Dólar (BCB)</label>
                <input
                  type="number" step="0.01"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded font-mono font-bold"
                  value={formEditTransporte.tipoCambioDolar}
                  onChange={e => setFormEditTransporte({ ...formEditTransporte, tipoCambioDolar: parseFloat(e.target.value) || 12.58 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Placa Camión</label>
                <input className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" value={formEditTransporte.placaCamion} onChange={e => setFormEditTransporte({ ...formEditTransporte, placaCamion: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
                <input type="date" className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" value={formEditTransporte.fecha} onChange={e => setFormEditTransporte({ ...formEditTransporte, fecha: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Conductor</label>
                <input className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" value={formEditTransporte.conductorNombre} onChange={e => setFormEditTransporte({ ...formEditTransporte, conductorNombre: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tel. Conductor</label>
                <input className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" value={formEditTransporte.conductorTelefono} onChange={e => setFormEditTransporte({ ...formEditTransporte, conductorTelefono: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre quien envía (SAJAMA)</label>
                <input className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" value={formEditTransporte.enviaNombre} onChange={e => setFormEditTransporte({ ...formEditTransporte, enviaNombre: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Destino / Cliente</label>
                <input className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" value={formEditTransporte.destino} onChange={e => setFormEditTransporte({ ...formEditTransporte, destino: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Descripción de Cargos / Detalle</label>
              <textarea rows={2} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded resize-none" value={formEditTransporte.descripcionCargos} onChange={e => setFormEditTransporte({ ...formEditTransporte, descripcionCargos: e.target.value })} />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setEditandoFormulario(null)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">Guardar Cambios</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Confirmación de Eliminar Registro */}
      {delRegistro && (
        <Modal open={Boolean(delRegistro)} onClose={() => setDelRegistro(null)} title="Eliminar Registro de Formulario" size="sm">
          <div className="space-y-3 text-xs">
            <p className="text-gray-700">
              ¿Deseas eliminar este formulario registrado? Esta acción eliminará el registro de auditoría y <strong>restaurará el estado del equipo a &quot;A la venta&quot;</strong> en el inventario.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setDelRegistro(null)} className="btn-secondary">Cancelar</button>
              <button onClick={handleEliminarRegistro} className="btn-primary bg-red-600 hover:bg-red-700">Eliminar y Restaurar Stock</button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  )
}

export default function Equipos() {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const { perfil } = useAuth()
  const [equipos, setEquipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [tab, setTab] = useState('a_la_venta')
  const [seleccionadas, setSeleccionadas] = useState(new Set())
  const [agrupar, setAgrupar] = useState(true)
  const [verFoto, setVerFoto] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalTransporte, setModalTransporte] = useState(false)
  const [modalVenta, setModalVenta] = useState(false)
  const [modalRegistro, setModalRegistro] = useState(false)
  const [modalExcel, setModalExcel] = useState(false)
  const [empresaExcel, setEmpresaExcel] = useState('')
  const [estadoExcel, setEstadoExcel] = useState('')

  const [editando, setEditando] = useState(null)
  const [delEquipo, setDelEquipo] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [traduciendo, setTraduciendo] = useState(false)
  const timerRef = useRef(null)

  const [cotizacionBcb, setCotizacionBcb] = useState(12.58)

  const [form, setForm] = useState({
    empresa: 'SAJAMA S.R.L.',
    nombreEs: '', nombreZh: '', modelo: '', serie: '',
    categoria: 'Equipos', cantidad: 1, precio: '', precioBs: '', tipoCambio: 12.58, estado: 'A la venta',
    fecha: format(new Date(), 'yyyy-MM-dd'),
    numPoliza: '', observaciones: ''
  })
  const [fotoEquipo, setFotoEquipo] = useState(null)
  const [fotoPlaca, setFotoPlaca] = useState(null)
  const [archivoPdf, setArchivoPdf] = useState(null)

  useEffect(() => {
    const unsubCot = suscribirCotizacionUSD(tc => { if (tc) setCotizacionBcb(tc) })

    const unsubEq = onSnapshot(
      query(collection(db, 'equipos'), orderBy('creadoEn', 'desc')),
      snap => {
        setEquipos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      err => {
        console.error('Error cargando equipos:', err)
        toast.error('Error cargando equipos: ' + err.message)
        setLoading(false)
      }
    )
    return () => {
      unsubCot()
      unsubEq()
    }
  }, [])

  const canEdit = ['administrador', 'gerencia', 'almacenero'].includes(perfil?.rol)
  const canDelete = perfil?.rol === 'administrador'

  const handleNombreEsChange = (e) => {
    const val = e.target.value
    setForm(prev => ({ ...prev, nombreEs: val }))
    clearTimeout(timerRef.current)
    if (val.trim().length < 2) return
    timerRef.current = setTimeout(async () => {
      setTraduciendo(true)
      try {
        const zh = await traducirAlChino(val)
        if (zh) setForm(prev => ({ ...prev, nombreZh: zh }))
      } finally { setTraduciendo(false) }
    }, 700)
  }

  const handleTraducirManual = async () => {
    if (!form.nombreEs.trim()) return
    setTraduciendo(true)
    try {
      const zh = await traducirAlChino(form.nombreEs)
      if (zh) setForm(prev => ({ ...prev, nombreZh: zh }))
    } finally { setTraduciendo(false) }
  }

  const resetForm = () => {
    setForm({
      empresa: 'SAJAMA S.R.L.',
      nombreEs: '', nombreZh: '', modelo: '', serie: '',
      categoria: 'Equipos', cantidad: 1, precio: '', precioBs: '', tipoCambio: cotizacionBcb, estado: 'A la venta',
      fecha: format(new Date(), 'yyyy-MM-dd'),
      numPoliza: '', observaciones: ''
    })
    setFotoEquipo(null)
    setFotoPlaca(null)
    setArchivoPdf(null)
    setEditando(null)
  }

  const handleAbrirEditar = (eq) => {
    setEditando(eq)
    const tc = cotizacionBcb
    const pUsd = eq.precioUsd ? String(eq.precioUsd) : (eq.precio ? String(eq.precio) : (eq.precioBs ? (Number(eq.precioBs) / tc).toFixed(2) : ''))
    const pBs = pUsd !== '' ? (Number(pUsd) * tc).toFixed(2) : (eq.precioBs ? String(eq.precioBs) : '')
    setForm({
      empresa: eq.empresa || 'SAJAMA S.R.L.',
      nombreEs: eq.nombreEs || '',
      nombreZh: eq.nombreZh || '',
      modelo: eq.modelo || '',
      serie: eq.serie || '',
      categoria: eq.categoria || 'Equipos',
      cantidad: eq.cantidad || 1,
      precio: pUsd,
      precioBs: pBs,
      tipoCambio: tc,
      estado: eq.estado || 'A la venta',
      fecha: eq.fecha || format(new Date(), 'yyyy-MM-dd'),
      numPoliza: eq.numPoliza || '',
      observaciones: eq.observaciones || ''
    })
    setFotoEquipo(null)
    setFotoPlaca(null)
    setArchivoPdf(null)
    setModalOpen(true)
  }

  const subirArchivoStorage = async (id, tipo, file) => {
    const path = `equipos/${id}/${tipo}-${Date.now()}-${file.name}`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file)
    return await getDownloadURL(storageRef)
  }

  const handleGuardar = async (e) => {
    e.preventDefault()
    if (!form.nombreEs.trim()) {
      return toast.error('El nombre del equipo es obligatorio')
    }

    setGuardando(true)
    try {
      const esNuevo = !editando
      const docRef = esNuevo ? doc(collection(db, 'equipos')) : doc(db, 'equipos', editando.id)

      let polizaUrl = editando?.polizaUrl || ''
      let polizaNombre = editando?.polizaNombre || ''
      let fotoEquipoUrl = editando?.fotoEquipoUrl || ''
      let fotoPlacaUrl = editando?.fotoPlacaUrl || ''

      if (archivoPdf) {
        polizaUrl = await subirArchivoStorage(docRef.id, 'poliza', archivoPdf)
        polizaNombre = archivoPdf.name
      }
      if (fotoEquipo) {
        fotoEquipoUrl = await subirArchivoStorage(docRef.id, 'equipo', fotoEquipo)
      }
      if (fotoPlaca) {
        fotoPlacaUrl = await subirArchivoStorage(docRef.id, 'placa', fotoPlaca)
      }

      const tc = form.tipoCambio || cotizacionBcb
      const pUsd = form.precio ? parseFloat(form.precio) : (form.precioBs ? parseFloat(form.precioBs) / tc : 0)
      const pBs = tc > 0 ? (pUsd * tc) : (form.precioBs ? parseFloat(form.precioBs) : 0)

      const payload = {
        empresa: form.empresa || 'SAJAMA S.R.L.',
        nombreEs: form.nombreEs.trim(),
        nombreZh: form.nombreZh.trim(),
        modelo: form.modelo.trim(),
        serie: form.serie.trim(),
        categoria: form.categoria,
        cantidad: form.cantidad ? Math.max(1, parseInt(form.cantidad, 10)) : 1,
        precio: pUsd,
        precioBs: pBs,
        precioUsd: pUsd,
        tipoCambio: tc,
        estado: form.estado,
        fecha: form.fecha,
        numPoliza: form.numPoliza.trim(),
        observaciones: form.observaciones.trim(),
        polizaUrl,
        polizaNombre,
        fotoEquipoUrl,
        fotoPlacaUrl
      }

      if (esNuevo) {
        await setDoc(docRef, {
          ...payload,
          creadoPor: perfil?.nombre || 'Sistema',
          creadoEn: serverTimestamp()
        })
        await registrarAccion({
          usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Equipos',
          accion: 'CREAR', detalle: `Creó equipo: ${payload.nombreEs} (${pBs} Bs / $${pUsd.toFixed(2)} USD)`
        })
        toast.success('Equipo registrado correctamente')
      } else {
        await updateDoc(docRef, {
          ...payload,
          actualizadoPor: perfil?.nombre || 'Sistema',
          actualizadoEn: serverTimestamp()
        })
        await registrarAccion({
          usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Equipos',
          accion: 'EDITAR', detalle: `Editó equipo: ${payload.nombreEs}`
        })
        toast.success('Equipo actualizado correctamente')
      }

      setModalOpen(false)
      resetForm()
    } catch (err) {
      console.error(err)
      toast.error('Error al guardar equipo: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminar = async () => {
    if (!delEquipo) return
    try {
      await deleteDoc(doc(db, 'equipos', delEquipo.id))
      await registrarAccion({
        usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Equipos',
        accion: 'ELIMINAR', detalle: `Eliminó equipo: ${delEquipo.nombreEs}`
      })
      toast.success('Equipo eliminado')
      setDelEquipo(null)
      setSeleccionadas(prev => { const n = new Set(prev); n.delete(delEquipo.id); return n })
    } catch (err) {
      toast.error('Error al eliminar: ' + err.message)
    }
  }

  const handleImprimirPlanilla = () => {
    if (seleccionadas.size === 0) {
      toast.error('Por favor tikea o selecciona al menos un equipo para imprimir la planilla.')
      return
    }
    imprimirPlanillaEquipos(equiposSeleccionados)
  }

  const handleImprimirTransporte = async (datosTransporte) => {
    try {
      const estadoNuevo = datosTransporte.estadoOperacion || 'Despachado'

      const equiposInfo = equiposSeleccionados.map(eq => ({
        id: eq.id,
        nombreEs: eq.nombreEs,
        nombreZh: eq.nombreZh || '',
        modelo: eq.modelo || '',
        serie: eq.serie || '',
        precioBs: eq.precioBs || eq.precio || 0,
        precioUsd: eq.precioUsd || 0,
        unidad: eq.unidad || 'Unidad',
        observaciones: eq.observaciones || '',
        fotoEquipoUrl: eq.fotoEquipoUrl || eq.fotoMaquinaUrl || '',
        fotoPlacaUrl: eq.fotoPlacaUrl || ''
      }))

      for (const eq of equiposSeleccionados) {
        await updateDoc(doc(db, 'equipos', eq.id), {
          estado: estadoNuevo,
          actualizadoPor: perfil?.nombre || 'Sistema',
          actualizadoEn: serverTimestamp()
        })
      }

      const nombresEq = equiposSeleccionados.map(e => e.nombreEs).join(', ')

      await registrarAccion({
        usuario: perfil?.nombre || 'Sistema',
        rol: perfil?.rol || 'Administrador',
        modulo: 'Equipos',
        accion: estadoNuevo.toUpperCase(),
        detalle: `Formulario de Transporte (${estadoNuevo}): ${nombresEq} [Total: $${(datosTransporte.montoTotalUsd || 0).toFixed(2)} USD / ${(datosTransporte.montoTotalBs || 0).toFixed(2)} Bs @ TC BCB: ${datosTransporte.tipoCambioDolar || cotizacionBcb}]`,
        equipoId: equiposSeleccionados[0]?.id || null,
        equiposIds: equiposSeleccionados.map(e => e.id),
        equiposInfo: equiposInfo,
        datosTransporte: datosTransporte,
        estadoAnterior: equiposSeleccionados[0]?.estado || 'A la venta',
        estadoNuevo: estadoNuevo
      })

      imprimirFormularioTransporteEquipos(equiposSeleccionados, datosTransporte)
      toast.success(`¡Formulario registrado con éxito! El estado de ${equiposSeleccionados.length} equipo(s) se actualizó automáticamente a "${estadoNuevo}" en la base de datos.`, { duration: 6000 })
      setSeleccionadas(new Set())
      setModalTransporte(false)
    } catch (e) {
      toast.error('Error al procesar el formulario de transporte: ' + e.message)
    }
  }

  const handleImprimirVenta = async (datosVenta) => {
    try {
      const estadoNuevo = datosVenta.estadoOperacion || 'Vendido'

      const equiposInfo = equiposSeleccionados.map(eq => ({
        id: eq.id,
        nombreEs: eq.nombreEs,
        nombreZh: eq.nombreZh || '',
        modelo: eq.modelo || '',
        serie: eq.serie || '',
        precioBs: eq.precioBs || eq.precio || 0,
        precioUsd: eq.precioUsd || 0,
        unidad: eq.unidad || 'Unidad',
        observaciones: eq.observaciones || '',
        fotoEquipoUrl: eq.fotoEquipoUrl || eq.fotoMaquinaUrl || '',
        fotoPlacaUrl: eq.fotoPlacaUrl || ''
      }))

      for (const eq of equiposSeleccionados) {
        await updateDoc(doc(db, 'equipos', eq.id), {
          estado: estadoNuevo,
          actualizadoPor: perfil?.nombre || 'Sistema',
          actualizadoEn: serverTimestamp()
        })
      }

      const nombresEq = equiposSeleccionados.map(e => e.nombreEs).join(', ')

      await registrarAccion({
        usuario: perfil?.nombre || 'Sistema',
        rol: perfil?.rol || 'Administrador',
        modulo: 'Equipos',
        accion: 'VENTA',
        detalle: `Formulario de Venta (${estadoNuevo}): ${nombresEq} [Comprador: ${datosVenta.compradorNombre || 's/n'}] Total: $${(datosVenta.montoTotalUsd || 0).toFixed(2)} USD / ${(datosVenta.montoTotalBs || 0).toFixed(2)} Bs @ TC BCB: ${datosVenta.tipoCambioDolar || cotizacionBcb}`,
        equipoId: equiposSeleccionados[0]?.id || null,
        equiposIds: equiposSeleccionados.map(e => e.id),
        equiposInfo: equiposInfo,
        datosTransporte: datosVenta,
        estadoAnterior: equiposSeleccionados[0]?.estado || 'A la venta',
        estadoNuevo: estadoNuevo
      })

      imprimirFormularioVentaEquipos(equiposSeleccionados, datosVenta)
      toast.success(`¡Venta registrada con éxito! El estado de ${equiposSeleccionados.length} equipo(s) se actualizó automáticamente a "${estadoNuevo}" en la base de datos.`, { duration: 7000 })
      setSeleccionadas(new Set())
      setModalVenta(false)
    } catch (e) {
      toast.error('Error al procesar el formulario de venta: ' + e.message)
    }
  }

  // Filtrado por Tab, Empresa y Busqueda
  const rawFiltrados = useMemo(() => {
    return equipos.filter(eq => {
      if (tab === 'a_la_venta' && eq.estado !== 'A la venta') return false
      if (tab === 'vendidos_despachados' && eq.estado === 'A la venta') return false

      const empMatch = !empresaFiltro || (eq.empresa || 'SAJAMA S.R.L.') === empresaFiltro
      if (!empMatch) return false

      if (!busqueda.trim()) return true
      const q = busqueda.toLowerCase()
      return (
        eq.nombreEs?.toLowerCase().includes(q) ||
        eq.nombreZh?.toLowerCase().includes(q) ||
        eq.modelo?.toLowerCase().includes(q) ||
        eq.serie?.toLowerCase().includes(q) ||
        eq.numPoliza?.toLowerCase().includes(q) ||
        eq.estado?.toLowerCase().includes(q) ||
        (eq.empresa || 'SAJAMA S.R.L.').toLowerCase().includes(q)
      )
    })
  }, [equipos, tab, empresaFiltro, busqueda])

  const equiposFiltrados = useMemo(() => {
    if (!agrupar) return rawFiltrados

    const mapa = new Map()
    for (const eq of rawFiltrados) {
      const key = [
        (eq.nombreEs || '').toLowerCase().trim(),
        (eq.modelo || '').toLowerCase().trim(),
        (eq.serie || '').toLowerCase().trim(),
        (eq.empresa || 'SAJAMA S.R.L.').toLowerCase().trim(),
        (eq.estado || 'A la venta').toLowerCase().trim()
      ].join('|')

      const cantActual = eq.cantidad ? Number(eq.cantidad) : 1

      if (!mapa.has(key)) {
        mapa.set(key, {
          ...eq,
          cantidadTotal: cantActual,
          itemsGrupo: [eq],
          idsGrupo: [eq.id]
        })
      } else {
        const grp = mapa.get(key)
        grp.cantidadTotal += cantActual
        grp.itemsGrupo.push(eq)
        grp.idsGrupo.push(eq.id)
      }
    }

    return Array.from(mapa.values())
  }, [rawFiltrados, agrupar])

  const equiposSeleccionados = useMemo(() => {
    return equipos.filter(e => seleccionadas.has(e.id))
  }, [equipos, seleccionadas])

  const toggleSeleccionGrupo = (eq) => {
    const ids = eq.idsGrupo || [eq.id]
    setSeleccionadas(prev => {
      const n = new Set(prev)
      const todosSeleccionados = ids.every(id => n.has(id))
      if (todosSeleccionados) {
        ids.forEach(id => n.delete(id))
      } else {
        ids.forEach(id => n.add(id))
      }
      return n
    })
  }

  const toggleSeleccionarTodas = () => {
    const todosLosIds = rawFiltrados.map(e => e.id)
    if (seleccionadas.size === todosLosIds.length && todosLosIds.length > 0) {
      setSeleccionadas(new Set())
    } else {
      setSeleccionadas(new Set(todosLosIds))
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <HardHat size={24} className="text-primary"/> {isZh ? '设备' : 'Equipos'}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {equipos.length} {isZh ? '台/件已登记设备' : 'equipo(s) registrados'} — {seleccionadas.size} {isZh ? '台已选中' : 'seleccionado(s)'}
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

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setModalExcel(true)} className="btn-secondary btn-sm flex items-center gap-1.5" title={isZh ? '按日期范围导出 Excel 报表（不含图片）' : 'Exportar reporte Excel por rango de fechas (sin imágenes)'}>
            <FileSpreadsheet size={14} className="text-[#15803D]" /> {isZh ? '导出 Excel' : 'Reporte Excel'}
          </button>
          <button onClick={() => setModalRegistro(true)} className="btn-secondary btn-sm flex items-center gap-1.5" title={isZh ? '查看销售与流程记录' : 'Ver registro de ventas y procesos'}>
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
            <button onClick={() => { resetForm(); setModalOpen(true) }} className="btn-primary btn-sm flex items-center gap-2">
              <Plus size={14}/> {isZh ? '新建设备' : 'Registrar Equipo'}
            </button>
          )}
        </div>
      </div>

      {/* Control de Pestañas (Tabs) y Buscador */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-gray-200 pb-3">
        <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl overflow-x-auto max-w-full shrink-0">
          <button
            onClick={() => setTab('a_la_venta')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              tab === 'a_la_venta'
                ? 'bg-white text-emerald-700 shadow-sm font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {isZh ? `🏷️ 待售设备 (${equipos.filter(e => e.estado === 'A la venta').length})` : `🏷️ Equipos a la venta (${equipos.filter(e => e.estado === 'A la venta').length})`}
          </button>
          <button
            onClick={() => setTab('vendidos_despachados')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              tab === 'vendidos_despachados'
                ? 'bg-white text-[#16241F] shadow-sm font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {isZh ? `📦 已售 / 已交付 / 在库 (${equipos.filter(e => e.estado !== 'A la venta').length})` : `📦 Vendidos / Entregados / Existentes (${equipos.filter(e => e.estado !== 'A la venta').length})`}
          </button>
          <button
            onClick={() => setTab('todos')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              tab === 'todos'
                ? 'bg-white text-gray-900 shadow-sm font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {isZh ? `全部 (${equipos.length})` : `Todos (${equipos.length})`}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={isZh ? '按名称、序列号、型号、公司搜索...' : 'Buscar por nombre, serie, modelo, empresa...'}
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

          <button
            type="button"
            onClick={() => setAgrupar(a => !a)}
            className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 shrink-0 ${
              agrupar
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-sm'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
            title={agrupar ? (isZh ? '同类设备合并视图' : 'Vista agrupada por equipos idénticos') : (isZh ? '单件明细拆分视图' : 'Vista desglosada (registros individuales)')}
          >
            <span>{agrupar ? (isZh ? '✅ 合并同类' : '✅ Agrupados') : (isZh ? '📄 单项拆分' : '📄 Desglosados')}</span>
          </button>
        </div>
      </div>

      {/* Tabla de Equipos */}
      <div className="card p-0 overflow-hidden shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
              <tr>
                <th className="py-3 px-3 w-10">
                  <button onClick={toggleSeleccionarTodas} className="text-primary hover:scale-105 transition-transform" title={isZh ? '全选 / 取消全选' : 'Seleccionar todos / Deseleccionar todos'}>
                    {seleccionadas.size > 0 && seleccionadas.size === rawFiltrados.length ? <CheckSquare size={18}/> : <Square size={18} className="text-gray-300"/>}
                  </button>
                </th>
                <th className="py-3 px-4 w-14">{isZh ? '照片' : 'Foto'}</th>
                <th className="py-3 px-4">{isZh ? '所属公司' : 'Empresa'}</th>
                <th className="py-3 px-4">{isZh ? '设备 / 名称' : 'Equipo / Nombre'}</th>
                <th className="py-3 px-4">{isZh ? '型号 / 序列号' : 'Modelo / Serie'}</th>
                <th className="py-3 px-4">{isZh ? '状态' : 'Estado'}</th>
                <th className="py-3 px-4 text-center">{isZh ? '数量' : 'Cantidad'}</th>
                <th className="py-3 px-4 text-right">{isZh ? '价格 ($ USD)' : 'Precio ($ USD)'}</th>
                <th className="py-3 px-4 text-right">{isZh ? '价格 (Bs)' : 'Precio (Bs)'}</th>
                <th className="py-3 px-4">{isZh ? '报关单 PDF' : 'Póliza PDF'}</th>
                <th className="py-3 px-4">{isZh ? '日期' : 'Fecha'}</th>
                <th className="py-3 px-4 text-right">{isZh ? '操作' : 'Acciones'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {equiposFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-gray-400">
                    {isZh ? '此分类下未找到任何设备' : 'No se encontraron equipos en esta categoría'}
                  </td>
                </tr>
              ) : (
                equiposFiltrados.map(eq => {
                  const ids = eq.idsGrupo || [eq.id]
                  const esSeleccionado = ids.every(id => seleccionadas.has(id))
                  const estObj = ESTADOS.find(e => e.id === eq.estado) || ESTADOS[0]
                  const fechaFmt = eq.fecha ? format(new Date(eq.fecha + 'T00:00:00'), 'dd/MM/yyyy') : (eq.creadoEn?.toDate ? format(eq.creadoEn.toDate(), 'dd/MM/yyyy') : '—')

                  const cantTotal = eq.cantidadTotal || eq.cantidad || 1
                  const usdValUnit = eq.precioUsd ? Number(eq.precioUsd) : (eq.precio ? Number(eq.precio) : (eq.precioBs ? Number(eq.precioBs) / cotizacionBcb : 0))
                  const usdVal = usdValUnit * (agrupar ? cantTotal : 1)
                  const bsVal = usdVal > 0 ? (usdVal * cotizacionBcb) : (eq.precioBs ? Number(eq.precioBs) * (agrupar ? cantTotal : 1) : 0)
                  const fotoMostrar = eq.fotoEquipoUrl || eq.fotoMaquinaUrl

                  return (
                    <tr key={eq.id} className={`hover:bg-[#F8FAF9] transition-colors ${esSeleccionado ? 'bg-[#EEF2F0]' : ''}`}>
                      <td className="py-3 px-3">
                        <button onClick={() => toggleSeleccionGrupo(eq)} className="text-primary hover:scale-105 transition-transform">
                          {esSeleccionado ? <CheckSquare size={18}/> : <Square size={18} className="text-gray-300"/>}
                        </button>
                      </td>

                      <td className="py-3 px-4">
                        {fotoMostrar ? (
                          <img
                            src={fotoMostrar}
                            alt="foto"
                            className="w-10 h-10 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                            onClick={() => setVerFoto({
                              fotoUrl: fotoMostrar,
                              titulo: eq.nombreEs,
                              subtitulo: `Modelo: ${eq.modelo || '—'} | Serie: ${eq.serie || '—'} | Empresa: ${eq.empresa || 'SAJAMA S.R.L.'}`
                            })}
                            title="Haz clic para ampliar con zoom"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <ImageIcon size={16} className="text-gray-300"/>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 font-semibold text-xs text-gray-700">{eq.empresa || 'SAJAMA S.R.L.'}</td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{eq.nombreEs}</div>
                        {eq.nombreZh && <div className="text-xs text-gray-400">{eq.nombreZh}</div>}
                        {eq.observaciones && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{eq.observaciones}</p>
                        )}
                      </td>

                      <td className="py-3 px-4 text-gray-600">
                        <div><span className="font-medium text-gray-800">Mod:</span> {eq.modelo || '-'}</div>
                        <div className="text-xs text-gray-500"><span className="font-medium">Serie:</span> {eq.serie || '-'}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${estObj.color}`}>
                          <Tag size={12}/> {isZh ? (estObj.labelZh || estObj.label) : (estObj.label || 'A la venta')}
                        </span>
                      </td>

                      {/* Cantidad */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                          {cantTotal} {isZh ? '件' : 'unid.'}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-bold text-emerald-600 font-mono text-right">
                        {usdVal > 0 ? `$ ${usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-800 font-mono text-right">
                        {bsVal > 0 ? `${bsVal.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs` : '—'}
                      </td>

                      <td className="py-3 px-4">
                        {eq.polizaUrl ? (
                          <a
                            href={eq.polizaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                          >
                            <FileText size={14}/> {isZh ? '查看报关单 PDF' : 'Ver Póliza PDF'} <ExternalLink size={12}/>
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400 italic">{isZh ? '无报关单' : 'Sin póliza'}</span>
                        )}
                        {eq.numPoliza && (
                          <div className="text-[11px] text-gray-500 mt-0.5">N°: {eq.numPoliza}</div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-xs text-gray-500 font-medium">
                        {fechaFmt}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit && (
                            <button
                              onClick={() => handleAbrirEditar(eq)}
                              className="p-1.5 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                              title={isZh ? '编辑设备' : 'Editar equipo'}
                            >
                              <Edit3 size={16}/>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDelEquipo(eq)}
                              className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title={isZh ? '删除设备' : 'Eliminar equipo'}
                            >
                              <Trash2 size={16}/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Formulario de Venta */}
      {modalVenta && (
        <Modal open={modalVenta} onClose={() => setModalVenta(false)} title={isZh ? '设备销售表单' : 'Formulario de Venta de Equipos'} size="lg">
          <FormVentaEquipos
            equiposSeleccionados={equiposSeleccionados}
            cotizacionActual={cotizacionBcb}
            onImprimir={handleImprimirVenta}
            onCancelar={() => setModalVenta(false)}
            onVerFoto={setVerFoto}
          />
        </Modal>
      )}



      {/* Modal Registro de Procesos y Transacciones */}
      {modalRegistro && (
        <ModalRegistroEquipos
          open={modalRegistro}
          onClose={() => setModalRegistro(false)}
          equipos={equipos}
        />
      )}

      {/* Modal Crear / Editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editando ? (isZh ? '编辑设备' : 'Editar Equipo') : (isZh ? '新建设备' : 'Nuevo Equipo')} size="lg">
        <form onSubmit={handleGuardar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <CampoFoto label="Foto del equipo" urlActual={editando?.fotoEquipoUrl || editando?.fotoMaquinaUrl}
              archivoSeleccionado={fotoEquipo} onSeleccionar={setFotoEquipo} />
            <CampoFoto label="Foto de la placa / serie" urlActual={editando?.fotoPlacaUrl}
              archivoSeleccionado={fotoPlaca} onSeleccionar={setFotoPlaca} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre (Español) *</label>
              <input
                type="text"
                required
                placeholder="Ej. Compresor de Aire Industrial"
                value={form.nombreEs}
                onChange={handleNombreEsChange}
                className="input-field"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-700">
                  Nombre (Chino 中文) {traduciendo && <span className="text-[11px] text-primary font-normal">(traduciendo...)</span>}
                </label>
                <button type="button" onClick={handleTraducirManual} className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1">
                  <Languages size={12}/> Traducir
                </button>
              </div>
              <input
                type="text"
                placeholder="Ej. 工业空压机"
                value={form.nombreZh}
                onChange={e => setForm({ ...form, nombreZh: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Empresa *</label>
              <select
                value={form.empresa}
                onChange={e => setForm({ ...form, empresa: e.target.value })}
                className="input-field font-semibold text-gray-900 border-primary/40"
              >
                {EMPRESAS.map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Modelo</label>
              <input
                type="text"
                placeholder="Ej. GX-750"
                value={form.modelo}
                onChange={e => setForm({ ...form, modelo: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">N° de Serie</label>
              <input
                type="text"
                placeholder="Ej. SN-2024-889"
                value={form.serie}
                onChange={e => setForm({ ...form, serie: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Precio ($ USD)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.precio}
                onChange={e => {
                  const usd = e.target.value
                  const tc = form.tipoCambio || cotizacionBcb
                  const bs = usd !== '' ? (parseFloat(usd) * tc).toFixed(2) : ''
                  setForm({ ...form, precio: usd, precioBs: bs })
                }}
                className="input-field text-emerald-700 font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Precio (Bs)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.precioBs}
                onChange={e => {
                  const bs = e.target.value
                  const tc = form.tipoCambio || cotizacionBcb
                  const usd = bs !== '' ? (parseFloat(bs) / tc).toFixed(2) : ''
                  setForm({ ...form, precioBs: bs, precio: usd })
                }}
                className="input-field font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Cantidad / Stock *</label>
              <input
                type="number"
                min="1"
                required
                placeholder="1"
                value={form.cantidad}
                onChange={e => setForm({ ...form, cantidad: e.target.value })}
                className="input-field font-bold text-emerald-800 border-emerald-300"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Estado del Equipo</label>
              <select
                value={form.estado}
                onChange={e => setForm({ ...form, estado: e.target.value })}
                className="input-field"
              >
                {ESTADOS.map(est => (
                  <option key={est.id} value={est.id}>{est.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">N° de Póliza Aduanera</label>
              <input
                type="text"
                placeholder="Ej. POL-2026-0045"
                value={form.numPoliza}
                onChange={e => setForm({ ...form, numPoliza: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm({ ...form, fecha: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Adjuntar Póliza (PDF)</label>
            <div className="flex items-center gap-3">
              <label className="btn-secondary btn-sm cursor-pointer inline-flex items-center gap-1.5">
                <Paperclip size={14}/> {archivoPdf ? 'Cambiar archivo PDF' : 'Seleccionar PDF'}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files[0]
                    if (f && f.type === 'application/pdf') {
                      setArchivoPdf(f)
                    } else if (f) {
                      toast.error('Solo se permite adjuntar archivos PDF')
                    }
                  }}
                />
              </label>
              {archivoPdf ? (
                <span className="text-xs text-emerald-700 font-medium truncate max-w-[200px]">
                  📄 {archivoPdf.name}
                </span>
              ) : editando?.polizaUrl ? (
                <span className="text-xs text-gray-500 truncate max-w-[200px]">
                  Póliza actual: <a href={editando.polizaUrl} target="_blank" rel="noreferrer" className="text-primary underline">Ver archivo</a>
                </span>
              ) : (
                <span className="text-xs text-gray-400">Ningún PDF seleccionado</span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones / Detalles</label>
            <textarea
              rows={3}
              placeholder="Detalles técnicos, accesorios o notas de entrega..."
              value={form.observaciones}
              onChange={e => setForm({ ...form, observaciones: e.target.value })}
              className="input-field"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn-primary">
              {guardando ? 'Guardando...' : (editando ? 'Actualizar Equipo' : 'Guardar Equipo')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Confirmar Eliminar */}
      <Modal open={!!delEquipo} onClose={() => setDelEquipo(null)} title="Confirmar Eliminación" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            ¿Estás seguro de que deseas eliminar el equipo <strong>{delEquipo?.nombreEs}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setDelEquipo(null)} className="btn-secondary">Cancelar</button>
            <button onClick={handleEliminar} className="btn-primary bg-red-600 hover:bg-red-700">Eliminar</button>
          </div>
        </div>
      </Modal>

      {/* Modal Ver Foto Zoom Interactivo */}
      <ModalVerFotoZoom
        open={!!verFoto}
        onClose={() => setVerFoto(null)}
        fotoUrl={verFoto?.fotoUrl}
        titulo={verFoto?.titulo || 'Foto del equipo'}
        subtitulo={verFoto?.subtitulo}
      />

      {/* Modal Reporte Excel por Rango de Fechas (sin fotos ni imágenes) */}
      <ModalReporteExcel
        open={modalExcel}
        onClose={() => setModalExcel(false)}
        tituloEs="Reporte Excel — Equipos y Máquinas"
        tituloZh="导出 Excel 报表 — 设备清单"
        subtituloEs="Selecciona el rango de fechas y filtros opcionales para exportar el listado de equipos."
        subtituloZh="选择日期范围和筛选条件以导出设备清单。"
        avisoExtraEs="Las fotografías e imágenes de los equipos y placas NO se incluyen en el archivo Excel; solo se exportan los datos técnicos, cantidades, precios y póliza."
        avisoExtraZh="设备与铭牌照片不包含在 Excel 报表中，仅导出技术参数、数量、价格及报关单数据。"
        filtrosExtra={
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#374540] uppercase tracking-wider mb-1">
                {isZh ? '所属公司' : 'Empresa'}
              </label>
              <select
                className="input bg-white"
                value={empresaExcel}
                onChange={e => setEmpresaExcel(e.target.value)}
              >
                <option value="">{isZh ? '全部公司' : 'Todas las empresas'}</option>
                {EMPRESAS.map(emp => <option key={emp} value={emp}>{emp}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374540] uppercase tracking-wider mb-1">
                {isZh ? '设备状态' : 'Estado'}
              </label>
              <select
                className="input bg-white"
                value={estadoExcel}
                onChange={e => setEstadoExcel(e.target.value)}
              >
                <option value="">{isZh ? '全部状态' : 'Todos los estados'}</option>
                {ESTADOS.map(est => (
                  <option key={est.id} value={est.id}>{isZh ? est.labelZh : est.label}</option>
                ))}
              </select>
            </div>
          </div>
        }
        contarRegistros={({ desde, hasta }) => {
          const lista = filtrarPorRangoFechas(equipos, desde, hasta).filter(eq => {
            const matchEmp = !empresaExcel || (eq.empresa || 'SAJAMA S.R.L.') === empresaExcel
            const matchEst = !estadoExcel  || (eq.estado  || 'A la venta')    === estadoExcel
            return matchEmp && matchEst
          })
          return {
            total: lista.length,
            detalle: isZh
              ? `共 ${lista.length} 条设备记录（不含照片）`
              : `${lista.length} equipo(s) encontrados (solo datos, sin imágenes)`,
          }
        }}
        onExportar={({ desde, hasta }) => {
          exportarEquiposExcel({
            equipos,
            cotizacionBcb,
            desde,
            hasta,
            empresaFiltro: empresaExcel,
            estadoFiltro: estadoExcel,
          })
          toast.success(isZh ? '设备 Excel 报表已成功导出' : 'Reporte Excel de Equipos descargado correctamente')
        }}
      />
    </div>
  )
}
