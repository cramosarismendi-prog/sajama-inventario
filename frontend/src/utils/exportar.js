import XLSX from 'xlsx-js-style'
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

// ── Motor de Estilos Corporativos y Construcción de Bloques Agrupados ────

const BORDER_THIN = {
  top:    { style: 'thin', color: { rgb: '595959' } },
  bottom: { style: 'thin', color: { rgb: '595959' } },
  left:   { style: 'thin', color: { rgb: '595959' } },
  right:  { style: 'thin', color: { rgb: '595959' } },
}

const BORDER_GROUP_TOP = {
  top:    { style: 'medium', color: { rgb: '16241F' } },
  bottom: { style: 'thin',   color: { rgb: '595959' } },
  left:   { style: 'thin',   color: { rgb: '595959' } },
  right:  { style: 'thin',   color: { rgb: '595959' } },
}

const BORDER_GROUP_BOTTOM = {
  top:    { style: 'thin',   color: { rgb: '595959' } },
  bottom: { style: 'medium', color: { rgb: '16241F' } },
  left:   { style: 'thin',   color: { rgb: '595959' } },
  right:  { style: 'thin',   color: { rgb: '595959' } },
}

const STYLES = {
  // Título superior de la hoja (SAJAMA verde carbón)
  banner: {
    font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '16241F' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: BORDER_THIN,
  },
  // Barra de metadatos del grupo / orden (Solicitante, N°, Fecha)
  groupMeta: (align = 'left') => ({
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '111827' } },
    fill: { fgColor: { rgb: 'EEF2F0' } },
    alignment: { horizontal: align, vertical: 'center', wrapText: true },
    border: BORDER_GROUP_TOP,
  }),
  // Cabecera verde lima bilingüe (idéntica al formato de referencia)
  colHeader: {
    font: { name: 'Calibri', sz: 9.5, bold: true, color: { rgb: '111827' } },
    fill: { fgColor: { rgb: '92D050' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: BORDER_THIN,
  },
  // Celda de datos estándar
  cellText: (align = 'left', bold = false) => ({
    font: { name: 'Calibri', sz: 9.5, bold, color: { rgb: '111827' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: align, vertical: 'center', wrapText: true },
    border: BORDER_THIN,
  }),
  cellNum: (numFmt = '#,##0.00', bold = false, align = 'right') => ({
    font: { name: 'Calibri', sz: 9.5, bold, color: { rgb: '111827' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: align, vertical: 'center' },
    border: BORDER_THIN,
    numFmt,
  }),
  // Fila de Subtotal de cada orden / grupo
  subtotalText: (align = 'center') => ({
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '111827' } },
    fill: { fgColor: { rgb: 'E5E7EB' } },
    alignment: { horizontal: align, vertical: 'center', wrapText: true },
    border: BORDER_GROUP_BOTTOM,
  }),
  subtotalNum: (numFmt = '#,##0.00', align = 'right') => ({
    font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: '111827' } },
    fill: { fgColor: { rgb: 'E5E7EB' } },
    alignment: { horizontal: align, vertical: 'center' },
    border: BORDER_GROUP_BOTTOM,
    numFmt,
  }),
  // Fila de Total General del Periodo
  grandTotalText: (align = 'right') => ({
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '16241F' } },
    alignment: { horizontal: align, vertical: 'center', wrapText: true },
    border: BORDER_GROUP_BOTTOM,
  }),
  grandTotalNum: (numFmt = '#,##0.00', align = 'right') => ({
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'E4D825' } },
    fill: { fgColor: { rgb: '16241F' } },
    alignment: { horizontal: align, vertical: 'center' },
    border: BORDER_GROUP_BOTTOM,
    numFmt,
  }),
  // Resumen ejecutivo
  resumenLabel: {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '16241F' } },
    fill: { fgColor: { rgb: 'EEF2F0' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: BORDER_THIN,
  },
  resumenVal: (numFmt = null) => ({
    font: { name: 'Calibri', sz: 10, bold: false, color: { rgb: '111827' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: numFmt ? 'right' : 'left', vertical: 'center', wrapText: true },
    border: BORDER_THIN,
    ...(numFmt ? { numFmt } : {}),
  }),
}

/**
 * Constructor ergonómico de hojas estilizadas con celdas combinadas, bordes íntegros y fórmulas Excel
 */
function crearHojaEstilizada(totalCols, colWidths) {
  const ws = {}
  const merges = []
  const rowsMeta = []
  let rowIdx = 0 // 0-indexed

  const colLetter = (c) => XLSX.utils.encode_col(c)
  const cellRef = (r, c) => XLSX.utils.encode_cell({ r, c })

  const setCell = (r, c, value, style, extra = {}) => {
    const ref = cellRef(r, c)
    if (extra.f) {
      ws[ref] = { t: 'n', f: extra.f, v: Number(value) || 0, s: style }
    } else if (typeof value === 'number' && !Number.isNaN(value)) {
      ws[ref] = { t: 'n', v: value, s: style }
    } else {
      ws[ref] = { t: 's', v: value == null ? '' : String(value), s: style }
    }
  }

  /**
   * Añade una fila con segmentos opcionalmente combinados.
   * Cada segmento: { c1, c2, v, s, f? } (0-indexed cols inclusivos)
   */
  const addMergedRow = (segmentos, heightPt = 22) => {
    const r = rowIdx++
    rowsMeta[r] = { hpt: heightPt }
    segmentos.forEach(seg => {
      const start = seg.c1
      const end = seg.c2 ?? seg.c1
      setCell(r, start, seg.v, seg.s, seg.f ? { f: seg.f } : {})
      for (let c = start + 1; c <= end; c++) {
        // Poblar celdas cubiertas con el mismo estilo para bordes íntegros en Excel
        ws[cellRef(r, c)] = { t: 's', v: '', s: seg.s }
      }
      if (end > start) {
        merges.push({ s: { r, c: start }, e: { r, c: end } })
      }
    })
    return r
  }

  /**
   * Añade una fila simple celda por celda: array de { v, s, f? }
   */
  const addCellsRow = (celdas, heightPt = 20) => {
    const r = rowIdx++
    rowsMeta[r] = { hpt: heightPt }
    celdas.forEach((cell, c) => {
      setCell(r, c, cell.v, cell.s, cell.f ? { f: cell.f } : {})
    })
    return r
  }

  const addBlankRow = (heightPt = 10) => {
    const r = rowIdx++
    rowsMeta[r] = { hpt: heightPt }
    return r
  }

  const addBanner = (texto) => {
    return addMergedRow([{ c1: 0, c2: totalCols - 1, v: texto, s: STYLES.banner }], 28)
  }

  const addColumnHeaders = (titulos, heightPt = 32) => {
    return addCellsRow(
      titulos.map(t => ({ v: t, s: STYLES.colHeader })),
      heightPt
    )
  }

  const build = () => {
    const lastRow = Math.max(0, rowIdx - 1)
    ws['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: lastRow, c: totalCols - 1 },
    })
    ws['!merges'] = merges
    ws['!cols'] = colWidths.map(w => ({ wch: w }))
    ws['!rows'] = rowsMeta
    return ws
  }

  return {
    addBanner,
    addMergedRow,
    addCellsRow,
    addBlankRow,
    addColumnHeaders,
    colLetter,
    build,
    getRowCount: () => rowIdx,
  }
}

