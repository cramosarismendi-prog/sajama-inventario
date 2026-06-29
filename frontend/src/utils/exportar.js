import * as XLSX from 'xlsx'

export const exportarInventarioExcel = (items) => {
  const datos = items.map(i => ({
    'Código':               i.codigo,
    'Descripción (ES)':     i.descripcion,
    'Descripción (中文)':    i.descripcionZh || '',
    'Modelo':               i.modelo    || '',
    'N° Serie':             i.serie     || '',
    'Categoría':            i.categoria || '',
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
    { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 20 },
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
