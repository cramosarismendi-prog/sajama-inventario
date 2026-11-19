import { useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'

const DEFAULT_TIPO_CAMBIO = {
  precioActual: 9.83,
  precioAnterior: 9.83,
  variacionAbsoluta: 0,
  variacionPorcentual: 0,
  tendencia: 'STABLE', // 'UP' | 'DOWN' | 'STABLE'
  ultimaActualizacion: null,
  fuente: 'Banco Central de Bolivia (BCB Oficial)',
  esManual: false,
}

/**
 * Consulta la cotización en tiempo real desde APIs financieras del Banco Central de Bolivia (BCB) o Mercado P2P
 */
export async function consultarApiDolarEnVivo(modo = 'oficial') {
  // 1. Si se solicita Oficial (BCB 9.83)
  if (modo === 'oficial') {
    try {
      const res = await fetch('https://bo.dolarapi.com/v1/dolares/oficial')
      if (res.ok) {
        const data = await res.json()
        const valor = parseFloat(data.venta || data.compra)
        if (valor && valor > 5 && valor < 50) {
          return { valor, fuente: 'Banco Central de Bolivia (BCB Oficial)', tipo: 'oficial' }
        }
      }
    } catch (e) {
      console.warn('Fallo consulta BCB Oficial dolarapi:', e)
    }

    try {
      const res2 = await fetch('https://apibcb.cucu.bo/api/v1/tc/oficial')
      if (res2.ok) {
        const data2 = await res2.json()
        const valor2 = parseFloat(data2?.tc_oficial?.valor)
        if (valor2 && valor2 > 5 && valor2 < 50) {
          return { valor: valor2, fuente: 'Banco Central de Bolivia (BCB API)', tipo: 'oficial' }
        }
      }
    } catch (err) {
      console.warn('Fallo consulta CUCU BCB:', err)
    }
  }

  // 2. Si se solicita Mercado Binance P2P
  try {
    const res = await fetch('https://bo.dolarapi.com/v1/dolares/binance')
    if (res.ok) {
      const data = await res.json()
      const valor = parseFloat(data.venta || data.compra)
      if (valor && valor > 5 && valor < 50) {
        return { valor, fuente: 'Binance P2P (Mercado Real)', tipo: 'binance' }
      }
    }
  } catch (e) {
    console.warn('Fallo consulta Binance P2P:', e)
  }

  // Fallback por defecto BCB
  return { valor: 9.83, fuente: 'Banco Central de Bolivia (BCB Oficial)', tipo: 'oficial' }
}

export function useTipoCambio() {
  const [tipoCambio, setTipoCambio] = useState(DEFAULT_TIPO_CAMBIO)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const docRef = doc(db, 'configuracion', 'tipoCambio')

    // Función encargada de validar y auto-sincronizar si el precio varió en la API oficial
    const sincronizarEnVivo = async (dataActual) => {
      if (dataActual?.esManual) return // Respetar ajuste manual si fue fijado

      const modoDeseado = dataActual?.fuente?.includes('Binance') ? 'binance' : 'oficial'
      const result = await consultarApiDolarEnVivo(modoDeseado)
      if (!result || !result.valor) return

      const nuevoValor = result.valor
      const precioRemoto = dataActual?.precioActual ?? 0

      // Si el precio cambió o es la primera inicialización, actualizar Firestore
      if (Math.abs(nuevoValor - precioRemoto) >= 0.01 || !dataActual || precioRemoto === 10.99) {
        const precioPrevio = (precioRemoto > 0 && precioRemoto !== 10.99) ? precioRemoto : nuevoValor
        const difAbs = parseFloat((nuevoValor - precioPrevio).toFixed(2))
        const difPct = precioPrevio > 0 ? parseFloat(((difAbs / precioPrevio) * 100).toFixed(2)) : 0
        const tendencia = difAbs > 0 ? 'UP' : difAbs < 0 ? 'DOWN' : 'STABLE'

        await setDoc(
          docRef,
          {
            precioActual: nuevoValor,
            precioAnterior: precioPrevio,
            variacionAbsoluta: difAbs,
            variacionPorcentual: difPct,
            tendencia,
            ultimaActualizacion: serverTimestamp(),
            fuente: result.fuente,
            esManual: false,
          },
          { merge: true }
        ).catch((err) => console.warn('Error al auto-actualizar Firestore tipoCambio:', err))
      }
    }

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data()
          setTipoCambio({
            precioActual: data.precioActual ?? DEFAULT_TIPO_CAMBIO.precioActual,
            precioAnterior: data.precioAnterior ?? DEFAULT_TIPO_CAMBIO.precioAnterior,
            variacionAbsoluta: data.variacionAbsoluta ?? 0,
            variacionPorcentual: data.variacionPorcentual ?? 0,
            tendencia: data.tendencia || 'STABLE',
            ultimaActualizacion: data.ultimaActualizacion?.toDate
              ? data.ultimaActualizacion.toDate().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
              : 'Reciente',
            fuente: data.fuente || 'Banco Central de Bolivia (BCB Oficial)',
            esManual: !!data.esManual,
          })
          setLoading(false)

          // Auto-sincronizar en segundo plano
          sincronizarEnVivo(data)
        } else {
          // Si el documento aún no existe en Firestore
          sincronizarEnVivo(null)
          setTipoCambio(DEFAULT_TIPO_CAMBIO)
          setLoading(false)
        }
      },
      (err) => {
        console.error('Error al suscribirse al tipo de cambio:', err)
        setError(err)
        setLoading(false)
      }
    )

    // Intervalo de auto-verificación cada 5 minutos
    const timerInterval = setInterval(() => {
      sincronizarEnVivo(tipoCambio)
    }, 5 * 60 * 1000)

    return () => {
      unsubscribe()
      clearInterval(timerInterval)
    }
  }, [])

  // Conversiones utilitarias
  const convertirBsAUsd = (montoBs) => {
    const bs = parseFloat(montoBs) || 0
    const tasa = tipoCambio.precioActual || 1
    return (bs / tasa).toFixed(2)
  }

  const convertirUsdABs = (montoUsd) => {
    const usd = parseFloat(montoUsd) || 0
    const tasa = tipoCambio.precioActual || 1
    return (usd * tasa).toFixed(2)
  }

  // Actualización manual por administradores
  const actualizarTipoCambioManual = async (nuevoPrecio, esManual = true, nuevaFuente = null) => {
    const precioNumerico = parseFloat(nuevoPrecio)
    if (isNaN(precioNumerico) || precioNumerico <= 0) {
      throw new Error('El precio debe ser un número positivo válido.')
    }

    const docRef = doc(db, 'configuracion', 'tipoCambio')
    const precioPrevio = tipoCambio.precioActual || precioNumerico
    const difAbs = precioNumerico - precioPrevio
    const difPct = precioPrevio > 0 ? (difAbs / precioPrevio) * 100 : 0
    const tendencia = difAbs > 0 ? 'UP' : difAbs < 0 ? 'DOWN' : 'STABLE'

    await setDoc(
      docRef,
      {
        precioActual: precioNumerico,
        precioAnterior: precioPrevio,
        variacionAbsoluta: parseFloat(difAbs.toFixed(2)),
        variacionPorcentual: parseFloat(difPct.toFixed(2)),
        tendencia,
        ultimaActualizacion: serverTimestamp(),
        fuente: nuevaFuente || (esManual ? 'Ajuste Manual Admin' : 'Sistema'),
        esManual,
      },
      { merge: true }
    )
  }

  // Fuerza la sincronización en vivo con la API elegida (oficial BCB 9.83 o Binance P2P)
  const forzarSincronizacionEnVivo = async (modo = 'oficial') => {
    const result = await consultarApiDolarEnVivo(modo)
    if (result && result.valor) {
      await actualizarTipoCambioManual(result.valor, false, result.fuente)
      return result
    }
    throw new Error('No se pudo obtener la cotización desde la API especificada.')
  }

  return {
    ...tipoCambio,
    precioDolar: tipoCambio.precioActual,
    loading,
    error,
    convertirBsAUsd,
    convertirUsdABs,
    actualizarTipoCambioManual,
    forzarSincronizacionEnVivo,
  }
}
