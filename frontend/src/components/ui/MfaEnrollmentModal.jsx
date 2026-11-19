import { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { QRCodeSVG } from 'qrcode.react'
import { generarSecretoMFA, generarURIOTP, verificarCodigoTOTP, generarCodigosRespaldo } from '../../utils/totp'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useAuth } from '../../context/AuthContext'
import { ShieldCheck, Copy, Check, QrCode, Key, AlertTriangle, Printer } from 'lucide-react'
import toast from 'react-hot-toast'

export function MfaEnrollmentModal({ open, onClose, esObligatorio = false }) {
  const { user, perfil, recargarPerfil, completarMfa, logout } = useAuth()
  const [paso, setPaso] = useState(1) // 1: QR & Secret, 2: Confirmar Código, 3: Códigos de Respaldo
  const [secreto, setSecreto] = useState('')
  const [otpUri, setOtpUri] = useState('')
  const [codigoIngresado, setCodigoIngresado] = useState('')
  const [codigosRespaldo, setCodigosRespaldo] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [copiadoCodigos, setCopiadoCodigos] = useState(false)

  useEffect(() => {
    if (open) {
      setPaso(1)
      setCodigoIngresado('')
      const sec = generarSecretoMFA()
      setSecreto(sec)
      const uri = generarURIOTP({ email: user?.email || perfil?.email, secret: sec })
      setOtpUri(uri)
    }
  }, [open, user, perfil])

  const copiarAlPortapapeles = (texto, esCodigos = false) => {
    navigator.clipboard.writeText(texto)
    if (esCodigos) {
      setCopiadoCodigos(true)
      setTimeout(() => setCopiadoCodigos(false), 2000)
    } else {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    }
    toast.success('Copiado al portapapeles')
  }

  const handleValidarYActivar = async (e) => {
    e.preventDefault()
    if (codigoIngresado.trim().length !== 6) {
      toast.error('El código debe tener 6 dígitos numericos')
      return
    }

    const esValido = verificarCodigoTOTP(secreto, codigoIngresado.trim())
    if (!esValido) {
      toast.error('Código incorrecto o expirado. Revisa la app Google Authenticator.')
      return
    }

    setGuardando(true)
    try {
      const backups = generarCodigosRespaldo(8)
      setCodigosRespaldo(backups)

      const docRef = doc(db, 'usuarios', user.uid)
      await updateDoc(docRef, {
        mfaHabilitado: true,
        mfaSecret: secreto,
        mfaBackupCodes: backups,
        mfaEnroladoEn: new Date().toISOString()
      })

      await recargarPerfil()
      completarMfa()
      setPaso(3)
      toast.success('¡Autenticación de 2 Factores (2FA) activada!')
    } catch (err) {
      toast.error('Error al activar 2FA: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  const handleImprimirCodigos = () => {
    const vent = window.open('', '_blank', 'width=1100,height=750')
    vent.document.write(`
      <html>
        <head>
          <title>SAJAMA 4x4 — Códigos de Respaldo 2FA</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            h2 { color: #1D7044; margin-bottom: 5px; }
            p { font-size: 14px; color: #666; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 30px 0; }
            .code { font-family: monospace; font-size: 18px; font-weight: bold; background: #f4f4f4; padding: 10px; border-radius: 6px; text-align: center; border: 1fr solid #ddd; }
            .footer { margin-top: 40px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 15px; }
            @page { size: landscape; size: A4 landscape; margin: 8mm; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h2>SAJAMA 4x4 — Códigos de Respaldo (2FA)</h2>
          <p>Usuario: <strong>${user?.email || perfil?.nombre}</strong></p>
          <p>Guarda estos códigos en un lugar seguro. Cada código solo se puede usar una vez si pierdes tu celular.</p>
          <div class="grid">
            ${codigosRespaldo.map(c => `<div class="code">${c}</div>`).join('')}
          </div>
          <div class="footer">Generado el ${new Date().toLocaleString('es-BO')} — SAJAMA S.R.L.</div>
        </body>
      </html>
    `)
    vent.document.close()
    vent.focus()
    vent.print()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={esObligatorio ? "🔒 Configuración Obligatoria de 2FA" : "Activar Autenticación de Doble Factor (2FA)"}
      size="md"
      showCloseButton={!esObligatorio}
    >
      {paso === 1 && (
        <div className="space-y-5 text-gray-700">
          <div className="flex items-center gap-3 bg-green-50 text-green-800 p-3.5 rounded-xl border border-green-200 text-sm">
            <ShieldCheck size={24} className="shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Paso 1: Escanear con tu aplicación autenticadora</p>
              <p className="text-xs text-green-700">Abre <strong>Google Authenticator</strong> o <strong>Authy</strong> en tu celular y escanea este código QR.</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-2xl border border-gray-200">
            {otpUri && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <QRCodeSVG value={otpUri} size={180} level="M" includeMargin={true} />
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2 font-medium">SAJAMA 4x4 — TOTP Standard</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              ¿No puedes escanear el QR? Ingresa la clave manualmente:
            </label>
            <div className="flex items-center gap-2">
              <div className="font-mono text-sm font-bold bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 flex-1 text-center tracking-widest text-primary">
                {secreto}
              </div>
              <button
                type="button"
                onClick={() => copiarAlPortapapeles(secreto)}
                className="btn-secondary text-xs flex items-center gap-1 py-2"
              >
                {copiado ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 flex justify-between items-center gap-2">
            <button type="button" onClick={logout} className="text-xs text-red-500 hover:underline">
              Cerrar sesión
            </button>
            <div className="flex gap-2">
              {!esObligatorio && <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>}
              <button type="button" onClick={() => setPaso(2)} className="btn-primary">
                Siguiente: Verificar código →
              </button>
            </div>
          </div>
        </div>
      )}

      {paso === 2 && (
        <form onSubmit={handleValidarYActivar} className="space-y-5">
          <div className="bg-primary/5 text-primary p-3.5 rounded-xl border border-primary/20 text-sm flex items-center gap-3">
            <QrCode size={24} className="shrink-0" />
            <div>
              <p className="font-semibold">Paso 2: Confirmar Código de 6 dígitos</p>
              <p className="text-xs text-gray-600">Ingresa el código que aparece en tu aplicación móvil para confirmar la sincronización.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="label text-center block">Código de Verificación (6 dígitos)</label>
            <input
              type="text"
              maxLength={6}
              autoFocus
              required
              className="input text-center text-3xl font-mono tracking-[0.5em] font-bold py-3 text-primary border-2 border-primary/30 focus:border-primary"
              placeholder="000000"
              value={codigoIngresado}
              onChange={e => setCodigoIngresado(e.target.value.replace(/\D/g, ''))}
            />
          </div>

          <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
            <button type="button" onClick={() => setPaso(1)} className="btn-secondary text-xs">
              ← Regresar al QR
            </button>
            <div className="flex gap-2">
              {!esObligatorio && <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>}
              <button type="submit" disabled={guardando || codigoIngresado.length !== 6} className="btn-primary">
                {guardando ? 'Activando 2FA...' : 'Activar 2FA'}
              </button>
            </div>
          </div>
        </form>
      )}

      {paso === 3 && (
        <div className="space-y-5">
          <div className="bg-green-50 border border-green-200 text-green-900 p-4 rounded-2xl flex items-start gap-3">
            <ShieldCheck size={28} className="shrink-0 text-green-600 mt-0.5" />
            <div>
              <p className="font-bold text-base">¡2FA Activado Correctamente!</p>
              <p className="text-xs text-green-700 mt-0.5">
                Tu cuenta ahora está protegida. A continuación se presentan tus <strong>Códigos de Respaldo de uso único</strong>.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
            <p>
              <strong>IMPORTANTE:</strong> Si pierdes o rompes tu teléfono móvil, estos códigos te permitirán acceder a la cuenta. Guárdalos en un lugar seguro. Cada código solo se puede usar una vez.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 bg-gray-50 p-4 rounded-xl border border-gray-200">
            {codigosRespaldo.map((code, idx) => (
              <div key={idx} className="font-mono text-sm font-bold bg-white py-2 px-3 rounded-lg border border-gray-200 text-center tracking-wider text-gray-800 shadow-xs">
                {code}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 justify-between pt-3 border-t border-gray-100">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copiarAlPortapapeles(codigosRespaldo.join('\n'), true)}
                className="btn-secondary text-xs flex items-center gap-1"
              >
                {copiadoCodigos ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                {copiadoCodigos ? 'Copiados' : 'Copiar Todos'}
              </button>
              <button
                type="button"
                onClick={handleImprimirCodigos}
                className="btn-secondary text-xs flex items-center gap-1"
              >
                <Printer size={14} /> Imprimir / PDF
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-primary"
            >
              Entendido y Finalizar
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

