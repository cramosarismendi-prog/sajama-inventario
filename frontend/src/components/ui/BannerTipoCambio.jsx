import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DollarSign, TrendingUp, TrendingDown, Minus, RefreshCw, Edit3, X, Check, Zap, Building2 } from 'lucide-react'
import { useTipoCambio } from '../../hooks/useTipoCambio'

export function BannerTipoCambio({ showEditButton = true }) {
  const { i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const {
    precioDolar,
    variacionAbsoluta,
    variacionPorcentual,
    tendencia,
    ultimaActualizacion,
    fuente,
    esManual,
    loading,
    actualizarTipoCambioManual,
    forzarSincronizacionEnVivo,
  } = useTipoCambio()

  const [modalAbierto, setModalAbierto] = useState(false)
  const [nuevoValor, setNuevoValor] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [mensajeError, setMensajeError] = useState('')
  const [mensajeExito, setMensajeExito] = useState('')

  const handleAbrirModal = () => {
    setNuevoValor(precioDolar.toString())
    setMensajeError('')
    setMensajeExito('')
    setModalAbierto(true)
  }

  const handleGuardar = async (e) => {
    e.preventDefault()
    setMensajeError('')
    setMensajeExito('')
    setGuardando(true)

    try {
      await actualizarTipoCambioManual(nuevoValor, true)
      setMensajeExito('¡Tipo de cambio fijado manualmente!')
      setTimeout(() => {
        setModalAbierto(false)
      }, 1200)
    } catch (err) {
      setMensajeError(err.message || 'Error al guardar el tipo de cambio.')
    } finally {
      setGuardando(false)
    }
  }

  const handleSincronizarModo = async (modo) => {
    setMensajeError('')
    setMensajeExito('')
    setSincronizando(true)

    try {
      const res = await forzarSincronizacionEnVivo(modo)
      setNuevoValor(res.valor.toString())
      setMensajeExito(`Cotización obtenida: ${res.valor} BOB (${res.fuente})`)
      setTimeout(() => {
        setModalAbierto(false)
      }, 1400)
    } catch (err) {
      setMensajeError(err.message || 'Error al sincronizar con la API especificada.')
    } finally {
      setSincronizando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs animate-pulse">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-400" />
        <span>{isZh ? '加载汇率中...' : 'Cargando cotización...'}</span>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/70 border border-emerald-200/80 rounded-xl shadow-xs text-xs select-none">
        <div className="p-1 bg-emerald-600 text-white rounded-lg shadow-xs flex items-center justify-center">
          <DollarSign className="w-3.5 h-3.5 stroke-[2.5]" />
        </div>

        <div className="flex items-baseline gap-1.5 font-medium text-gray-900">
          <span className="text-[11px] uppercase tracking-wider text-emerald-800 font-semibold">USD/BOB:</span>
          <span className="text-sm font-bold text-emerald-950 font-mono">
            {precioDolar?.toFixed(2)} <span className="text-[10px] font-normal text-gray-600">Bs</span>
          </span>
        </div>

        {/* Indicador de tendencia */}
        <div
          className={`flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded-md ${
            tendencia === 'UP'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/60'
              : tendencia === 'DOWN'
              ? 'bg-rose-100 text-rose-800 border border-rose-300/60'
              : 'bg-gray-100 text-gray-700 border border-gray-200'
          }`}
          title={`${isZh ? '变动' : 'Variación'}: ${variacionAbsoluta > 0 ? '+' : ''}${variacionAbsoluta} Bs (${variacionPorcentual}%)\n${isZh ? '来源' : 'Fuente'}: ${fuente}`}
        >
          {tendencia === 'UP' && <TrendingUp className="w-3 h-3 text-emerald-600" />}
          {tendencia === 'DOWN' && <TrendingDown className="w-3 h-3 text-rose-600" />}
          {tendencia === 'STABLE' && <Minus className="w-3 h-3 text-gray-500" />}
          <span>
            {variacionPorcentual !== 0
              ? `${variacionPorcentual > 0 ? '+' : ''}${variacionPorcentual}%`
              : '0.00%'}
          </span>
        </div>

        {/* Timestamp */}
        {ultimaActualizacion && (
          <span className="hidden md:inline text-[10px] text-emerald-700/80 font-medium">
            ({ultimaActualizacion})
          </span>
        )}

        {esManual ? (
          <span className="px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-800 font-bold uppercase rounded-md border border-amber-200">
            {isZh ? '手动' : 'Manual'}
          </span>
        ) : (
          <span className="hidden lg:inline px-1.5 py-0.5 text-[9px] bg-emerald-100 text-emerald-800 font-bold uppercase rounded-md border border-emerald-200">
            {fuente?.includes('BCB') ? (isZh ? '官方央行' : 'BCB Oficial') : (isZh ? '自动同步' : 'Auto-Sync')}
          </span>
        )}

        {showEditButton && (
          <button
            onClick={handleAbrirModal}
            className="ml-1 p-1 hover:bg-emerald-200/60 rounded-lg text-emerald-700 transition-colors focus:outline-hidden"
            title={isZh ? '调整或同步美元汇率' : 'Ajustar o Sincronizar Cotización del Dólar'}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Modal de edición y sincronización rápida */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{isZh ? '美元汇率' : 'Cotización del Dólar'}</h3>
                  <p className="text-xs text-gray-500">{isZh ? '官方央行 / 市场汇率管理与同步' : 'Gestión y Sincronización Oficial BCB / Mercado'}</p>
                </div>
              </div>
              <button
                onClick={() => setModalAbierto(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Fuente actual */}
            <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200/80 text-xs text-gray-600 space-y-1">
              <div className="flex items-center justify-between font-medium text-gray-800">
                <span>{isZh ? '当前来源:' : 'Fuente Activa:'}</span>
                <span className="font-bold text-emerald-700">{fuente}</span>
              </div>
              {ultimaActualizacion && (
                <div className="text-[11px] text-gray-500">
                  {isZh ? '最后更新:' : 'Última actualización:'} <span className="font-semibold">{ultimaActualizacion}</span>
                </div>
              )}
            </div>

            {/* Opciones de auto-sincronización */}
            <div className="space-y-2 pt-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {isZh ? '与官方来源或市场同步:' : 'Sincronizar con Fuente Oficial o Mercado:'}
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSincronizarModo('oficial')}
                  disabled={sincronizando || guardando}
                  className="py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Building2 className="w-3.5 h-3.5 text-emerald-200" />
                  <span>{isZh ? '官方央行 (9.83)' : 'Oficial BCB (9.83)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSincronizarModo('binance')}
                  disabled={sincronizando || guardando}
                  className="py-2 px-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  <span>Binance P2P</span>
                </button>
              </div>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-2 text-[10px] text-gray-400 font-semibold uppercase">
                {isZh ? '或输入自定义手动值' : 'O ingresar valor manual'}
              </span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <form onSubmit={handleGuardar} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isZh ? '自定义汇率 (1 USD 兑 Bs.)' : 'Precio Personalizado (1 USD en Bs.)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max="100"
                    value={nuevoValor}
                    onChange={(e) => setNuevoValor(e.target.value)}
                    required
                    className="w-full pl-3 pr-12 py-2.5 border border-gray-300 rounded-xl text-lg font-bold text-gray-900 font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
                    placeholder="9.83"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                    BOB
                  </span>
                </div>
              </div>

              {mensajeError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  {mensajeError}
                </div>
              )}

              {mensajeExito && (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium">
                  <Check className="w-4 h-4 text-emerald-600" />
                  {mensajeExito}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  disabled={guardando || sincronizando}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  {isZh ? '取消' : 'Cancelar'}
                </button>
                <button
                  type="submit"
                  disabled={guardando || sincronizando}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {guardando ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{isZh ? '保存中...' : 'Guardando...'}</span>
                    </>
                  ) : (
                    <span>{isZh ? '设定手动汇率' : 'Fijar Valor Manual'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