/**
 * Construye fórmula Excel sumando una lista de celdas (ej: ["H7","H15","H20"] -> "H7+H15+H20")
 */
function formulaSumaCeldas(refs) {
  if (!refs || refs.length === 0) return null
  if (refs.length === 1) return refs[0]
  return refs.join('+')
}

// ── Exportadores existentes (se mantienen intactos + cabecera estilizada) ─

export const exportarInventarioExcel = (items) => {
  const cols = [8, 30, 20, 14, 16, 14, 18, 10, 14, 12, 12, 12, 13, 22]
  const h = crearHojaEstilizada(14, cols)
  h.addBanner(`SAJAMA S.R.L. — CATÁLOGO DE INVENTARIO (${format(new Date(), 'dd/MM/yyyy')})`)
  h.addColumnHeaders([
    'Código\n编号', 'Descripción (ES)\n西语名称', 'Descripción (中文)\n中文名称',
    'Modelo\n型号', 'N° Serie\n序列号', 'Categoría\n类别', 'Empresa\n所属公司',
    'Unidad\n单位', 'Ubicación\n存放位置', 'Stock actual\n当前库存', 'Stock mín.\n最低库存',
    'Total salidas\n累计出库', 'Precio (Bs)\n单价', 'Notas\n备注',
  ])
  items.forEach(i => {
    h.addCellsRow([
      { v: i.codigo ?? '', s: STYLES.cellText('center', true) },
      { v: i.descripcion || '', s: STYLES.cellText('left') },
      { v: i.descripcionZh || '', s: STYLES.cellText('left') },
      { v: i.modelo || '', s: STYLES.cellText('center') },
      { v: i.serie || '', s: STYLES.cellText('center') },
      { v: i.categoria || '', s: STYLES.cellText('center') },
      { v: i.empresa || 'SAJAMA S.R.L.', s: STYLES.cellText('center') },
      { v: i.unidad || '', s: STYLES.cellText('center') },
      { v: i.ubicacion || '', s: STYLES.cellText('center') },
      { v: Number(i.stock) || 0, s: STYLES.cellNum('#,##0', true, 'center') },
      { v: i.stockMin != null && i.stockMin !== '' ? Number(i.stockMin) : '', s: STYLES.cellText('center') },
      { v: Number(i.totalSalidas) || 0, s: STYLES.cellNum('#,##0', false, 'center') },
      { v: i.precio ? redondear2(i.precio) : '', s: i.precio ? STYLES.cellNum('#,##0.00') : STYLES.cellText('center') },
      { v: i.notas || '', s: STYLES.cellText('left') },
    ], 20)
  })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, h.build(), 'Inventario')
  XLSX.writeFile(wb, `Inventario_SAJAMA_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
}

export const exportarMovimientosExcel = (datos, nombre = 'Movimientos') => {
  const ws = XLSX.utils.json_to_sheet(datos)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, nombre)
  XLSX.writeFile(wb, `${nombre}_SAJAMA_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
}

// ── Helper para construir la hoja de Resumen estilizada ──────────────────

function construirHojaResumen(titulo, filasResumen) {
  const h = crearHojaEstilizada(2, [40, 44])
  h.addBanner(titulo)
  h.addColumnHeaders(['Concepto / 项目', 'Valor / 数值'], 24)
  filasResumen.forEach(item => {
    if (item.separador) {
      h.addBlankRow(8)
    } else {
      h.addCellsRow([
        { v: item.label, s: STYLES.resumenLabel },
        { v: item.val, s: STYLES.resumenVal(item.numFmt || null) },
      ], 21)
    }
  })
  return h.build()
}

// ── 1. Reporte Excel: CONSULTAS (Agrupado por cada Orden con Subtotales) ─

