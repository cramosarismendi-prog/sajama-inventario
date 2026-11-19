const { onSchedule } = require('firebase-functions/v2/scheduler')
const { onRequest } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')
const https = require('https')

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

/**
 * Función encargada de consultar la cotización del dólar en vivo (Mercado Binance P2P / BCB)
 * y actualizar el Singleton en Firestore
 */
async function ejecutarSondeoTipoCambio() {
  console.log('[Sondeo Dólar] Iniciando consulta de cotización Binance P2P/Mercado Bolivia...')

  const docRef = db.collection('configuracion').doc('tipoCambio')
  const snap = await docRef.get()
  const estadoActual = snap.exists ? snap.data() : null

  // Si está en modo manual fijado por el administrador, no sobrescribir automáticamente
  if (estadoActual?.esManual) {
    console.log('[Sondeo Dólar] Omisión: El tipo de cambio está fijado en modo MANUAL por el Administrador.')
    return { status: 'skipped_manual', precioActual: estadoActual.precioActual }
  }

  let nuevoPrecio = estadoActual?.precioActual || 11.30
  let fuenteValida = 'Binance P2P (Mercado Real)'

  try {
    const dataApi = await obtenerPrecioDesdeApiExterna()
    if (dataApi && dataApi.valor > 5 && dataApi.valor < 50) {
      nuevoPrecio = dataApi.valor
      fuenteValida = dataApi.fuente
    }
  } catch (err) {
    console.warn('[Sondeo Dólar] Error al consultar APIs externas, manteniendo valor:', err.message)
  }

  const precioPrevio = estadoActual?.precioActual || nuevoPrecio
  const difAbs = parseFloat((nuevoPrecio - precioPrevio).toFixed(2))
  const difPct = precioPrevio > 0 ? parseFloat(((difAbs / precioPrevio) * 100).toFixed(2)) : 0
  const tendencia = difAbs > 0 ? 'UP' : difAbs < 0 ? 'DOWN' : 'STABLE'

  const nuevoEstado = {
    precioActual: nuevoPrecio,
    precioAnterior: precioPrevio,
    variacionAbsoluta: difAbs,
    variacionPorcentual: difPct,
    tendencia,
    ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
    fuente: fuenteValida,
    esManual: false,
  }

  await docRef.set(nuevoEstado, { merge: true })

  // Registrar en el histórico inmutable si hubo variación
  if (difAbs !== 0 || !estadoActual) {
    await db.collection('historico_cotizaciones').add({
      precio: nuevoPrecio,
      variacionAbsoluta: difAbs,
      variacionPorcentual: difPct,
      tendencia,
      fecha: admin.firestore.FieldValue.serverTimestamp(),
      fuente: fuenteValida,
    })
  }

  console.log(`[Sondeo Dólar] Éxito: Nuevo precio ${nuevoPrecio} Bs (${fuenteValida})`)
  return nuevoEstado
}

/**
 * Cadena de redundancia para obtener la cotización del dólar en Bolivia
 */
function obtenerPrecioDesdeApiExterna() {
  return new Promise((resolve) => {
    // 1. Intentar Binance P2P via bo.dolarapi.com/v1/dolares/binance
    hacerPeticionHttp('https://bo.dolarapi.com/v1/dolares/binance')
      .then((data) => {
        if (data && (data.venta || data.compra)) {
          const val = parseFloat(data.venta || data.compra)
          if (val > 5 && val < 50) {
            return resolve({ valor: val, fuente: 'Binance P2P (Mercado Real)' })
          }
        }
        // 2. Intentar bo.dolarapi.com/v1/dolares
        return hacerPeticionHttp('https://bo.dolarapi.com/v1/dolares')
      })
      .then((dataArray) => {
        if (Array.isArray(dataArray)) {
          const binanceObj = dataArray.find((i) => i.casa === 'binance')
          if (binanceObj && binanceObj.venta) {
            return resolve({ valor: parseFloat(binanceObj.venta), fuente: 'Binance P2P Bolivia' })
          }
          const oficialObj = dataArray.find((i) => i.casa === 'oficial')
          if (oficialObj && oficialObj.venta) {
            return resolve({ valor: parseFloat(oficialObj.venta), fuente: 'Oficial BCB' })
          }
        }
        // 3. Fallback a CUCU BCB
        return hacerPeticionHttp('https://apibcb.cucu.bo/api/v1/tc/oficial')
      })
      .then((dataCucu) => {
        if (dataCucu && dataCucu.tc_oficial && dataCucu.tc_oficial.valor) {
          return resolve({ valor: parseFloat(dataCucu.tc_oficial.valor), fuente: 'Oficial BCB' })
        }
        resolve(null)
      })
      .catch(() => resolve(null))
  })
}

function hacerPeticionHttp(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 6000 }, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch (e) {
          resolve(null)
        }
      })
    })

    req.on('error', () => resolve(null))
    req.on('timeout', () => {
      req.destroy()
      resolve(null)
    })
  })
}

/**
 * Cloud Function programada que se ejecuta cada 15 minutos
 */
exports.sondeoTipoCambioScheduler = onSchedule('every 15 minutes', async (event) => {
  await ejecutarSondeoTipoCambio()
})

/**
 * Endpoint HTTP manual para forzar la actualización o testear desde la web
 */
exports.sondeoTipoCambioManualApi = onRequest(async (req, res) => {
  try {
    const resultado = await ejecutarSondeoTipoCambio()
    res.status(200).json({ success: true, data: resultado })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})
