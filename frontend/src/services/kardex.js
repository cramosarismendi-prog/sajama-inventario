import { db } from './firebase'
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, setDoc,
  query, where, orderBy, limit, serverTimestamp, writeBatch, increment
} from 'firebase/firestore'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'

// Colecciones Firestore utilizadas
const COL_KARDEX = 'kardex_movimientos'
const COL_CIERRES = 'kardex_cierres_mensuales'
const COL_CONCILIACIONES = 'kardex_conciliaciones'
const COL_INVENTARIO = 'inventario'

// ── 1. Capa de Catálogo y Saldos en Tiempo Real ─────────────────────────

/**
 * Obtiene el inventario con cálculos de valoración económica
 */
export async function getCatalogoValorado() {
  const snap = await getDocs(collection(db, COL_INVENTARIO))
  const items = snap.docs.map(d => {
    const data = d.data()
    const stock = Number(data.stock) || 0
    // Costo promedio ponderado o precio unitario base
    const costoUnitario = Number(data.costoPromedio || data.precio || 0)
    const valorTotal = stock * costoUnitario

    return {
      id: d.id,
      ...data,
      stock,
      costoUnitario,
      valorTotal
    }
  })

  // KPIs globales de balance
  const totalActivoNeto = items.reduce((a, i) => a + i.valorTotal, 0)
  const totalUnidadesFisicas = items.reduce((a, i) => a + i.stock, 0)
  const itemsConStock = items.filter(i => i.stock > 0).length
  const itemsSinStock = items.filter(i => i.stock <= 0).length

  return {
    items,
    kpis: {
      totalActivoNeto,
      totalUnidadesFisicas,
      itemsConStock,
      itemsSinStock,
      totalItems: items.length
    }
  }
}

// ── 2. Capa de Kardex y Control de Salidas (Libro Diario) ───────────────

/**
 * Tipos de movimiento disponibles
 */
export const TIPOS_MOVIMIENTO = [
  { id: 'ENTRADA_COMPRA',       label: 'Entrada por Compra',                signo: 1,  tipo: 'entrada' },
  { id: 'ENTRADA_DEVOLUCION',    label: 'Entrada por Devolución de Cliente',  signo: 1,  tipo: 'entrada' },
  { id: 'SALIDA_VENTA',         label: 'Salida por Venta (COGS)',           signo: -1, tipo: 'salida'  },
  { id: 'SALIDA_MERMA',         label: 'Salida por Merma / Daño / Venc.',   signo: -1, tipo: 'salida'  },
  { id: 'SALIDA_CONSUMO',       label: 'Salida por Consumo Interno',        signo: -1, tipo: 'salida'  },
  { id: 'TRANSFERENCIA_INTERNA',label: 'Transferencia entre Sucursales',    signo: 0,  tipo: 'transferencia' },
  { id: 'AJUSTE_SOBRANTE',      label: 'Ajuste de Auditoría (Sobrante +)',  signo: 1,  tipo: 'ajuste'  },
  { id: 'AJUSTE_FALTANTE',      label: 'Ajuste de Auditoría (Faltante -)',  signo: -1, tipo: 'ajuste'  },
  { id: 'CONTRA_ASIENTO',       label: 'Contra-Asiento de Corrección',      signo: 0,  tipo: 'correccion' },
]

/**
 * Verifica si una fecha pertenece a un periodo cerrado (Period Locking)
 */
export async function verificarPeriodoBloqueado(fechaStr) {
  try {
    const periodo = fechaStr ? fechaStr.substring(0, 7) : format(new Date(), 'yyyy-MM')
    const cierreRef = doc(db, COL_CIERRES, periodo)
    const cierreSnap = await getDoc(cierreRef)
    if (cierreSnap.exists() && cierreSnap.data().estado === 'Cerrado') {
      return {
        bloqueado: true,
        periodo,
        cierre: cierreSnap.data()
      }
    }
    return { bloqueado: false, periodo }
  } catch (err) {
    console.error('Error al verificar period locking:', err)
    return { bloqueado: false }
  }
}

/**
 * Registra un movimiento inmutable en el Kardex y actualiza el stock en Inventario
 */