const FUENTES_LABEL = {
  importacion: 'Importación / 进口',
  compra:      'Compra local / 本地采购',
  devolucion:  'Devolución / 退货',
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

  const ordenarAsc = (arr) => [...arr].sort((a, b) => extraerFechaISO(a).localeCompare(extraerFechaISO(b)))
  const salidasFiltradas  = incluirSalidas  ? ordenarAsc(filtrarPorRangoFechas(salidas, desde, hasta))  : []
  const entradasFiltradas = incluirEntradas ? ordenarAsc(filtrarPorRangoFechas(entradas, desde, hasta)) : []

  const periodoTxt = textoPeriodoLegible(desde, hasta)
  const wb = XLSX.utils.book_new()

  let totalUnidSalidas = 0
  let totalMontoSalidas = 0
  let wsSalidas = null

  // ── Hoja Órdenes de Salida (formato agrupado idéntico a la imagen de referencia) ──
  if (incluirSalidas) {
    // 9 columnas: A:Ítem, B:Desc ES, C:Desc ZH, D:Modelo/Serie, E:Unidad, F:Cantidad, G:Precio U, H:Precio T, I:Obs
    const hSal = crearHojaEstilizada(9, [7, 30, 22, 20, 10, 11, 14, 16, 24])
    hSal.addBanner(`SAJAMA S.R.L. — REPORTE DE ÓRDENES DE SALIDA / 出库单报表  (${periodoTxt})`)

    if (salidasFiltradas.length === 0) {
      hSal.addMergedRow([{ c1: 0, c2: 8, v: 'Sin órdenes de salida registradas en el rango seleccionado.', s: STYLES.cellText('center') }], 26)
    } else {
      const subtotalMontoRefs = []

      salidasFiltradas.forEach(o => {
        const fechaFmt = formatearFechaLegible(extraerFechaISO(o))
        const firmaTxt = o.firmas?.firmaSolicitante ? ` ${o.firmas.firmaSolicitante}` : ''

        // Fila Meta del bloque de la orden
        hSal.addMergedRow([
          { c1: 0, c2: 2, v: `Solicitante: ${o.solicitante || '—'}   (${o.numSolicitud || 'S/N'})`, s: STYLES.groupMeta('left') },
          { c1: 3, c2: 5, v: `Firma 签字:${firmaTxt}`, s: STYLES.groupMeta('center') },
          { c1: 6, c2: 8, v: `Fecha de Solicitud 申请日期: ${fechaFmt}`, s: STYLES.groupMeta('right') },
        ], 22)

        // Cabecera verde bilingüe de la orden
        hSal.addColumnHeaders([
          'Ítem',
          'Descripción del material\n材料描述',
          'Nombre en Chino\n中文名称',
          'Modelo / Serie\n型号 / 序列号',
          'Unidad\n单位',
          'Cantidad\n数量',
          'Precio U\n价格(Bs)',
          'Precio T\n价格(Bs)',
          'Observaciones\n备注',
        ], 32)

        const filas = Array.isArray(o.filas) && o.filas.length > 0 ? o.filas : [{}]
        const firstDataExcelRow = hSal.getRowCount() + 1 // 1-indexed para Excel
        let cantOrden = 0
        let montoOrden = 0

        filas.forEach((f, idx) => {
          const cant = Number(f.cantidad) || 0
          const pu   = Number(f.precioUnitario) || 0
          const pt   = f.precioTotal != null && f.precioTotal !== '' ? Number(f.precioTotal) : (cant * pu)
          const excelRow = hSal.getRowCount() + 1
          const modeloSerie = [f.modelo, f.serie].filter(Boolean).join(' / ')
          const usarFormula = pu > 0 && Math.abs(pt - (cant * pu)) < 0.05

          cantOrden += cant
          montoOrden += pt

          const altoFila = (f.descEs || '').length > 36 || (f.nota || '').length > 30 ? 28 : 20
          hSal.addCellsRow([
            { v: idx + 1, s: STYLES.cellNum('#,##0', false, 'center') },
            { v: f.descEs || '', s: STYLES.cellText('left') },
            { v: f.descZh || '', s: STYLES.cellText('left') },
            { v: modeloSerie, s: STYLES.cellText('center') },
            { v: f.unidad || '', s: STYLES.cellText('center') },
            { v: cant, s: STYLES.cellNum('#,##0.##', false, 'center') },
            { v: redondear2(pu), s: STYLES.cellNum('#,##0.00') },
            usarFormula
              ? { v: redondear2(pt), f: `F${excelRow}*G${excelRow}`, s: STYLES.cellNum('#,##0.00') }
              : { v: redondear2(pt), s: STYLES.cellNum('#,##0.00') },
            { v: f.nota || '', s: STYLES.cellText('left') },
          ], altoFila)
        })

        const lastDataExcelRow = hSal.getRowCount() // 1-indexed
        const subExcelRow = hSal.getRowCount() + 1

        // Fila Subtotal de esta Orden de Salida (idéntica al bloque inferior del Excel de referencia)
        const obsSubtotalSal = [
          `Cant: ${redondear2(cantOrden)}`,
          o.creadoPor ? `Reg: ${o.creadoPor}` : '',
        ].filter(Boolean).join(' | ')

        hSal.addMergedRow([
          { c1: 0, c2: 2, v: o.unidadSolicitante || '', s: STYLES.subtotalText('center') },
          { c1: 3, c2: 5, v: 'Monto Total\n合计金额 (Bs):', s: STYLES.subtotalText('center') },
          { c1: 6, c2: 7, v: redondear2(montoOrden), f: `SUM(H${firstDataExcelRow}:H${lastDataExcelRow})`, s: STYLES.subtotalNum('#,##0.00', 'center') },
          { c1: 8, c2: 8, v: obsSubtotalSal, s: STYLES.subtotalText('left') },
        ], 28)

        subtotalMontoRefs.push(`G${subExcelRow}`)
        totalUnidSalidas += cantOrden
        totalMontoSalidas += montoOrden
      })

      hSal.addBlankRow(10)
      // Total General del Periodo sumando los subtotales de cada orden
      hSal.addMergedRow([
        { c1: 0, c2: 5, v: `TOTAL GENERAL SALIDAS / 出库总计  (${salidasFiltradas.length} orden/es · ${redondear2(totalUnidSalidas)} unid.)`, s: STYLES.grandTotalText('right') },
        { c1: 6, c2: 7, v: redondear2(totalMontoSalidas), f: formulaSumaCeldas(subtotalMontoRefs), s: STYLES.grandTotalNum('#,##0.00', 'center') },
        { c1: 8, c2: 8, v: 'Bs', s: STYLES.grandTotalText('center') },
      ], 28)
    }

    wsSalidas = hSal.build()
  }

  let totalUnidEntradas = 0
  let totalMontoEntradas = 0
  let wsEntradas = null

  // ── Hoja Órdenes de Entrada (mismo formato agrupado por cada orden) ──
  if (incluirEntradas) {
    const hEnt = crearHojaEstilizada(9, [7, 30, 22, 20, 10, 11, 14, 16, 24])
    hEnt.addBanner(`SAJAMA S.R.L. — REPORTE DE ÓRDENES DE ENTRADA / 入库单报表  (${periodoTxt})`)

    if (entradasFiltradas.length === 0) {
      hEnt.addMergedRow([{ c1: 0, c2: 8, v: 'Sin órdenes de entrada registradas en el rango seleccionado.', s: STYLES.cellText('center') }], 26)
    } else {
      const subtotalMontoRefs = []

      entradasFiltradas.forEach(o => {
        const fechaFmt = formatearFechaLegible(extraerFechaISO(o))
        const fuenteTxt = FUENTES_LABEL[o.fuente] || o.fuente || '—'

        hEnt.addMergedRow([
          { c1: 0, c2: 2, v: `Proveedor: ${o.proveedor || '—'}   (${o.numSolicitud || 'S/N'})`, s: STYLES.groupMeta('left') },
          { c1: 3, c2: 5, v: `Recibido 接收人: ${o.recibidoPor || '—'}`, s: STYLES.groupMeta('center') },
          { c1: 6, c2: 8, v: `Fecha 入库日期: ${fechaFmt}`, s: STYLES.groupMeta('right') },
        ], 22)

        hEnt.addColumnHeaders([
          'Ítem',
          'Descripción del material\n材料描述',
          'Nombre en Chino\n中文名称',
          'Modelo / Serie\n型号 / 序列号',
          'Unidad\n单位',
          'Cantidad\n数量',
          'Precio U\n价格(Bs)',
          'Precio T\n价格(Bs)',
          'Observaciones\n备注',
        ], 32)

        const filas = Array.isArray(o.filas) && o.filas.length > 0 ? o.filas : [{}]
        const firstDataExcelRow = hEnt.getRowCount() + 1
        let cantOrden = 0
        let montoOrden = 0

        filas.forEach((f, idx) => {
          const cant = Number(f.cantidad) || 0
          const pu   = Number(f.precioUnitario) || 0
          const pt   = f.precioTotal != null && f.precioTotal !== '' ? Number(f.precioTotal) : (cant * pu)
          const excelRow = hEnt.getRowCount() + 1
          const modeloSerie = [f.modelo, f.serie].filter(Boolean).join(' / ')
          const usarFormula = pu > 0 && Math.abs(pt - (cant * pu)) < 0.05

          cantOrden += cant
          montoOrden += pt

          const altoFila = (f.descEs || '').length > 36 || (f.nota || '').length > 30 ? 28 : 20
          hEnt.addCellsRow([
            { v: idx + 1, s: STYLES.cellNum('#,##0', false, 'center') },
            { v: f.descEs || '', s: STYLES.cellText('left') },
            { v: f.descZh || '', s: STYLES.cellText('left') },
            { v: modeloSerie, s: STYLES.cellText('center') },
            { v: f.unidad || '', s: STYLES.cellText('center') },
            { v: cant, s: STYLES.cellNum('#,##0.##', false, 'center') },
            { v: redondear2(pu), s: STYLES.cellNum('#,##0.00') },
            usarFormula
              ? { v: redondear2(pt), f: `F${excelRow}*G${excelRow}`, s: STYLES.cellNum('#,##0.00') }
              : { v: redondear2(pt), s: STYLES.cellNum('#,##0.00') },
            { v: f.nota || '', s: STYLES.cellText('left') },
          ], altoFila)
        })

        const lastDataExcelRow = hEnt.getRowCount()
        const subExcelRow = hEnt.getRowCount() + 1

        const obsSubtotalEnt = [
          `Cant: ${redondear2(cantOrden)}`,
          o.creadoPor ? `Reg: ${o.creadoPor}` : '',
        ].filter(Boolean).join(' | ')

        hEnt.addMergedRow([
          { c1: 0, c2: 2, v: fuenteTxt, s: STYLES.subtotalText('center') },
          { c1: 3, c2: 5, v: 'Monto Total\n合计金额 (Bs):', s: STYLES.subtotalText('center') },
          { c1: 6, c2: 7, v: redondear2(montoOrden), f: `SUM(H${firstDataExcelRow}:H${lastDataExcelRow})`, s: STYLES.subtotalNum('#,##0.00', 'center') },
          { c1: 8, c2: 8, v: obsSubtotalEnt, s: STYLES.subtotalText('left') },
        ], 28)

        subtotalMontoRefs.push(`G${subExcelRow}`)
        totalUnidEntradas += cantOrden
        totalMontoEntradas += montoOrden
      })

      hEnt.addBlankRow(10)
      hEnt.addMergedRow([
        { c1: 0, c2: 5, v: `TOTAL GENERAL ENTRADAS / 入库总计  (${entradasFiltradas.length} orden/es · ${redondear2(totalUnidEntradas)} unid.)`, s: STYLES.grandTotalText('right') },
        { c1: 6, c2: 7, v: redondear2(totalMontoEntradas), f: formulaSumaCeldas(subtotalMontoRefs), s: STYLES.grandTotalNum('#,##0.00', 'center') },
        { c1: 8, c2: 8, v: 'Bs', s: STYLES.grandTotalText('center') },
      ], 28)
    }

    wsEntradas = hEnt.build()
  }

  // Hoja Resumen Ejecutivo
  const filasResumen = [
    { label: 'Módulo / 模块',                 val: 'Consultas — Órdenes de Almacén (SAJAMA S.R.L.)' },
    { label: 'Periodo del Reporte / 期间',    val: periodoTxt },
    { label: 'Fecha de Generación / 生成日期', val: format(new Date(), 'dd/MM/yyyy HH:mm') },
    { separador: true },
  ]
  if (incluirSalidas) {
    filasResumen.push(
      { label: 'Total Órdenes de Salida / 出库单总数',    val: salidasFiltradas.length, numFmt: '#,##0' },
      { label: 'Total Unidades Despachadas / 出库总件数', val: redondear2(totalUnidSalidas), numFmt: '#,##0.##' },
      { label: 'Monto Total Salidas (Bs) / 出库总金额',   val: redondear2(totalMontoSalidas), numFmt: '#,##0.00' },
    )
  }
  if (incluirEntradas) {
    if (incluirSalidas) filasResumen.push({ separador: true })
    filasResumen.push(
      { label: 'Total Órdenes de Entrada / 入库单总数',   val: entradasFiltradas.length, numFmt: '#,##0' },
      { label: 'Total Unidades Ingresadas / 入库总件数',  val: redondear2(totalUnidEntradas), numFmt: '#,##0.##' },
      { label: 'Monto Total Entradas (Bs) / 入库总金额',  val: redondear2(totalMontoEntradas), numFmt: '#,##0.00' },
    )
  }

  if (wsSalidas)  XLSX.utils.book_append_sheet(wb, wsSalidas, 'Ordenes Salida')
  if (wsEntradas) XLSX.utils.book_append_sheet(wb, wsEntradas, 'Ordenes Entrada')
  XLSX.utils.book_append_sheet(
    wb,
    construirHojaResumen('SAJAMA S.R.L. — RESUMEN DE CONSULTAS / 综合查询汇总', filasResumen),
    'Resumen'
  )

  XLSX.writeFile(wb, `Reporte_Consultas_SAJAMA_${etiquetaArchivoRango(desde, hasta)}.xlsx`)
  return { salidas: salidasFiltradas.length, entradas: entradasFiltradas.length }
}

