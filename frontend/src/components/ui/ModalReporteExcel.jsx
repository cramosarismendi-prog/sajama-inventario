import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { FileSpreadsheet, Calendar, Download, AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { Modal } from './Modal'

/**
 * Modal reutilizable para exportar reportes Excel (.xlsx) por rango de fechas
 * Se integra con la estética SAJAMA 4X4 (#16241F / #E4D825) y soporta ES / 中文.
 */
export function ModalReporteExcel({
  open,
  onClose,
  tituloEs,
  tituloZh,
  subtituloEs,
  subtituloZh,
  contarRegistros, // ({ desde, hasta }) => number | { total: number, detalle?: string }
  onExportar,      // ({ desde, hasta }) => void
  filtrosExtra = null,
  avisoExtraEs = '',
  avisoExtraZh = '',
}) {
  const { i18n } = useTranslation()
  const isZh = i18n.language === 'zh'

  const hoy = format(new Date(), 'yyyy-MM-dd')
  const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd')

  const [desde, setDesde] = useState(inicioMes)
  const [hasta, setHasta] = useState(hoy)
  const [presetActivo, setPresetActivo] = useState('mes')

  useEffect(() => {
    if (open) {
      const now = new Date()
      setDesde(format(startOfMonth(now), 'yyyy-MM-dd'))
      setHasta(format(now, 'yyyy-MM-dd'))
      setPresetActivo('mes')
    }
  }, [open])

  const aplicarPreset = (key) => {
    const now = new Date()
    setPresetActivo(key)
    if (key === 'hoy') {
      const d = format(now, 'yyyy-MM-dd')
      setDesde(d); setHasta(d)
    } else if (key === '7dias') {
      setDesde(format(subDays(now, 6), 'yyyy-MM-dd'))
      setHasta(format(now, 'yyyy-MM-dd'))
    } else if (key === 'mes') {
      setDesde(format(startOfMonth(now), 'yyyy-MM-dd'))
      setHasta(format(now, 'yyyy-MM-dd'))
    } else if (key === 'mesAnterior') {
      const prev = subMonths(now, 1)
      setDesde(format(startOfMonth(prev), 'yyyy-MM-dd'))
      setHasta(format(endOfMonth(prev), 'yyyy-MM-dd'))
    } else if (key === 'todo') {
      setDesde(''); setHasta('')
    }
  }

  const rangoInvalido = Boolean(desde && hasta && desde > hasta)

  const resultadoConteo = (!rangoInvalido && typeof contarRegistros === 'function')
    ? contarRegistros({ desde, hasta })
    : { total: 0, detalle: '' }

  const totalRegistros = typeof resultadoConteo === 'number'
    ? resultadoConteo
    : (resultadoConteo?.total ?? 0)
  const detalleConteo = typeof resultadoConteo === 'object' ? (resultadoConteo?.detalle || '') : ''

  const handleDescargar = () => {
    if (rangoInvalido || totalRegistros === 0) return
    onExportar?.({ desde, hasta })
    onClose?.()
  }

  const presets = [
    { key: 'hoy',         es: 'Hoy',            zh: '今天' },
    { key: '7dias',       es: 'Últimos 7 días', zh: '近7天' },
    { key: 'mes',         es: 'Este mes',       zh: '本月' },
    { key: 'mesAnterior', es: 'Mes anterior',   zh: '上月' },
    { key: 'todo',        es: 'Todo',           zh: '全部记录' },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isZh ? (tituloZh || '导出 Excel 报表') : (tituloEs || 'Generar Reporte Excel')}
      size="md"
    >
      <div className="space-y-4">
        {(subtituloEs || subtituloZh) && (
          <p className="text-xs text-gray-500">
            {isZh ? (subtituloZh || subtituloEs) : subtituloEs}
          </p>
        )}

        {/* Atajos rápidos de rango */}
        <div>
          <label className="block text-xs font-semibold text-[#374540] uppercase tracking-wider mb-1.5">
            {isZh ? '快捷时间段' : 'Accesos rápidos de periodo'}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => aplicarPreset(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  presetActivo === p.key
                    ? 'bg-[#16241F] text-[#E4D825] border-[#16241F]'
                    : 'bg-white text-[#233830] border-[#CBD4CF] hover:bg-[#EEF2F0]'
                }`}
              >
                {isZh ? p.zh : p.es}
              </button>
            ))}
          </div>
        </div>

        {/* Inputs Fecha Desde / Fecha Hasta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#F4F6F5] p-3.5 rounded-xl border border-[#E2E7E4]">
          <div>
            <label className="label text-xs flex items-center gap-1.5 text-[#16241F]">
              <Calendar size={13} /> {isZh ? '开始日期 (Desde)' : 'Fecha Desde'}
            </label>
            <input
              type="date"
              className="input bg-white"
              value={desde}
              onChange={e => { setDesde(e.target.value); setPresetActivo('custom') }}
            />
          </div>
          <div>
            <label className="label text-xs flex items-center gap-1.5 text-[#16241F]">
              <Calendar size={13} /> {isZh ? '结束日期 (Hasta)' : 'Fecha Hasta'}
            </label>
            <input
              type="date"
              className="input bg-white"
              value={hasta}
              onChange={e => { setHasta(e.target.value); setPresetActivo('custom') }}
            />
          </div>
        </div>

        {/* Filtros contextuales opcionales por módulo */}
        {filtrosExtra && (
          <div className="space-y-3 pt-1">
            {filtrosExtra}
          </div>
        )}

        {/* Aviso informativo opcional (ej. exclusión de fotos) */}
        {(avisoExtraEs || avisoExtraZh) && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-[#EEF2F0] border border-[#CBD4CF] text-xs text-[#16241F]">
            <Info size={15} className="shrink-0 mt-0.5 text-[#233830]" />
            <span>{isZh ? (avisoExtraZh || avisoExtraEs) : avisoExtraEs}</span>
          </div>
        )}

        {/* Previsualización / Estado de validación */}
        {rangoInvalido ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
            <AlertCircle size={16} className="shrink-0" />
            <span>
              {isZh
                ? '日期范围无效：“开始日期”不能晚于“结束日期”。'
                : 'Rango de fechas inválido: "Fecha Desde" no puede ser mayor que "Fecha Hasta".'}
            </span>
          </div>
        ) : totalRegistros === 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
            <AlertCircle size={16} className="shrink-0" />
            <span>
              {isZh
                ? '所选时间段和筛选条件下未找到可导出的记录。'
                : 'No se encontraron registros dentro del rango de fechas y filtros seleccionados.'}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-700" />
              <div>
                <p className="font-bold">
                  {isZh
                    ? `找到 ${totalRegistros} 条可导出记录`
                    : `${totalRegistros} registro(s) listos para exportar`}
                </p>
                {detalleConteo && <p className="text-[11px] text-emerald-800/80 mt-0.5">{detalleConteo}</p>}
              </div>
            </div>
            <FileSpreadsheet size={20} className="text-emerald-700 shrink-0" />
          </div>
        )}

        {/* Acciones */}
        <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E7E4]">
          <button type="button" onClick={onClose} className="btn-secondary">
            {isZh ? '取消' : 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={handleDescargar}
            disabled={rangoInvalido || totalRegistros === 0}
            className="btn-primary flex items-center gap-2"
          >
            <Download size={15} className="text-[#E4D825]" />
            {isZh ? '下载 Excel (.xlsx)' : 'Descargar Excel (.xlsx)'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