export async function registrarMovimientoKardex({
  itemId,
  tipoMovimiento,
  fecha,
  cantidad,
  costoUnitario,
  documentoRespaldo,
  numDocumento,
  usuarioResponsable,
  justificacion,
  contraAsientoDe = null
}) {
  // 1. Period Locking check
  const checkBloqueo = await verificarPeriodoBloqueado(fecha)
  if (checkBloqueo.bloqueado) {
    throw new Error(`El periodo contable ${checkBloqueo.periodo} se encuentra CERRADO y BLOQUEADO. No se pueden registrar movimientos en fechas cerradas.`)
  }

  // 2. Obtener datos actuales del ítem
  const itemRef = doc(db, COL_INVENTARIO, itemId)
  const itemSnap = await getDoc(itemRef)
  if (!itemSnap.exists()) {
    throw new Error('El ítem especificado no existe en el catálogo.')
  }

  const itemData = itemSnap.data()
  const stockAnterior = Number(itemData.stock) || 0
  const costoAnterior = Number(itemData.costoPromedio || itemData.precio || 0)
  const saldoMonetarioAnterior = stockAnterior * costoAnterior

  const metaTipo = TIPOS_MOVIMIENTO.find(t => t.id === tipoMovimiento) || { signo: 1, label: tipoMovimiento }
  const cantNum = Math.abs(Number(cantidad) || 0)
  const costoUnitNum = Number(costoUnitario) !== undefined && costoUnitario !== '' ? Number(costoUnitario) : costoAnterior
  const costoTotalMov = cantNum * costoUnitNum

  let deltaStock = 0
  if (metaTipo.signo === 1) {
    deltaStock = cantNum
  } else if (metaTipo.signo === -1) {
    deltaStock = -cantNum
  }

  // Si es salida, validar existencias
  if (deltaStock < 0 && stockAnterior < cantNum && tipoMovimiento !== 'AJUSTE_FALTANTE') {
    throw new Error(`Stock insuficiente. Stock actual: ${stockAnterior}, requerido: ${cantNum}`)
  }

  const stockPosterior = stockAnterior + deltaStock

  // Cálculo del nuevo Costo Promedio Ponderado (CPP) si es entrada por compra
  let nuevoCostoPromedio = costoAnterior
  if (tipoMovimiento === 'ENTRADA_COMPRA' && stockPosterior > 0) {
    const valorNuevoTotal = saldoMonetarioAnterior + (cantNum * costoUnitNum)
    nuevoCostoPromedio = Number((valorNuevoTotal / stockPosterior).toFixed(4))
  } else if (costoAnterior === 0 && costoUnitNum > 0) {
    nuevoCostoPromedio = costoUnitNum
  }

  const saldoMonetarioPosterior = stockPosterior * nuevoCostoPromedio
  const periodo = fecha ? fecha.substring(0, 7) : format(new Date(), 'yyyy-MM')

  const batch = writeBatch(db)

  // Registro del asiento inmutable en kardex_movimientos
  const nuevoKardexRef = doc(collection(db, COL_KARDEX))
  const datosMovimiento = {
    itemId,
    codigo: itemData.codigo || '',
    descripcion: itemData.descripcion || '',
    descripcionZh: itemData.descripcionZh || '',
    categoria: itemData.categoria || '',
    tipoMovimiento,
    tipoLabel: metaTipo.label,
    tipoOperacion: metaTipo.tipo,
    fecha: fecha || format(new Date(), 'yyyy-MM-dd'),
    fechaHora: new Date().toISOString(),
    periodo,
    cantidad: cantNum,
    deltaStock,
    costoUnitario: costoUnitNum,
    costoTotalMovimiento: costoTotalMov,
    stockAnterior,
    stockPosterior,
    saldoMonetarioAnterior,
    saldoMonetarioPosterior,
    costoPromedioPonderado: nuevoCostoPromedio,
    documentoRespaldo: documentoRespaldo || 'Interno',
    numDocumento: numDocumento || 'S/N',
    usuarioResponsable: usuarioResponsable || 'Sistema',
    justificacion: justificacion || '',
    contraAsientoDe: contraAsientoDe || null,
    creadoEn: serverTimestamp()
  }

  batch.set(nuevoKardexRef, datosMovimiento)

  // Actualizar ítem en inventario
  const actualizacionInventario = {
    stock: stockPosterior,
    costoPromedio: nuevoCostoPromedio,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: usuarioResponsable || 'Kardex'
  }
  if (deltaStock < 0) {
    actualizacionInventario.totalSalidas = increment(Math.abs(deltaStock))
  }

  batch.update(itemRef, actualizacionInventario)

  await batch.commit()

  return { id: nuevoKardexRef.id, ...datosMovimiento }
}