// ── 2. Reporte Excel: MAQUINARIA (Agrupado por Empresa con Subtotales, SIN fotos) ─

export function exportarMaquinariaExcel({
  maquinas = [],
  cotizacionBcb = 12.58,
  desde = '',
  hasta = '',
  empresaFiltro = '',
  estadoFiltro = '',
}) {
  const filtradas = filtrarPorRangoFechas(maquinas, desde, hasta)
    .filter(m => {
      const matchEmp = !empresaFiltro || (m.empresa || 'SAJAMA S.R.L.') === empresaFiltro
      const matchEst = !estadoFiltro  || (m.estado  || 'A la venta')    === estadoFiltro
      return matchEmp && matchEst
    })
    .sort((a, b) => extraerFechaISO(a).localeCompare(extraerFechaISO(b)))

  const periodoTxt = textoPeriodoLegible(desde, hasta)
  const tcGlobal = Number(cotizacionBcb || 12.58)

  // Agrupar por Empresa manteniendo orden
  const gruposMap = new Map()
  filtradas.forEach(m => {
    const emp = m.empresa || 'SAJAMA S.R.L.'
    if (!gruposMap.has(emp)) gruposMap.set(emp, [])
    gruposMap.get(emp).push(m)
  })

  // 11 columnas — Exclusión estricta: NO se incluyen fotoMaquinaUrl ni fotoPlacaUrl
  const h = crearHojaEstilizada(11, [7, 12, 26, 20, 14, 22, 13, 15, 16, 18, 28])
  h.addBanner(`SAJAMA S.R.L. — REPORTE DE MAQUINARIA / 机械设备报表  (${periodoTxt})`)

  let grandTotalUsd = 0
  let grandTotalBs  = 0
  const subUsdRefs = []
  const subBsRefs  = []

  if (filtradas.length === 0) {
    h.addMergedRow([{ c1: 0, c2: 10, v: 'Sin maquinaria registrada en el rango seleccionado.', s: STYLES.cellText('center') }], 26)
  } else {
    for (const [empresa, lista] of gruposMap.entries()) {
      h.addMergedRow([
        { c1: 0, c2: 3, v: `Empresa 所属公司: ${empresa}`, s: STYLES.groupMeta('left') },
        { c1: 4, c2: 6, v: `Unidades 台数: ${lista.length}`, s: STYLES.groupMeta('center') },
        { c1: 7, c2: 10, v: `Periodo 期间: ${periodoTxt}   |   TC: ${tcGlobal.toFixed(2)} BOB`, s: STYLES.groupMeta('right') },
      ], 22)

      h.addColumnHeaders([
        'Ítem',
        'Fecha\n日期',
        'Nombre (ES)\n西语名称',
        'Nombre (ZH)\n中文名称',
        'Modelo\n型号',
        'Chasis / Placa\n底盘号 / 车牌',
        'Unidad\n单位',
        'Estado\n状态',
        'Precio ($ USD)\n美元价格',
        'Precio (Bs)\n玻币价格',
        'N° Póliza / Observaciones\n报关单 / 备注',
      ], 32)

      const firstExcelRow = h.getRowCount() + 1
      let subUsd = 0
      let subBs  = 0

      lista.forEach((m, idx) => {
        const tc = Number(cotizacionBcb || m.tipoCambio || 12.58)
        const usdVal = m.precioUsd ? Number(m.precioUsd) : (m.precio ? Number(m.precio) / tc : 0)
        const bsVal  = usdVal > 0 ? (usdVal * tc) : (m.precio ? Number(m.precio) : 0)
        const polizaTxt = m.numPoliza ? `Póliza: ${m.numPoliza}` : (m.polizaUrl ? 'Con póliza' : '')
        const obsCombinada = [polizaTxt, m.observaciones].filter(Boolean).join(' — ')

        subUsd += usdVal
        subBs  += bsVal

        const altoFila = (m.nombreEs || '').length > 32 || obsCombinada.length > 34 ? 28 : 20
        h.addCellsRow([
          { v: idx + 1, s: STYLES.cellNum('#,##0', false, 'center') },
          { v: formatearFechaLegible(extraerFechaISO(m)), s: STYLES.cellText('center') },
          { v: m.nombreEs || '', s: STYLES.cellText('left', true) },
          { v: m.nombreZh || '', s: STYLES.cellText('left') },
          { v: m.modelo || '', s: STYLES.cellText('center') },
          { v: m.serie || '', s: STYLES.cellText('center', true) },
          { v: m.unidad || '', s: STYLES.cellText('center') },
          { v: m.estado || 'A la venta', s: STYLES.cellText('center') },
          { v: redondear2(usdVal), s: STYLES.cellNum('$#,##0.00') },
          { v: redondear2(bsVal), s: STYLES.cellNum('#,##0.00') },
          { v: obsCombinada || '—', s: STYLES.cellText('left') },
        ], altoFila)
      })

      const lastExcelRow = h.getRowCount()
      const subExcelRow  = h.getRowCount() + 1

      h.addMergedRow([
        { c1: 0, c2: 5, v: `Subtotal ${empresa}  (${lista.length} máquina/s)`, s: STYLES.subtotalText('left') },
        { c1: 6, c2: 7, v: 'Monto Subtotal\n小计金额:', s: STYLES.subtotalText('center') },
        { c1: 8, c2: 8, v: redondear2(subUsd), f: `SUM(I${firstExcelRow}:I${lastExcelRow})`, s: STYLES.subtotalNum('$#,##0.00') },
        { c1: 9, c2: 9, v: redondear2(subBs),  f: `SUM(J${firstExcelRow}:J${lastExcelRow})`, s: STYLES.subtotalNum('#,##0.00') },
        { c1: 10, c2: 10, v: '', s: STYLES.subtotalText('left') },
      ], 28)

      subUsdRefs.push(`I${subExcelRow}`)
      subBsRefs.push(`J${subExcelRow}`)
      grandTotalUsd += subUsd
      grandTotalBs  += subBs
    }

    h.addBlankRow(10)
    h.addMergedRow([
      { c1: 0, c2: 7, v: `TOTAL GENERAL MAQUINARIA / 机械设备总计  (${filtradas.length} máquina/s)`, s: STYLES.grandTotalText('right') },
      { c1: 8, c2: 8, v: redondear2(grandTotalUsd), f: formulaSumaCeldas(subUsdRefs), s: STYLES.grandTotalNum('$#,##0.00') },
      { c1: 9, c2: 9, v: redondear2(grandTotalBs),  f: formulaSumaCeldas(subBsRefs),  s: STYLES.grandTotalNum('#,##0.00') },
      { c1: 10, c2: 10, v: 'Solo datos (sin fotos)', s: STYLES.grandTotalText('center') },
    ], 28)
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, h.build(), 'Maquinaria')
  XLSX.writeFile(wb, `Reporte_Maquinaria_SAJAMA_${etiquetaArchivoRango(desde, hasta)}.xlsx`)
  return { total: filtradas.length }
}

