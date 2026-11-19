import { useState } from 'react'
import { Modal } from './Modal'
import { verificarCodigoTOTP } from '../../utils/totp'
import { useAuth } from '../../context/AuthContext'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { ShieldCheck, Key, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export function MfaChallengeModal({ open, onClose }) {
  const { user, perfil, recargarPerfil, completarMfa, logout } = useAuth()
  const [codigo, setCodigo] = useState('')
  const [modoBackup, setModoBackup] = useState(false)
  const [codigoBackup, setCodigoBackup] = useState('')
  const [verificando, setVerificando] = useState(false)

  const handleValidarTotp = async (e) => {
    e.preventDefault()
    if (!perfil?.mfaSecret) {
      toast.error('Error de configuración 2FA en la cuenta.')
      return
    }

    if (codigo.trim().length !== 6) {
      toast.error('El código debe ser de 6 dígitos')
      return
    }

    setVerificando(true)
    try {
      const esValido = verificarCodigoTOTP(perfil.mfaSecret, codigo.trim())
      if (esValido) {
        completarMfa()
        toast.success('Acceso verificado con 2FA')
        onClose?.()
      } else {
        toast.error('Código incorrecto o expirado. Revisa tu aplicación autenticadora.')
      }
    } finally {
      setVerificando(false)
    }
  }

  const handleValidarBackupCode = async (e) => {
    e.preventDefault()
    const codeLimpio = codigoBackup.trim().toUpperCase()
    if (!codeLimpio) {
      toast.error('Ingresa un código de respaldo válido')
      return
    }

    const codigosExistentes = perfil?.mfaBackupCodes || []
    if (!codigosExistentes.includes(codeLimpio)) {
      toast.error('Código de respaldo no válido o ya fue utilizado')
      return
    }

    setVerificando(true)
    try {
      // Remover el código utilizado para que sea de UN SOLO USO
      const nuevosCodigos = codigosExistentes.filter(c => c !== codeLimpio)
      const docRef = doc(db, 'usuarios', user.uid)
      await updateDoc(docRef, {
        mfaBackupCodes: nuevosCodigos
      })
      await recargarPerfil()

      completarMfa()
      toast.success('Acceso verificado mediante Código de Respaldo')
      onClose?.()
    } catch (err) {
      toast.error('Error al verificar código de respaldo: ' + err.message)
    } finally {
      setVerificando(false)
    }
  }

  return (
    <Modal open={open} onClose={() => {}} title="Verificación de Seguridad 2FA" size="sm" closeOnBackdrop={false} closeOnEsc={false}>
      <div className="space-y-5">
        <div className="bg-primary/5 border border-primary/20 text-primary p-3.5 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-primary">Autenticación de 2 Factores</h4>
            <p className="text-xs text-gray-600">Usuario: <strong>{perfil?.nombre || user?.email}</strong></p>
          </div>
        </div>

        {!modoBackup ? (
          <form onSubmit={handleValidarTotp} className="space-y-4">
            <div>
              <label className="label text-center block mb-2">Ingresa el código de 6 dígitos de tu App móvil</label>
              <input
                type="text"
                maxLength={6}
                autoFocus
                required
                className="input text-center text-3xl font-mono tracking-[0.4em] font-bold py-3 text-primary border-2 border-primary/30 focus:border-primary"
                placeholder="000000"
                value={codigo}
                onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <button type="submit" disabled={verificando || codigo.length !== 6} className="btn-primary w-full justify-center py-2.5">
              {verificando ? <><RefreshCw size={16} className="animate-spin inline mr-1" /> Verificando...</> : <>Verificar e Ingresar <ArrowRight size={16} className="ml-1" /></>}
            </button>

            <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs">
              <button type="button" onClick={() => setModoBackup(true)} className="text-primary hover:underline font-medium flex items-center gap-1">
                <Key size={13} /> ¿Perdiste tu teléfono? Usar código de respaldo
              </button>
              <button type="button" onClick={logout} className="text-red-500 hover:underline">
                Cerrar sesión
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleValidarBackupCode} className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900 text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 text-amber-600 mt-0.5" />
              <p>Ingresa uno de tus 8 Códigos de Respaldo de uso único (ej: <code>8F3A-9K2L</code>).</p>
            </div>

            <div>
              <label className="label text-center block mb-1">Código de Respaldo (8 caracteres)</label>
              <input
                type="text"
                autoFocus
                required
                className="input text-center text-xl font-mono uppercase tracking-widest font-bold py-2.5 text-gray-800"
                placeholder="XXXX-XXXX"
                value={codigoBackup}
                onChange={e => setCodigoBackup(e.target.value)}
              />
            </div>

            <button type="submit" disabled={verificando || !codigoBackup.trim()} className="btn-primary w-full justify-center py-2.5">
              {verificando ? 'Validando...' : 'Ingresar con Código de Respaldo'}
            </button>

            <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs">
              <button type="button" onClick={() => setModoBackup(false)} className="text-primary hover:underline font-medium">
                ← Volver a código TOTP de 6 dígitos
              </button>
              <button type="button" onClick={logout} className="text-red-500 hover:underline">
                Cerrar sesión
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}