/**
 * Obtiene la lista de movimientos del Kardex con filtros
 */
export async function getMovimientosKardex({ itemId = null, periodo = null, limite = 100 } = {}) {
  let q = collection(db, COL_KARDEX)
  const condiciones = []

  if (itemId) condiciones.push(where('itemId', '==', itemId))
  if (periodo) condiciones.push(where('periodo', '==', periodo))

  if (condiciones.length > 0) {
    q = query(q, ...condiciones)
  } else {
    q = query(q, orderBy('fechaHora', 'desc'), limit(limite))
  }

  const snap = await getDocs(q)
  let resultados = snap.docs.map(d => ({ id: d.id, ...d.data() }))

  resultados.sort((a, b) => new Date(b.fechaHora || b.fecha) - new Date(a.fechaHora || a.fecha))
  return resultados
}

// ── 3. Capa de Cierres Mensuales (Historial Inmutable & Period Locking) ──

/**
 * Obtiene todos los cierres mensuales registrados
 */
export async function getCierresMensuales() {
  const snap = await getDocs(collection(db, COL_CIERRES))
  const cierres = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  cierres.sort((a, b) => b.periodo.localeCompare(a.periodo))
  return cierres
}

/**
 * Ejecuta y consolida el Cierre Mensual Contable (Snapshot inmutable)
 */
export async function ejecutarCierreMensual({ periodo, usuario, notas = '' }) {
  if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) {
    throw new Error('El formato del periodo debe ser YYYY-MM')
  }

  const qMovs = query(collection(db, COL_KARDEX), where('periodo', '==', periodo))
  const snapMovs = await getDocs(qMovs)
  const movimientosPeriodo = snapMovs.docs.map(d => d.data())

  const { items } = await getCatalogoValorado()

  let unidadesEntradas = 0
  let valorEntradasBs = 0
  let unidadesSalidas = 0
  let valorSalidasBs = 0

  movimientosPeriodo.forEach(m => {
    if (m.deltaStock > 0) {
      unidadesEntradas += Number(m.cantidad) || 0
      valorEntradasBs += Number(m.costoTotalMovimiento) || 0
    } else if (m.deltaStock < 0) {
      unidadesSalidas += Number(m.cantidad) || 0
      valorSalidasBs += Number(m.costoTotalMovimiento) || 0
    }
  })

  const unidadesFinales = items.reduce((a, i) => a + (Number(i.stock) || 0), 0)
  const valorFinalBs = items.reduce((a, i) => a + (Number(i.valorTotal) || 0), 0)

  const unidadesIniciales = Math.max(0, unidadesFinales - unidadesEntradas + unidadesSalidas)
  const valorInicialBs = Math.max(0, valorFinalBs - valorEntradasBs + valorSalidasBs)

  const snapshotItems = items.map(i => ({
    itemId: i.id,
    codigo: i.codigo || '',
    descripcion: i.descripcion || '',
    stock: i.stock,
    costoUnitario: i.costoUnitario,
    valorTotal: i.valorTotal
  }))

  const cierreData = {
    periodo,
    fechaCierre: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    cerradoPor: usuario || 'Auditor Contable',
    estado: 'Cerrado',
    unidadesIniciales,
    unidadesEntradas,
    unidadesSalidas,
    unidadesFinales,
    valorInicialBs,
    valorEntradasBs,
    valorSalidasBs,
    valorFinalBs,
    totalMovimientos: movimientosPeriodo.length,
    totalItemsSnapshot: snapshotItems.length,
    snapshotItems,
    notas,
    creadoEn: serverTimestamp()
  }

  await setDoc(doc(db, COL_CIERRES, periodo), cierreData)
  return cierreData
}

