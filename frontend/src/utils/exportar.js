import * as XLSX from 'xlsx'
import { format } from 'date-fns'

// ── Utilidades de fecha compartidas para reportes por rango ──────────────

/**
 * Normaliza la fecha de un documento Firestore a formato 'YYYY-MM-DD'
 */
export function extraerFechaISO(registro) {
  if (!registro) return ''
  const f = registro.fecha
  if (typeof f === 'string' && /^\d{4}-\d{2}-\d{2}/.test(f.trim())) {
    return f.trim().slice(0, 10)
  }
  if (f?.toDate) {
    return format(f.toDate(), 'yyyy-MM-dd')
  }
  if (f?.seconds) {
    return format(new Date(f.seconds * 1000), 'yyyy-MM-dd')
  }
  if (registro.creadoEn?.toDate) {
    return format(registro.creadoEn.toDate(), 'yyyy-MM-dd')
  }
  if (registro.creadoEn?.seconds) {
    return format(new Date(registro.creadoEn.seconds * 1000), 'yyyy-MM-dd')
  }
  return ''
}

/**
 * Formatea 'YYYY-MM-DD' a 'dd/MM/yyyy' para lectura en Excel
 */
function formatearFechaLegible(fechaIso) {
  if (!fechaIso || !/^\d{4}-\d{2}-\d{2}$/.test(fechaIso)) return fechaIso || '—'
  const [y, m, d] = fechaIso.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Filtra una lista de registros por rango inclusivo [desde, hasta] ('YYYY-MM-DD')
 */
export function filtrarPorRangoFechas(lista = [], desde = '', hasta = '') {
  if (!desde && !hasta) return lista
  return lista.filter(reg => {
    const fechaIso = extraerFechaISO(reg)
    if (!fechaIso) return false
    if (desde && fechaIso < desde) return false
    if (hasta && fechaIso > hasta) return false
    return true
  })
}

function etiquetaArchivoRango(desde, hasta) {
  if (desde && hasta) return `${desde}_al_${hasta}`
  if (desde) return `desde_${desde}`
  if (hasta) return `hasta_${hasta}`
  return `Completo_${format(new Date(), 'yyyy-MM-dd')}`
}

function textoPeriodoLegible(desde, hasta) {
  if (desde && hasta) return `${formatearFechaLegible(desde)} al ${formatearFechaLegible(hasta)}`
  if (desde) return `Desde ${formatearFechaLegible(desde)}`
  if (hasta) return `Hasta ${formatearFechaLegible(hasta)}`
  return 'Todo el historial'
}

const redondear2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// ── Exportadores existentes (se mantienen intactos) ──────────────────────

export const exportarInventarioExcel = (items) => {
  const datos = items.map(i => ({
    'Código':               i.codigo,
    'Descripción (ES)':     i.descripcion,
    'Descripción (中文)':    i.descripcionZh || '',
    'Modelo':               i.modelo    || '',
    'N° Serie':             i.serie     || '',
    'Categoría':            i.categoria || '',
    'Empresa':              i.empresa   || 'SAJAMA S.R.L.',
    'Unidad':               i.unidad    || '',
    'Ubicación':            i.ubicacion || '',
    'Stock actual':         i.stock     ?? 0,
    'Stock mínimo':         i.stockMin  ?? '',
    'Total salidas':        i.totalSalidas ?? 0,
    'Precio (Bs)':          i.precio    ?? '',
    'Notas':                i.notas     || '',
  }))

  const ws = XLSX.utils.json_to_sheet(datos)

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 8 }, { wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
  XLSX.writeFile(wb, `Inventario_SAJAMA_${new Date().toISOString().slice(0,10)}.xlsx`)
}

export const exportarMovimientosExcel = (datos, nombre = 'Movimientos') => {
  const ws = XLSX.utils.json_to_sheet(datos)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, nombre)
  XLSX.writeFile(wb, `${nombre}_SAJAMA_${new Date().toISOString().slice(0,10)}.xlsx`)
}

