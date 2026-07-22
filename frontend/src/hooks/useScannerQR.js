import { useState, useEffect, useRef, useCallback } from 'react'

export function useScannerQR(onQRLeido) {
  const [escuchando, setEscuchando] = useState(false)
  const bufferRef = useRef('')
  const timerRef  = useRef(null)

  const procesarBuffer = useCallback((texto) => {
    if (!texto || texto.trim().length < 3) return
    bufferRef.current = ''
    onQRLeido(texto.trim())
  }, [onQRLeido])

  useEffect(() => {
    if (!escuchando) return
    const handleKey = (e) => {
      // Evita que las teclas del lector se escriban directamente en
      // cualquier input que tenga el foco — solo deben alimentar el
      // buffer interno del scanner, nunca "filtrarse" a un campo visible.
      e.preventDefault()

      if (e.key === 'Enter') {
        clearTimeout(timerRef.current)
        procesarBuffer(bufferRef.current)
        return
      }
      if (e.key.length === 1) bufferRef.current += e.key
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => procesarBuffer(bufferRef.current), 350)
    }
    window.addEventListener('keydown', handleKey)
    return () => { window.removeEventListener('keydown', handleKey); clearTimeout(timerRef.current) }
  }, [escuchando, procesarBuffer])

  const activar = () => {
    // Quita el foco de cualquier input activo antes de empezar a
    // escuchar, para que el lector no le "escriba" directamente a un
    // campo visible mientras arma el buffer interno.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    bufferRef.current = ''
    setEscuchando(true)
  }
  const desactivar = () => { bufferRef.current = ''; setEscuchando(false) }

  return { escuchando, activar, desactivar }
}

// Formato QR SAJAMA: 11212087?RETEN 130 X 120 X 7?
// Primera parte = N° de Serie del producto (ej: 11212087)
// Segunda parte = Descripción en español (ej: RETEN 130 X 120 X 7)
// El código correlativo (1,2,3...) lo asigna el usuario manualmente
export function parsearQR(textoQR) {
  if (!textoQR || textoQR.trim().length < 2) return null
  const limpio = textoQR.trim()
  // Separar por ? o _ (el scanner convierte _ en ?)
  const partes = limpio.split(/[?_]/).map(p => p.replace(/[^\x20-\x7E]/g, '').trim()).filter(Boolean)
  if (partes.length === 0) return null

  // Primera parte: número de serie (puede ser numérico largo como 11212087)
  const serie = partes[0]

  // Resto: descripción en español
  const descripcion = partes.slice(1).join(' ').trim()

  return {
    serie,                                        // N° de serie del producto
    descripcion: descripcion || serie,            // Descripción en español
    raw: textoQR,
  }
}