/**
 * Reapertura de un periodo (Solo Administrador)
 */
export async function reabrirPeriodoContable(periodo, usuario) {
  const cierreRef = doc(db, COL_CIERRES, periodo)
  await updateDoc(cierreRef, {
    estado: 'Abierto',
    reabiertoPor: usuario,
    reabiertoEn: serverTimestamp()
  })
}

// ── 4. Capa de Auditoría y Conciliación Física (Conteo Ciego) ────────────

/**
 * Obtiene historial de conciliaciones físicas
 */
export async function getConciliacionesFisicas() {
  const snap = await getDocs(collection(db, COL_CONCILIACIONES))
  const concs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  concs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  return concs
}

/**
 * Guarda o aplica una Conciliación Física con ajuste automático en Kardex
 */
export async function guardarConciliacionFisica({
  fecha,
  auditorResponsable,
  ubicacionAlmacen,
  conteoItems,
  aplicarAjustes = false,
  usuario
}) {
  const fechaStr = fecha || format(new Date(), 'yyyy-MM-dd')
  const periodo = fechaStr.substring(0, 7)

  if (aplicarAjustes) {
    const checkBloqueo = await verificarPeriodoBloqueado(fechaStr)
    if (checkBloqueo.bloqueado) {
      throw new Error(`El periodo contable ${checkBloqueo.periodo} está bloqueado. No se pueden aplicar ajustes automáticos.`)
    }
  }

  let totalDiferenciaUnidades = 0
  let totalImpactoEconomicoBs = 0
  let itemsConDiferencia = 0

  const itemsProcesados = conteoItems.map(item => {
    const stockTeorico = Number(item.stockTeorico) || 0
    const conteoFisico = Number(item.conteoFisico) || 0
    const diferencia = conteoFisico - stockTeorico
    const costo = Number(item.costoUnitario) || 0
    const impacto = diferencia * costo

    if (diferencia !== 0) itemsConDiferencia++
    totalDiferenciaUnidades += diferencia
    totalImpactoEconomicoBs += impacto

    return {
      ...item,
      stockTeorico,
      conteoFisico,
      diferencia,
      costoUnitario: costo,
      impactoEconomicoBs: impacto,
      estado: diferencia === 0 ? 'Conforme' : diferencia > 0 ? 'Sobrante' : 'Faltante'
    }
  })

  const conciliacionData = {
    fecha: fechaStr,
    fechaHora: new Date().toISOString(),
    periodo,
    auditorResponsable: auditorResponsable || usuario || 'Auditor',
    ubicacionAlmacen: ubicacionAlmacen || 'Almacén Central',
    totalItemsAuditados: itemsProcesados.length,
    itemsConDiferencia,
    totalDiferenciaUnidades,
    totalImpactoEconomicoBs,
    ajustesAplicados: aplicarAjustes,
    items: itemsProcesados,
    creadoEn: serverTimestamp()
  }

  const concDocRef = await addDoc(collection(db, COL_CONCILIACIONES), conciliacionData)

  if (aplicarAjustes) {
    for (const it of itemsProcesados) {
      if (it.diferencia !== 0) {
        const esSobrante = it.diferencia > 0
        await registrarMovimientoKardex({
          itemId: it.itemId,
          tipoMovimiento: esSobrante ? 'AJUSTE_SOBRANTE' : 'AJUSTE_FALTANTE',
          fecha: fechaStr,
          cantidad: Math.abs(it.diferencia),
          costoUnitario: it.costoUnitario,
          documentoRespaldo: 'Acta de Conciliación Física',
          numDocumento: `ACTA-${concDocRef.id.substring(0, 6).toUpperCase()}`,
          usuarioResponsable: auditorResponsable || usuario,
          justificacion: `Ajuste automático por conciliación física (${esSobrante ? 'Sobrante' : 'Faltante'} de ${Math.abs(it.diferencia)} un.)`
        })
      }
    }
  }

  return { id: concDocRef.id, ...conciliacionData }
}
