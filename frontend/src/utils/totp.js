import * as OTPAuth from 'otpauth'

/**
 * Genera un secreto aleatorio Base32 para TOTP (20 bytes / 160 bits).
 */
export function generarSecretoMFA() {
  const secret = new OTPAuth.Secret({ size: 20 })
  return secret.base32
}

/**
 * Construye el string URI 'otpauth://totp/...' compatible con Google Authenticator y Authy.
 */
export function generarURIOTP({ email, secret }) {
  const totp = new OTPAuth.TOTP({
    issuer: 'SAJAMA 4x4',
    label: email || 'usuario@sajama.com',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret)
  })
  return totp.toString()
}

/**
 * Valida un código TOTP de 6 dígitos.
 * Permite una ventana de tolerancia de ±1 bloque (30 segundos antes/después) para desfasajes de reloj.
 */
export function verificarCodigoTOTP(secretBase32, token) {
  if (!secretBase32 || !token) return false
  const tokenLimpio = token.toString().trim()
  if (tokenLimpio.length !== 6 || isNaN(Number(tokenLimpio))) return false
  try {
    const totp = new OTPAuth.TOTP({
      issuer: 'SAJAMA 4x4',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secretBase32)
    })
    const delta = totp.validate({ token: tokenLimpio, window: 1 })
    return delta !== null
  } catch (e) {
    console.error('Error al validar TOTP:', e)
    return false
  }
}

/**
 * Genera N códigos de respaldo (Backup Codes) aleatorios con formato XXXX-XXXX.
 */
export function generarCodigosRespaldo(cantidad = 8) {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const codigos = []
  for (let i = 0; i < cantidad; i++) {
    let code = ''
    for (let j = 0; j < 8; j++) {
      if (j === 4) code += '-'
      code += caracteres.charAt(Math.floor(Math.random() * caracteres.length))
    }
    codigos.push(code)
  }
  return codigos
}