// ── 3. Reporte Excel: EQUIPOS / MÁQUINAS (Agrupado por Empresa, SIN fotos) ─

export function exportarEquiposExcel({
  equipos = [],
  cotizacionBcb = 12.58,
  desde = '',
  hasta = '',
  empresaFiltro = '',
  estadoFiltro = '',
}) {
  const filtrados = filtrarPorRangoFechas(equipos, desde, hasta)
    .filter(eq => {
      const matchEmp = !empresaFiltro || (eq.empresa || 'SAJAMA S.R.L.') === empresaFiltro
      const matchEst = !estadoFiltro  || (eq.estado  || 'A la venta')    === estadoFiltro
      return matchEmp && matchEst
    })
    .sort((a, b) => extraerFechaISO(a).localeCompare(extraerFechaISO(b)))

  const periodoTxt = textoPeriodoLegible(desde, hasta)
  const tcGlobal = Number(cotizacionBcb || 12.58)

  const gruposMap = new Map()
  filtrados.forEach(eq => {
    const emp = eq.empresa || 'SAJAMA S.R.L.'
    if (!gruposMap.has(emp)) gruposMap.set(emp, [])
    gruposMap.get(emp).push(eq)
  })

  // 12 columnas — Exclusión estricta: NO se incluyen fotoEquipoUrl, fotoMaquinaUrl ni fotoPlacaUrl
  const h = crearHojaEstilizada(12, [7, 12, 26, 20, 14, 20, 10, 14, 15, 16, 17, 26])
  h.addBanner(`SAJAMA S.R.L. — REPORTE DE EQUIPOS Y MÁQUINAS / 设备报表  (${periodoTxt})`)

  let grandTotalCant = 0
  let grandTotalUsd  = 0
  let grandTotalBs   = 0
  const subCantRefs = []
  const subUsdRefs  = []
  const subBsRefs   = []

  if (filtrados.length === 0) {
    h.addMergedRow([{ c1: 0, c2: 11, v: 'Sin equipos registrados en el rango seleccionado.', s: STYLES.cellText('center') }], 26)
  } else {
    for (const [empresa, lista] of gruposMap.entries()) {
      h.addMergedRow([
        { c1: 0, c2: 3, v: `Empresa 所属公司: ${empresa}`, s: STYLES.groupMeta('left') },
        { c1: 4, c2: 7, v: `Registros 记录数: ${lista.length}`, s: STYLES.groupMeta('center') },
        { c1: 8, c2: 11, v: `Periodo 期间: ${periodoTxt}   |   TC: ${tcGlobal.toFixed(2)} BOB`, s: STYLES.groupMeta('right') },
      ], 22)

      h.addColumnHeaders([
        'Ítem',
        'Fecha\n日期',
        'Equipo / Nombre (ES)\n设备名称',
        'Nombre (ZH)\n中文名称',
        'Modelo\n型号',
        'N° Serie\n序列号',
        'Cantidad\n数量',
        'Estado\n状态',
        'Precio U ($)\n单价 USD',
        'Total ($ USD)\n美元合计',
        'Total (Bs)\n玻币合计',
        'N° Póliza / Observaciones\n报关单 / 备注',
      ], 32)

      const firstExcelRow = h.getRowCount() + 1
      let subCant = 0
      let subUsd  = 0
      let subBs   = 0

      lista.forEach((eq, idx) => {
        const tc = Number(cotizacionBcb || eq.tipoCambio || 12.58)
        const cant = Number(eq.cantidad) || 1
        const usdUnit = eq.precioUsd
          ? Number(eq.precioUsd)
          : (eq.precio ? Number(eq.precio) : (eq.precioBs ? Number(eq.precioBs) / tc : 0))
        const usdTot = usdUnit * cant
        const bsTot  = usdTot > 0 ? (usdTot * tc) : ((Number(eq.precioBs) || 0) * cant)
        const excelRow = h.getRowCount() + 1
        const polizaTxt = eq.numPoliza ? `Póliza: ${eq.numPoliza}` : (eq.polizaUrl ? 'Con póliza' : '')
        const obsCombinada = [polizaTxt, eq.observaciones].filter(Boolean).join(' — ')

        subCant += cant
        subUsd  += usdTot
        subBs   += bsTot

        const altoFila = (eq.nombreEs || '').length > 32 || obsCombinada.length > 32 ? 28 : 20
        h.addCellsRow([
          { v: idx + 1, s: STYLES.cellNum('#,##0', false, 'center') },
          { v: formatearFechaLegible(extraerFechaISO(eq)), s: STYLES.cellText('center') },
          { v: eq.nombreEs || '', s: STYLES.cellText('left', true) },
          { v: eq.nombreZh || '', s: STYLES.cellText('left') },
          { v: eq.modelo || '', s: STYLES.cellText('center') },
          { v: eq.serie || '', s: STYLES.cellText('center') },
          { v: cant, s: STYLES.cellNum('#,##0', false, 'center') },
          { v: eq.estado || 'A la venta', s: STYLES.cellText('center') },
          { v: redondear2(usdUnit), s: STYLES.cellNum('$#,##0.00') },
          { v: redondear2(usdTot), f: `G${excelRow}*I${excelRow}`, s: STYLES.cellNum('$#,##0.00') },
          { v: redondear2(bsTot), s: STYLES.cellNum('#,##0.00') },
          { v: obsCombinada || '—', s: STYLES.cellText('left') },
        ], altoFila)
      })

      const lastExcelRow = h.getRowCount()
      const subExcelRow  = h.getRowCount() + 1

      h.addMergedRow([
        { c1: 0, c2: 5, v: `Subtotal ${empresa}  (${lista.length} registro/s)`, s: STYLES.subtotalText('left') },
        { c1: 6, c2: 6, v: subCant, f: `SUM(G${firstExcelRow}:G${lastExcelRow})`, s: STYLES.subtotalNum('#,##0', 'center') },
        { c1: 7, c2: 8, v: 'Monto Subtotal\n小计金额:', s: STYLES.subtotalText('center') },
        { c1: 9, c2: 9, v: redondear2(subUsd), f: `SUM(J${firstExcelRow}:J${lastExcelRow})`, s: STYLES.subtotalNum('$#,##0.00') },
        { c1: 10, c2: 10, v: redondear2(subBs), f: `SUM(K${firstExcelRow}:K${lastExcelRow})`, s: STYLES.subtotalNum('#,##0.00') },
        { c1: 11, c2: 11, v: '', s: STYLES.subtotalText('left') },
      ], 28)

      subCantRefs.push(`G${subExcelRow}`)
      subUsdRefs.push(`J${subExcelRow}`)
      subBsRefs.push(`K${subExcelRow}`)
      grandTotalCant += subCant
      grandTotalUsd  += subUsd
      grandTotalBs   += subBs
    }

    h.addBlankRow(10)
    h.addMergedRow([
      { c1: 0, c2: 5, v: `TOTAL GENERAL EQUIPOS / 设备总计  (${filtrados.length} registro/s)`, s: STYLES.grandTotalText('right') },
      { c1: 6, c2: 6, v: grandTotalCant, f: formulaSumaCeldas(subCantRefs), s: STYLES.grandTotalNum('#,##0', 'center') },
      { c1: 7, c2: 8, v: 'TOTAL:', s: STYLES.grandTotalText('center') },
      { c1: 9, c2: 9, v: redondear2(grandTotalUsd), f: formulaSumaCeldas(subUsdRefs), s: STYLES.grandTotalNum('$#,##0.00') },
      { c1: 10, c2: 10, v: redondear2(grandTotalBs), f: formulaSumaCeldas(subBsRefs), s: STYLES.grandTotalNum('#,##0.00') },
      { c1: 11, c2: 11, v: 'Solo datos (sin fotos)', s: STYLES.grandTotalText('center') },
    ], 28)
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, h.build(), 'Equipos')
  XLSX.writeFile(wb, `Reporte_Equipos_SAJAMA_${etiquetaArchivoRango(desde, hasta)}.xlsx`)
  return { total: filtrados.length }
}

