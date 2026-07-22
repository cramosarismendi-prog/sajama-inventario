import { useState } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Modal } from './Modal'
import toast from 'react-hot-toast'

export function ChangePasswordModal({ open, onClose }) {
  const { cambiarPassword } = useAuth()
  const [actual,   setActual]   = useState('')
  const [nueva,    setNueva]    = useState('')
  const [confirmar,setConfirmar]= useState('')
  const [verActual,   setVerActual]   = useState(false)
  const [verNueva,    setVerNueva]    = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const limpiarYCerrar = () => {
    setActual(''); setNueva(''); setConfirmar(''); setError('')
    onClose()
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!actual || !nueva || !confirmar) {
      setError('Completa todos los campos'); return
    }
    if (nueva.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres'); return
    }
    if (nueva !== confirmar) {
      setError('Las contraseñas nuevas no coinciden'); return
    }
    if (nueva === actual) {
      setError('La nueva contraseña debe ser diferente a la actual'); return
    }

    setGuardando(true)
    try {
      await cambiarPassword(actual, nueva)
      toast.success('Contraseña actualizada correctamente')
      limpiarYCerrar()
    } catch (e) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setError('La contraseña actual es incorrecta')
      } else if (e.code === 'auth/too-many-requests') {
        setError('Demasiados intentos. Intenta de nuevo más tarde')
      } else {
        setError('Error: ' + e.message)
      }
    }
    setGuardando(false)
  }

  return (
    <Modal open={open} onClose={limpiarYCerrar} title="Cambiar mi contraseña" size="sm">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="bg-blue-50 rounded-lg p-3 text-xs text-primary flex items-start gap-2">
          <KeyRound size={14} className="shrink-0 mt-0.5"/>
          <span>Este cambio solo afecta a tu propia cuenta. Necesitas confirmar tu contraseña actual.</span>
        </div>

        <div>
          <label className="label">Contraseña actual *</label>
          <div className="relative">
            <input className="input pr-10" type={verActual ? 'text' : 'password'}
              value={actual} onChange={e => setActual(e.target.value)}
              placeholder="Tu contraseña actual" autoComplete="current-password" />
            <button type="button" onClick={() => setVerActual(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {verActual ? <EyeOff size={15}/> : <Eye size={15}/>}
            </button>
          </div>
        </div>

        <div>
          <label className="label">Nueva contraseña *</label>
          <div className="relative">
            <input className="input pr-10" type={verNueva ? 'text' : 'password'}
              value={nueva} onChange={e => setNueva(e.target.value)}
              placeholder="Mín. 6 caracteres" autoComplete="new-password" />
            <button type="button" onClick={() => setVerNueva(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {verNueva ? <EyeOff size={15}/> : <Eye size={15}/>}
            </button>
          </div>
        </div>

        <div>
          <label className="label">Confirmar nueva contraseña *</label>
          <input className="input" type={verNueva ? 'text' : 'password'}
            value={confirmar} onChange={e => setConfirmar(e.target.value)}
            placeholder="Repite la nueva contraseña" autoComplete="new-password" />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
          <button type="button" onClick={limpiarYCerrar} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={guardando} className="btn-primary">
            {guardando ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </Modal>
  )
}