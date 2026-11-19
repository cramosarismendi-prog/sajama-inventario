import { doc, onSnapshot, getDoc } from 'firebase/firestore'
import { db } from './firebase'

// Tasa oficial de referencia Banco Central de Bolivia (BCB): 9.83 BOB = 1 USD (17 Sept 2026)
export const TASA_OFICIAL_BCB_DEFAULT = 9.83

/**
 * Escucha en tiempo real la cotización del dólar en Firestore (Singleton configuracion/tipoCambio)
 */
export function suscribirCotizacionUSD(callback) {
  try {
    const docRef = doc(db, 'configuracion', 'tipoCambio')
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data()
          const precio = Number(data.precioActual || data.tasaBcb || TASA_OFICIAL_BCB_DEFAULT)
          callback(precio, data)
        } else {
          callback(TASA_OFICIAL_BCB_DEFAULT, { precioActual: TASA_OFICIAL_BCB_DEFAULT })
        }
      },
      (err) => {
        console.warn('Error suscribiendo a cotización dólar:', err.message)
        callback(TASA_OFICIAL_BCB_DEFAULT, { precioActual: TASA_OFICIAL_BCB_DEFAULT })
      }
    )
  } catch (e) {
    callback(TASA_OFICIAL_BCB_DEFAULT, { precioActual: TASA_OFICIAL_BCB_DEFAULT })
    return () => {}
  }
}

/**
 * Obtiene la cotización del dólar de forma asíncrona única.
 */
export async function obtenerTipoCambioUSD() {
  try {
    const docRef = doc(db, 'configuracion', 'tipoCambio')
    const snap = await getDoc(docRef)
    if (snap.exists()) {
      const data = snap.data()
      return Number(data.precioActual || data.tasaBcb || TASA_OFICIAL_BCB_DEFAULT)
    }
  } catch (e) {
    console.warn('Error obteniendo cotización:', e.message)
  }
  return TASA_OFICIAL_BCB_DEFAULT
}

export const obtenerCotizacionUSD = obtenerTipoCambioUSD

export function convertirUSDaBOB(montoUSD, tasa = TASA_OFICIAL_BCB_DEFAULT) {
  const usd = parseFloat(montoUSD) || 0
  const rate = parseFloat(tasa) || TASA_OFICIAL_BCB_DEFAULT
  return Math.round(usd * rate * 100) / 100
}

export function convertirBOBaUSD(montoBOB, tasa = TASA_OFICIAL_BCB_DEFAULT) {
  const bob = parseFloat(montoBOB) || 0
  const rate = parseFloat(tasa) || TASA_OFICIAL_BCB_DEFAULT
  return rate > 0 ? Math.round((bob / rate) * 100) / 100 : 0
}