// ── 4. Reporte Excel: ABASTECIMIENTO Y DESPACHO (Agrupado con Subtotales) ─

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
  const periodoTxt = textoPeriodoLegible(desde, hasta)

  const ordenarAsc = (arr) => [...arr].sort((a, b) => extraerFechaISO(a).localeCompare(extraerFechaISO(b)))

  const entFiltradas = incluirEntradas
    ? ordenarAsc(filtrarPorRangoFechas(entradas, desde, hasta).filter(e => coincideCombustible(e.combustible, combustibleFiltro)))
    : []

  const salFiltradas = incluirSalidas
    ? ordenarAsc(filtrarPorRangoFechas(salidas, desde, hasta).filter(s => coincideCombustible(s.combustible, combustibleFiltro)))
    : []

  const wb = XLSX.utils.book_new()

  let entGasL = 0, entDieL = 0, entBsTotal = 0
  let wsEntradas = null

  // ── Hoja Entradas / Compras: Agrupada por Combustible (Gasolina / Diésel) con Subtotales ──
  if (incluirEntradas) {
    const gruposEnt = new Map()
    entFiltradas.forEach(e => {
      const comb = coincideCombustible(e.combustible, 'Gasolina') ? 'Gasolina' : 'Diésel'
      if (!gruposEnt.has(comb)) gruposEnt.set(comb, [])
      gruposEnt.get(comb).push(e)
    })

    // 9 columnas
    const hEnt = crearHojaEstilizada(9, [7, 13, 14, 22, 20, 14, 14, 16, 26])
    hEnt.addBanner(`SAJAMA S.R.L. — COMPRAS / ENTRADAS DE COMBUSTIBLE / 燃油采购入库  (${periodoTxt})`)

    if (entFiltradas.length === 0) {
      hEnt.addMergedRow([{ c1: 0, c2: 8, v: 'Sin compras de combustible registradas en el rango seleccionado.', s: STYLES.cellText('center') }], 26)
    } else {
      const subLRefs = []
      const subBsRefs = []

      for (const [comb, lista] of gruposEnt.entries()) {
        const combZh = comb === 'Gasolina' ? '汽油' : '柴油'
        hEnt.addMergedRow([
          { c1: 0, c2: 2, v: `Combustible 燃油种类: ${comb} (${combZh})`, s: STYLES.groupMeta('left') },
          { c1: 3, c2: 5, v: `Compras 采购次数: ${lista.length}`, s: STYLES.groupMeta('center') },
          { c1: 6, c2: 8, v: `Periodo 期间: ${periodoTxt}`, s: STYLES.groupMeta('right') },
        ], 22)

        hEnt.addColumnHeaders([
          'Ítem',
          'Fecha\n日期',
          'Combustible\n燃油',
          'Proveedor\n供应商',
          'Responsable\n负责人',
          'Cantidad (L)\n数量 (升)',
          'Precio U\n单价 (Bs)',
          'Precio T\n总价 (Bs)',
          'Observaciones\n备注',
        ], 32)

        const firstExcelRow = hEnt.getRowCount() + 1
        let subL = 0
        let subBs = 0

        lista.forEach((e, idx) => {
          const litros = Number(e.cantidad) || 0
          const pu = Number(e.precioUnitario) || 0
          const pt = Number(e.precioTotal) || (litros * pu)
          const excelRow = hEnt.getRowCount() + 1
          const usarFormula = pu > 0 && Math.abs(pt - (litros * pu)) < 0.1

          subL += litros
          subBs += pt
          if (comb === 'Gasolina') entGasL += litros
          else entDieL += litros
          entBsTotal += pt

          hEnt.addCellsRow([
            { v: idx + 1, s: STYLES.cellNum('#,##0', false, 'center') },
            { v: formatearFechaLegible(extraerFechaISO(e)), s: STYLES.cellText('center') },
            { v: comb, s: STYLES.cellText('center', true) },
            { v: e.proveedor || '—', s: STYLES.cellText('left') },
            { v: e.responsable || '—', s: STYLES.cellText('left') },
            { v: redondear2(litros), s: STYLES.cellNum('#,##0.00', true, 'right') },
            { v: redondear2(pu), s: STYLES.cellNum('#,##0.00') },
            usarFormula
              ? { v: redondear2(pt), f: `F${excelRow}*G${excelRow}`, s: STYLES.cellNum('#,##0.00') }
              : { v: redondear2(pt), s: STYLES.cellNum('#,##0.00') },
            { v: e.observaciones || '', s: STYLES.cellText('left') },
          ], 20)
        })

        const lastExcelRow = hEnt.getRowCount()
        const subExcelRow  = hEnt.getRowCount() + 1

        hEnt.addMergedRow([
          { c1: 0, c2: 2, v: `${comb} (${combZh})`, s: STYLES.subtotalText('center') },
          { c1: 3, c2: 4, v: 'Subtotal Combustible\n燃油小计:', s: STYLES.subtotalText('center') },
          { c1: 5, c2: 5, v: redondear2(subL),  f: `SUM(F${firstExcelRow}:F${lastExcelRow})`, s: STYLES.subtotalNum('#,##0.00') },
          { c1: 6, c2: 6, v: 'Bs', s: STYLES.subtotalText('center') },
          { c1: 7, c2: 7, v: redondear2(subBs), f: `SUM(H${firstExcelRow}:H${lastExcelRow})`, s: STYLES.subtotalNum('#,##0.00') },
          { c1: 8, c2: 8, v: '', s: STYLES.subtotalText('left') },
        ], 28)

        subLRefs.push(`F${subExcelRow}`)
        subBsRefs.push(`H${subExcelRow}`)
      }

      hEnt.addBlankRow(10)
      hEnt.addMergedRow([
        { c1: 0, c2: 4, v: `TOTAL GENERAL COMPRAS / 采购总计  (${entFiltradas.length} compra/s)`, s: STYLES.grandTotalText('right') },
        { c1: 5, c2: 5, v: redondear2(entGasL + entDieL), f: formulaSumaCeldas(subLRefs),  s: STYLES.grandTotalNum('#,##0.00') },
        { c1: 6, c2: 6, v: 'Bs', s: STYLES.grandTotalText('center') },
        { c1: 7, c2: 7, v: redondear2(entBsTotal),        f: formulaSumaCeldas(subBsRefs), s: STYLES.grandTotalNum('#,##0.00') },
        { c1: 8, c2: 8, v: '', s: STYLES.grandTotalText('left') },
      ], 28)
    }

    wsEntradas = hEnt.build()
  }

  let salGasL = 0, salDieL = 0, salBsTotal = 0
  let wsSalidas = null

  // ── Hoja Salidas / Despachos: Agrupada por Fecha de Despacho con Subtotal Diario ──
  if (incluirSalidas) {
    const gruposDia = new Map()
    salFiltradas.forEach(s => {
      const fIso = extraerFechaISO(s) || 'Sin fecha'
      if (!gruposDia.has(fIso)) gruposDia.set(fIso, [])
      gruposDia.get(fIso).push(s)
    })

    // 10 columnas
    const hSal = crearHojaEstilizada(10, [7, 13, 18, 12, 20, 18, 13, 13, 15, 24])
    hSal.addBanner(`SAJAMA S.R.L. — DESPACHOS / SALIDAS DE COMBUSTIBLE / 燃油派送出库  (${periodoTxt})`)

    if (salFiltradas.length === 0) {
      hSal.addMergedRow([{ c1: 0, c2: 9, v: 'Sin despachos de combustible registrados en el rango seleccionado.', s: STYLES.cellText('center') }], 26)
    } else {
      const subLRefs = []
      const subBsRefs = []

      for (const [fIso, lista] of gruposDia.entries()) {
        const fechaFmt = formatearFechaLegible(fIso)
        let gasDia = 0
        let dieDia = 0
        lista.forEach(s => {
          const l = Number(s.cantidad) || 0
          if (coincideCombustible(s.combustible, 'Gasolina')) gasDia += l
          else dieDia += l
        })

        hSal.addMergedRow([
          { c1: 0, c2: 2, v: `Fecha de Despacho 派送日期: ${fechaFmt}`, s: STYLES.groupMeta('left') },
          { c1: 3, c2: 6, v: `Gasolina: ${redondear2(gasDia)} L   |   Diésel: ${redondear2(dieDia)} L`, s: STYLES.groupMeta('center') },
          { c1: 7, c2: 9, v: `Despachos 当日次数: ${lista.length}`, s: STYLES.groupMeta('right') },
        ], 22)

        hSal.addColumnHeaders([
          'Ítem',
          'Combustible\n燃油',
          'Placa / Chasis\n车牌 / 底盘号',
          'N° Móvil\n车辆编号',
          'Destino\n目的地',
          'Responsable\n领用人',
          'Cantidad (L)\n数量 (升)',
          'Precio U\n单价 (Bs)',
          'Precio T\n总价 (Bs)',
          'Observaciones\n备注',
        ], 32)

        const firstExcelRow = hSal.getRowCount() + 1
        let subL = 0
        let subBs = 0

        lista.forEach((s, idx) => {
          const litros = Number(s.cantidad) || 0
          const pu = Number(s.precioUnitario) || 0
          const pt = Number(s.precioTotal) || (litros * pu)
          const excelRow = hSal.getRowCount() + 1
          const usarFormula = pu > 0 && Math.abs(pt - (litros * pu)) < 0.1

          subL += litros
          subBs += pt
          if (coincideCombustible(s.combustible, 'Gasolina')) salGasL += litros
          else salDieL += litros
          salBsTotal += pt

          hSal.addCellsRow([
            { v: idx + 1, s: STYLES.cellNum('#,##0', false, 'center') },
            { v: s.combustible || '', s: STYLES.cellText('center', true) },
            { v: s.seriePlaca || '—', s: STYLES.cellText('center', true) },
            { v: s.nroMovil || '—', s: STYLES.cellText('center') },
            { v: s.destino || '—', s: STYLES.cellText('left') },
            { v: s.responsable || '—', s: STYLES.cellText('left') },
            { v: redondear2(litros), s: STYLES.cellNum('#,##0.00', true, 'right') },
            { v: redondear2(pu), s: STYLES.cellNum('#,##0.00') },
            usarFormula
              ? { v: redondear2(pt), f: `G${excelRow}*H${excelRow}`, s: STYLES.cellNum('#,##0.00') }
              : { v: redondear2(pt), s: STYLES.cellNum('#,##0.00') },
            { v: s.observaciones || '', s: STYLES.cellText('left') },
          ], 20)
        })

        const lastExcelRow = hSal.getRowCount()
        const subExcelRow  = hSal.getRowCount() + 1

        hSal.addMergedRow([
          { c1: 0, c2: 3, v: `Día ${fechaFmt}  (Gas: ${redondear2(gasDia)} L | Dié: ${redondear2(dieDia)} L)`, s: STYLES.subtotalText('center') },
          { c1: 4, c2: 5, v: 'Subtotal Día\n当日合计:', s: STYLES.subtotalText('center') },
          { c1: 6, c2: 6, v: redondear2(subL),  f: `SUM(G${firstExcelRow}:G${lastExcelRow})`, s: STYLES.subtotalNum('#,##0.00') },
          { c1: 7, c2: 7, v: 'Bs', s: STYLES.subtotalText('center') },
          { c1: 8, c2: 8, v: redondear2(subBs), f: `SUM(I${firstExcelRow}:I${lastExcelRow})`, s: STYLES.subtotalNum('#,##0.00') },
          { c1: 9, c2: 9, v: '', s: STYLES.subtotalText('left') },
        ], 28)

        subLRefs.push(`G${subExcelRow}`)
        subBsRefs.push(`I${subExcelRow}`)
      }

      hSal.addBlankRow(10)
      hSal.addMergedRow([
        { c1: 0, c2: 5, v: `TOTAL GENERAL DESPACHOS / 派送总计  (${salFiltradas.length} despacho/s)`, s: STYLES.grandTotalText('right') },
        { c1: 6, c2: 6, v: redondear2(salGasL + salDieL), f: formulaSumaCeldas(subLRefs),  s: STYLES.grandTotalNum('#,##0.00') },
        { c1: 7, c2: 7, v: 'Bs', s: STYLES.grandTotalText('center') },
        { c1: 8, c2: 8, v: redondear2(salBsTotal),        f: formulaSumaCeldas(subBsRefs), s: STYLES.grandTotalNum('#,##0.00') },
        { c1: 9, c2: 9, v: '', s: STYLES.grandTotalText('left') },
      ], 28)
    }

    wsSalidas = hSal.build()
  }

  // Hoja Resumen Combustibles
  const filasResumen = [
    { label: 'Módulo / 模块',                       val: 'Abastecimiento y Despacho de Combustible — SAJAMA S.R.L.' },
    { label: 'Periodo del Reporte / 期间',          val: periodoTxt },
    { label: 'Filtro Combustible / 燃油筛选',       val: combustibleFiltro || 'Todos (Gasolina y Diésel)' },
    { label: 'Fecha de Generación / 生成日期',      val: format(new Date(), 'dd/MM/yyyy HH:mm') },
    { separador: true },
  ]
  if (incluirEntradas) {
    filasResumen.push(
      { label: 'Compras — Registros / 采购次数',          val: entFiltradas.length, numFmt: '#,##0' },
      { label: 'Compras — Gasolina (L) / 汽油采购',       val: redondear2(entGasL), numFmt: '#,##0.00' },
      { label: 'Compras — Diésel (L) / 柴油采购',         val: redondear2(entDieL), numFmt: '#,##0.00' },
      { label: 'Compras — Total Litros / 采购总升数',     val: redondear2(entGasL + entDieL), numFmt: '#,##0.00' },
      { label: 'Compras — Monto Total (Bs) / 采购总金额', val: redondear2(entBsTotal), numFmt: '#,##0.00' },
      { separador: true },
    )
  }
  if (incluirSalidas) {
    filasResumen.push(
      { label: 'Despachos — Registros / 派送次数',          val: salFiltradas.length, numFmt: '#,##0' },
      { label: 'Despachos — Gasolina (L) / 汽油派送',       val: redondear2(salGasL), numFmt: '#,##0.00' },
      { label: 'Despachos — Diésel (L) / 柴油派送',         val: redondear2(salDieL), numFmt: '#,##0.00' },
      { label: 'Despachos — Total Litros / 派送总升数',     val: redondear2(salGasL + salDieL), numFmt: '#,##0.00' },
      { label: 'Despachos — Monto Total (Bs) / 派送总金额', val: redondear2(salBsTotal), numFmt: '#,##0.00' },
      { separador: true },
    )
  }
  filasResumen.push(
    { label: 'Saldo Actual en Tanque — Gasolina (L) / 汽油库存', val: redondear2(saldos?.gasolina || 0), numFmt: '#,##0.00' },
    { label: 'Saldo Actual en Tanque — Diésel (L) / 柴油库存',   val: redondear2(saldos?.diesel   || 0), numFmt: '#,##0.00' },
  )

  if (wsSalidas)  XLSX.utils.book_append_sheet(wb, wsSalidas,  'Salidas Despachos')
  if (wsEntradas) XLSX.utils.book_append_sheet(wb, wsEntradas, 'Entradas Compras')
  XLSX.utils.book_append_sheet(
    wb,
    construirHojaResumen('SAJAMA S.R.L. — RESUMEN DE COMBUSTIBLES / 燃油汇总', filasResumen),
    'Resumen Combustibles'
  )

  XLSX.writeFile(wb, `Reporte_Abastecimiento_SAJAMA_${etiquetaArchivoRango(desde, hasta)}.xlsx`)
  return { entradas: entFiltradas.length, salidas: salFiltradas.length }
}