// ── 1. Reporte Excel: CONSULTAS (Órdenes de Salida y Entrada) ────────────

const FUENTES_LABEL = {
  importacion: 'Importación',
  compra:      'Compra local',
  devolucion:  'Devolución',
}

export function exportarConsultasExcel({
  salidas = [],
  entradas = [],
  tipoReporte = 'ambos', // 'ambos' | 'salidas' | 'entradas'
  desde = '',
  hasta = '',
}) {
  const incluirSalidas  = tipoReporte === 'ambos' || tipoReporte === 'salidas'
  const incluirEntradas = tipoReporte === 'ambos' || tipoReporte === 'entradas'

  const salidasFiltradas  = incluirSalidas  ? filtrarPorRangoFechas(salidas, desde, hasta)  : []
  const entradasFiltradas = incluirEntradas ? filtrarPorRangoFechas(entradas, desde, hasta) : []

  const filasSalida = []
  let totalUnidSalidas = 0
  let totalMontoSalidas = 0

  salidasFiltradas.forEach(o => {
    const fechaTxt = formatearFechaLegible(extraerFechaISO(o))
    const filas = Array.isArray(o.filas) && o.filas.length > 0 ? o.filas : [{}]
    filas.forEach(f => {
      const cant = Number(f.cantidad) || 0
      const pu   = Number(f.precioUnitario) || 0
      const pt   = Number(f.precioTotal ?? (cant * pu)) || 0
      totalUnidSalidas += cant
      totalMontoSalidas += pt
      filasSalida.push({
        'N° Orden':           o.numSolicitud || '',
        'Fecha':              fechaTxt,
        'Unidad Solicitante': o.unidadSolicitante || '',
        'Solicitante':        o.solicitante || '',
        'Descripción (ES)':   f.descEs || '',
        'Descripción (中文)':  f.descZh || '',
        'Modelo':             f.modelo || '',
        'N° Serie':           f.serie || '',
        'Unidad':             f.unidad || '',
        'Cantidad':           cant,
        'P. Unitario (Bs)':   redondear2(pu),
        'P. Total (Bs)':      redondear2(pt),
        'Nota':               f.nota || '',
        'Registrado por':     o.creadoPor || '',
      })
    })
  })

  if (filasSalida.length > 0) {
    filasSalida.push({
      'N° Orden':           'TOTAL',
      'Fecha':              `${salidasFiltradas.length} orden(es)`,
      'Unidad Solicitante': '',
      'Solicitante':        '',
      'Descripción (ES)':   '',
      'Descripción (中文)':  '',
      'Modelo':             '',
      'N° Serie':           '',
      'Unidad':             '',
      'Cantidad':           redondear2(totalUnidSalidas),
      'P. Unitario (Bs)':   '',
      'P. Total (Bs)':      redondear2(totalMontoSalidas),
      'Nota':               '',
      'Registrado por':     '',
    })
  }

  const filasEntrada = []
  let totalUnidEntradas = 0
  let totalMontoEntradas = 0

  entradasFiltradas.forEach(o => {
    const fechaTxt = formatearFechaLegible(extraerFechaISO(o))
    const fuenteTxt = FUENTES_LABEL[o.fuente] || o.fuente || ''
    const filas = Array.isArray(o.filas) && o.filas.length > 0 ? o.filas : [{}]
    filas.forEach(f => {
      const cant = Number(f.cantidad) || 0
      const pu   = Number(f.precioUnitario) || 0
      const pt   = Number(f.precioTotal ?? (cant * pu)) || 0
      totalUnidEntradas += cant
      totalMontoEntradas += pt
      filasEntrada.push({
        'N° Entrada':         o.numSolicitud || '',
        'Fecha':              fechaTxt,
        'Fuente':             fuenteTxt,
        'Proveedor':          o.proveedor || '',
        'Recibido por':       o.recibidoPor || '',
        'Descripción (ES)':   f.descEs || '',
        'Descripción (中文)':  f.descZh || '',
        'Modelo':             f.modelo || '',
        'N° Serie':           f.serie || '',
        'Unidad':             f.unidad || '',
        'Cantidad':           cant,
        'P. Unitario (Bs)':   redondear2(pu),
        'P. Total (Bs)':      redondear2(pt),
        'Nota':               f.nota || '',
        'Registrado por':     o.creadoPor || '',
      })
    })
  })

  if (filasEntrada.length > 0) {
    filasEntrada.push({
      'N° Entrada':         'TOTAL',
      'Fecha':              `${entradasFiltradas.length} orden(es)`,
      'Fuente':             '',
      'Proveedor':          '',
      'Recibido por':       '',
      'Descripción (ES)':   '',
      'Descripción (中文)':  '',
      'Modelo':             '',
      'N° Serie':           '',
      'Unidad':             '',
      'Cantidad':           redondear2(totalUnidEntradas),
      'P. Unitario (Bs)':   '',
      'P. Total (Bs)':      redondear2(totalMontoEntradas),
      'Nota':               '',
      'Registrado por':     '',
    })
  }

  const wb = XLSX.utils.book_new()

  // Hoja 1: Resumen del Periodo
  const resumenRows = [
    { 'Concepto': 'Módulo',                          'Valor': 'Consultas — Órdenes de Almacén (SAJAMA S.R.L.)' },
    { 'Concepto': 'Periodo del Reporte',             'Valor': textoPeriodoLegible(desde, hasta) },
    { 'Concepto': 'Fecha de Generación',             'Valor': format(new Date(), 'dd/MM/yyyy HH:mm') },
    { 'Concepto': '',                                'Valor': '' },
  ]
  if (incluirSalidas) {
    resumenRows.push(
      { 'Concepto': 'Total Órdenes de Salida',       'Valor': salidasFiltradas.length },
      { 'Concepto': 'Total Unidades Despachadas',    'Valor': redondear2(totalUnidSalidas) },
      { 'Concepto': 'Monto Total Salidas (Bs)',      'Valor': redondear2(totalMontoSalidas) },
    )
  }
  if (incluirEntradas) {
    resumenRows.push(
      { 'Concepto': 'Total Órdenes de Entrada',      'Valor': entradasFiltradas.length },
      { 'Concepto': 'Total Unidades Ingresadas',     'Valor': redondear2(totalUnidEntradas) },
      { 'Concepto': 'Monto Total Entradas (Bs)',     'Valor': redondear2(totalMontoEntradas) },
    )
  }

  const wsResumen = XLSX.utils.json_to_sheet(resumenRows)
  wsResumen['!cols'] = [{ wch: 32 }, { wch: 42 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  if (incluirSalidas) {
    const wsSal = XLSX.utils.json_to_sheet(
      filasSalida.length > 0 ? filasSalida : [{ 'Aviso': 'Sin órdenes de salida en el rango seleccionado' }]
    )
    wsSal['!cols'] = [
      { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 20 }, { wch: 28 },
      { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 10 }, { wch: 10 },
      { wch: 15 }, { wch: 15 }, { wch: 22 }, { wch: 18 },
    ]
    XLSX.utils.book_append_sheet(wb, wsSal, 'Ordenes Salida')
  }

  if (incluirEntradas) {
    const wsEnt = XLSX.utils.json_to_sheet(
      filasEntrada.length > 0 ? filasEntrada : [{ 'Aviso': 'Sin órdenes de entrada en el rango seleccionado' }]
    )
    wsEnt['!cols'] = [
      { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 22 }, { wch: 20 },
      { wch: 28 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 10 },
      { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 22 }, { wch: 18 },
    ]
    XLSX.utils.book_append_sheet(wb, wsEnt, 'Ordenes Entrada')
  }

  XLSX.writeFile(wb, `Reporte_Consultas_SAJAMA_${etiquetaArchivoRango(desde, hasta)}.xlsx`)
  return { salidas: salidasFiltradas.length, entradas: entradasFiltradas.length }
}

// ── 2. Reporte Excel: MAQUINARIA (Sin fotos ni enlaces de imágenes) ──────

export function exportarMaquinariaExcel({
  maquinas = [],
  cotizacionBcb = 12.58,
  desde = '',
  hasta = '',
  empresaFiltro = '',
  estadoFiltro = '',
}) {
  const filtradas = filtrarPorRangoFechas(maquinas, desde, hasta).filter(m => {
    const matchEmp = !empresaFiltro || (m.empresa || 'SAJAMA S.R.L.') === empresaFiltro
    const matchEst = !estadoFiltro  || (m.estado  || 'A la venta')    === estadoFiltro
    return matchEmp && matchEst
  })

  let totalUsd = 0
  let totalBs  = 0

  // Exclusión estricta: NO se incluyen fotoMaquinaUrl ni fotoPlacaUrl
  const rows = filtradas.map((m, idx) => {
    const tc = Number(cotizacionBcb || m.tipoCambio || 12.58)
    const usdVal = m.precioUsd ? Number(m.precioUsd) : (m.precio ? Number(m.precio) / tc : 0)
    const bsVal  = usdVal > 0 ? (usdVal * tc) : (m.precio ? Number(m.precio) : 0)
    totalUsd += usdVal
    totalBs  += bsVal

    return {
      'N°':                 idx + 1,
      'Fecha':              formatearFechaLegible(extraerFechaISO(m)),
      'Empresa':            m.empresa || 'SAJAMA S.R.L.',
      'Nombre (ES)':        m.nombreEs || '',
      'Nombre (中文)':       m.nombreZh || '',
      'Modelo':             m.modelo || '',
      'Chasis / Placa':     m.serie || '',
      'Unidad':             m.unidad || '',
      'Estado':             m.estado || 'A la venta',
      'Precio ($ USD)':     redondear2(usdVal),
      'Tipo de Cambio':     redondear2(tc),
      'Precio (Bs)':        redondear2(bsVal),
      'N° Póliza Aduanera': m.numPoliza || (m.polizaUrl ? 'Con póliza adjunta' : 'Sin póliza'),
      'Observaciones':      m.observaciones || '',
    }
  })

  if (rows.length > 0) {
    rows.push({
      'N°':                 'TOTAL',
      'Fecha':              textoPeriodoLegible(desde, hasta),
      'Empresa':            `${rows.length} máquina(s)`,
      'Nombre (ES)':        '',
      'Nombre (中文)':       '',
      'Modelo':             '',
      'Chasis / Placa':     '',
      'Unidad':             '',
      'Estado':             '',
      'Precio ($ USD)':     redondear2(totalUsd),
      'Tipo de Cambio':     '',
      'Precio (Bs)':        redondear2(totalBs),
      'N° Póliza Aduanera': '',
      'Observaciones':      '',
    })
  }

  const ws = XLSX.utils.json_to_sheet(
    rows.length > 0 ? rows : [{ 'Aviso': 'Sin maquinaria registrada en el rango seleccionado' }]
  )
  ws['!cols'] = [
    { wch: 7 }, { wch: 13 }, { wch: 20 }, { wch: 26 }, { wch: 18 },
    { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
    { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 28 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Maquinaria')
  XLSX.writeFile(wb, `Reporte_Maquinaria_SAJAMA_${etiquetaArchivoRango(desde, hasta)}.xlsx`)
  return { total: filtradas.length }
}

// ── 3. Reporte Excel: EQUIPOS / MÁQUINAS (Sin fotos ni imágenes) ─────────

export function exportarEquiposExcel({
  equipos = [],
  cotizacionBcb = 12.58,
  desde = '',
  hasta = '',
  empresaFiltro = '',
  estadoFiltro = '',
}) {
  const filtrados = filtrarPorRangoFechas(equipos, desde, hasta).filter(eq => {
    const matchEmp = !empresaFiltro || (eq.empresa || 'SAJAMA S.R.L.') === empresaFiltro
    const matchEst = !estadoFiltro  || (eq.estado  || 'A la venta')    === estadoFiltro
    return matchEmp && matchEst
  })

  let totalCant = 0
  let totalUsd  = 0
  let totalBs   = 0

  // Exclusión estricta: NO se incluyen fotoEquipoUrl, fotoMaquinaUrl ni fotoPlacaUrl
  const rows = filtrados.map((eq, idx) => {
    const tc = Number(cotizacionBcb || eq.tipoCambio || 12.58)
    const cant = Number(eq.cantidad) || 1
    const usdUnit = eq.precioUsd
      ? Number(eq.precioUsd)
      : (eq.precio ? Number(eq.precio) : (eq.precioBs ? Number(eq.precioBs) / tc : 0))
    const usdTot = usdUnit * cant
    const bsTot  = usdTot > 0 ? (usdTot * tc) : ((Number(eq.precioBs) || 0) * cant)

    totalCant += cant
    totalUsd  += usdTot
    totalBs   += bsTot

    return {
      'N°':                   idx + 1,
      'Fecha':                formatearFechaLegible(extraerFechaISO(eq)),
      'Empresa':              eq.empresa || 'SAJAMA S.R.L.',
      'Equipo / Nombre (ES)': eq.nombreEs || '',
      'Nombre (中文)':         eq.nombreZh || '',
      'Categoría':            eq.categoria || 'Equipos',
      'Modelo':               eq.modelo || '',
      'N° Serie':             eq.serie || '',
      'Cantidad':             cant,
      'Estado':               eq.estado || 'A la venta',
      'Precio Unit. ($ USD)': redondear2(usdUnit),
      'Precio Total ($ USD)': redondear2(usdTot),
      'Precio Total (Bs)':    redondear2(bsTot),
      'N° Póliza Aduanera':   eq.numPoliza || (eq.polizaUrl ? 'Con póliza adjunta' : 'Sin póliza'),
      'Observaciones':        eq.observaciones || '',
    }
  })

  if (rows.length > 0) {
    rows.push({
      'N°':                   'TOTAL',
      'Fecha':                textoPeriodoLegible(desde, hasta),
      'Empresa':              `${rows.length} registro(s)`,
      'Equipo / Nombre (ES)': '',
      'Nombre (中文)':         '',
      'Categoría':            '',
      'Modelo':               '',
      'N° Serie':             '',
      'Cantidad':             totalCant,
      'Estado':               '',
      'Precio Unit. ($ USD)': '',
      'Precio Total ($ USD)': redondear2(totalUsd),
      'Precio Total (Bs)':    redondear2(totalBs),
      'N° Póliza Aduanera':   '',
      'Observaciones':        '',
    })
  }

  const ws = XLSX.utils.json_to_sheet(
    rows.length > 0 ? rows : [{ 'Aviso': 'Sin equipos registrados en el rango seleccionado' }]
  )
  ws['!cols'] = [
    { wch: 7 }, { wch: 13 }, { wch: 20 }, { wch: 26 }, { wch: 18 },
    { wch: 14 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 14 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 28 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Equipos')
  XLSX.writeFile(wb, `Reporte_Equipos_SAJAMA_${etiquetaArchivoRango(desde, hasta)}.xlsx`)
  return { total: filtrados.length }
}

// ── 4. Reporte Excel: ABASTECIMIENTO Y DESPACHO DE COMBUSTIBLES ──────────

const coincideCombustible = (valor, filtro) => {
  if (!filtro) return true
  const v = (valor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const f = filtro.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return v === f
}

export function exportarAbastecimientoExcel({
  entradas = [],
  salidas = [],
  saldos = { gasolina: 0, diesel: 0 },
  tipoReporte = 'ambos',     // 'ambos' | 'entradas' | 'salidas'
  combustibleFiltro = '',    // '' | 'Gasolina' | 'Diésel'
  desde = '',
  hasta = '',
}) {
  const incluirEntradas = tipoReporte === 'ambos' || tipoReporte === 'entradas'
  const incluirSalidas  = tipoReporte === 'ambos' || tipoReporte === 'salidas'

  const entFiltradas = incluirEntradas
    ? filtrarPorRangoFechas(entradas, desde, hasta).filter(e => coincideCombustible(e.combustible, combustibleFiltro))
    : []

  const salFiltradas = incluirSalidas
    ? filtrarPorRangoFechas(salidas, desde, hasta).filter(s => coincideCombustible(s.combustible, combustibleFiltro))
    : []

  // Calcular totales de Entradas
  let entGasL = 0, entDieL = 0, entBs = 0
  const rowsEntradas = entFiltradas.map((e, idx) => {
    const litros = Number(e.cantidad) || 0
    const pu = Number(e.precioUnitario) || 0
    const pt = Number(e.precioTotal) || (litros * pu)
    if (coincideCombustible(e.combustible, 'Gasolina')) entGasL += litros
    else entDieL += litros
    entBs += pt

    return {
      'N°':               idx + 1,
      'Fecha':            formatearFechaLegible(extraerFechaISO(e)),
      'Combustible':      e.combustible || '',
      'Cantidad (L)':     redondear2(litros),
      'P. Unitario (Bs)': redondear2(pu),
      'P. Total (Bs)':    redondear2(pt),
      'Proveedor':        e.proveedor || '',
      'Responsable':      e.responsable || '',
      'Observaciones':    e.observaciones || '',
    }
  })

  if (rowsEntradas.length > 0) {
    rowsEntradas.push({
      'N°':               'TOTAL',
      'Fecha':            `${entFiltradas.length} compra(s)`,
      'Combustible':      `Gasolina: ${redondear2(entGasL)} L | Diésel: ${redondear2(entDieL)} L`,
      'Cantidad (L)':     redondear2(entGasL + entDieL),
      'P. Unitario (Bs)': '',
      'P. Total (Bs)':    redondear2(entBs),
      'Proveedor':        '',
      'Responsable':      '',
      'Observaciones':    '',
    })
  }

  // Calcular totales de Salidas
  let salGasL = 0, salDieL = 0, salBs = 0
  const rowsSalidas = salFiltradas.map((s, idx) => {
    const litros = Number(s.cantidad) || 0
    const pu = Number(s.precioUnitario) || 0
    const pt = Number(s.precioTotal) || (litros * pu)
    if (coincideCombustible(s.combustible, 'Gasolina')) salGasL += litros
    else salDieL += litros
    salBs += pt

    return {
      'N°':                   idx + 1,
      'Fecha':                formatearFechaLegible(extraerFechaISO(s)),
      'Combustible':          s.combustible || '',
      'Cantidad (L)':         redondear2(litros),
      'Placa / Chasis':       s.seriePlaca || '',
      'N° Móvil':             s.nroMovil || '',
      'P. Unitario (Bs)':     redondear2(pu),
      'P. Total (Bs)':        redondear2(pt),
      'Destino':              s.destino || '',
      'Responsable / Chofer': s.responsable || '',
      'Observaciones':        s.observaciones || '',
    }
  })

  if (rowsSalidas.length > 0) {
    rowsSalidas.push({
      'N°':                   'TOTAL',
      'Fecha':                `${salFiltradas.length} despacho(s)`,
      'Combustible':          `Gasolina: ${redondear2(salGasL)} L | Diésel: ${redondear2(salDieL)} L`,
      'Cantidad (L)':         redondear2(salGasL + salDieL),
      'Placa / Chasis':       '',
      'N° Móvil':             '',
      'P. Unitario (Bs)':     '',
      'P. Total (Bs)':        redondear2(salBs),
      'Destino':              '',
      'Responsable / Chofer': '',
      'Observaciones':        '',
    })
  }

  const wb = XLSX.utils.book_new()

  // Hoja 1: Resumen Combustibles
  const resumenRows = [
    { 'Indicador': 'Módulo',                               'Valor': 'Abastecimiento y Despacho de Combustible — SAJAMA S.R.L.' },
    { 'Indicador': 'Periodo del Reporte',                  'Valor': textoPeriodoLegible(desde, hasta) },
    { 'Indicador': 'Filtro Combustible',                   'Valor': combustibleFiltro || 'Todos (Gasolina y Diésel)' },
    { 'Indicador': 'Fecha de Generación',                  'Valor': format(new Date(), 'dd/MM/yyyy HH:mm') },
    { 'Indicador': '',                                     'Valor': '' },
  ]
  if (incluirEntradas) {
    resumenRows.push(
      { 'Indicador': 'Compras — Registros en Periodo',     'Valor': entFiltradas.length },
      { 'Indicador': 'Compras — Gasolina (Litros)',        'Valor': redondear2(entGasL) },
      { 'Indicador': 'Compras — Diésel (Litros)',          'Valor': redondear2(entDieL) },
      { 'Indicador': 'Compras — Total Litros Ingresados',  'Valor': redondear2(entGasL + entDieL) },
      { 'Indicador': 'Compras — Monto Total Invertido (Bs)','Valor': redondear2(entBs) },
      { 'Indicador': '',                                   'Valor': '' },
    )
  }
  if (incluirSalidas) {
    resumenRows.push(
      { 'Indicador': 'Despachos — Registros en Periodo',   'Valor': salFiltradas.length },
      { 'Indicador': 'Despachos — Gasolina (Litros)',      'Valor': redondear2(salGasL) },
      { 'Indicador': 'Despachos — Diésel (Litros)',        'Valor': redondear2(salDieL) },
      { 'Indicador': 'Despachos — Total Litros Salidos',   'Valor': redondear2(salGasL + salDieL) },
      { 'Indicador': 'Despachos — Monto Total (Bs)',       'Valor': redondear2(salBs) },
      { 'Indicador': '',                                   'Valor': '' },
    )
  }
  resumenRows.push(
    { 'Indicador': 'Saldo Actual en Tanque — Gasolina (L)','Valor': redondear2(saldos?.gasolina || 0) },
    { 'Indicador': 'Saldo Actual en Tanque — Diésel (L)',  'Valor': redondear2(saldos?.diesel   || 0) },
  )

  const wsResumen = XLSX.utils.json_to_sheet(resumenRows)
  wsResumen['!cols'] = [{ wch: 38 }, { wch: 44 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Combustibles')

  if (incluirEntradas) {
    const wsEnt = XLSX.utils.json_to_sheet(
      rowsEntradas.length > 0 ? rowsEntradas : [{ 'Aviso': 'Sin entradas de combustible en el rango seleccionado' }]
    )
    wsEnt['!cols'] = [
      { wch: 7 }, { wch: 13 }, { wch: 24 }, { wch: 14 }, { wch: 16 },
      { wch: 16 }, { wch: 22 }, { wch: 20 }, { wch: 28 },
    ]
    XLSX.utils.book_append_sheet(wb, wsEnt, 'Entradas Compras')
  }

  if (incluirSalidas) {
    const wsSal = XLSX.utils.json_to_sheet(
      rowsSalidas.length > 0 ? rowsSalidas : [{ 'Aviso': 'Sin despachos de combustible en el rango seleccionado' }]
    )
    wsSal['!cols'] = [
      { wch: 7 }, { wch: 13 }, { wch: 24 }, { wch: 14 }, { wch: 18 },
      { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 20 }, { wch: 28 },
    ]
    XLSX.utils.book_append_sheet(wb, wsSal, 'Salidas Despachos')
  }

  XLSX.writeFile(wb, `Reporte_Abastecimiento_SAJAMA_${etiquetaArchivoRango(desde, hasta)}.xlsx`)
  return { entradas: entFiltradas.length, salidas: salFiltradas.length }
}
