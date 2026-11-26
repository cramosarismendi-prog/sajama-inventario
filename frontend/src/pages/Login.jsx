import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

import { registrarAccion } from '../services/auditoria'
import letreroSajama from '../assets/letrero-sajama.jpg'
import logoSajama from '../assets/logo-sajama.jpg'

export default function Login() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate   = useNavigate()
  const [form, setForm]       = useState({ email: '', password: '' })
  const [showPass, setShow]   = useState(false)
  const [loading,  setLoading] = useState(false)
  const [mensajeSesion, setMensajeSesion] = useState(null)

  useEffect(() => {
    const razon = sessionStorage.getItem('sajama_logout_reason')
    if (razon === 'inactividad') {
      setMensajeSesion('⏰ Su sesión se ha cerrado automáticamente por inactividad.')
      sessionStorage.removeItem('sajama_logout_reason')
    } else if (razon === 'cierre_global') {
      setMensajeSesion('🚨 El Administrador ha cerrado todas las sesiones activas para requerir la activación de 2FA.')
      sessionStorage.removeItem('sajama_logout_reason')
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form.email, form.password)
      await registrarAccion({
        usuario: form.email,
        rol: 'Usuario',
        modulo: 'Autenticación',
        accion: 'LOGIN',
        detalle: `Inicio de sesión exitoso en el sistema: ${form.email}`
      })
      navigate('/inventario')
    } catch (err) {
      toast.error('Credenciales incorrectas. Verifica tu email y contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#16241F] flex items-center justify-center px-5 py-6 sm:p-4">
      {/* Capa 1: Letrero Sajama 4x4 desenfocado, alineado centro-izquierda y escalado al 105% */}
      <img
        src={letreroSajama}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover object-left blur-[5px] scale-105 pointer-events-none select-none"
      />

      {/* Capa 2: Degradado direccional horizontal (#16241F: 25% izq -> 60% centro -> 85% der) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(22, 36, 31, 0.25) 0%, rgba(22, 36, 31, 0.60) 50%, rgba(22, 36, 31, 0.85) 100%)',
        }}
      />

      {/* Capa 3: Viñeta vertical inferior (#16241F: transparente arriba -> 85% abajo) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(22, 36, 31, 0) 0%, rgba(22, 36, 31, 0.20) 55%, rgba(22, 36, 31, 0.85) 100%)',
        }}
      />

      {/* Refuerzo de oscurecimiento (+10% adicional) exclusivo para pantallas angostas / celulares */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[#16241F]/15 sm:hidden pointer-events-none"
      />

      {/* Capa 4: Contenedor de Tarjeta y Pie de Página */}
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl shadow-[0_25px_60px_-12px_rgba(0,0,0,0.65)]">
          {/* Cabecera con efecto cristal oscuro (Glassmorphism) */}
          <div
            className="px-8 py-8 text-center rounded-t-2xl border-t border-x border-white/15 backdrop-blur-[12px]"
            style={{ backgroundColor: 'rgba(22, 36, 31, 0.72)' }}
          >
            <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-4 border-2 border-[#E4D825]/55 shadow-lg bg-[#FDE200]">
              <img src={logoSajama} alt="Sajama 4x4" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Sajama.SRL</h1>
            <p className="text-[#D6DDD9]/85 text-sm mt-1">{t('app.subtitle')}</p>
          </div>

          {/* Cuerpo del formulario en blanco puro */}
          <form onSubmit={handleSubmit} className="bg-white px-7 sm:px-8 py-8 space-y-5 rounded-b-2xl">
            {mensajeSesion && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-start gap-2.5">
                <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                <p>{mensajeSesion}</p>
              </div>
            )}
            <div>
              <label className="label text-gray-700">{t('auth.email')}</label>
              <input
                type="email"
                required
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#16241F] focus:ring-2 focus:ring-[#16241F]/25 transition"
                placeholder="usuario@sajama.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="label text-gray-700">{t('auth.password')}</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#16241F] focus:ring-2 focus:ring-[#16241F]/25 transition"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShow(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#16241F] transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-white bg-[#16241F] hover:bg-[#233831] active:bg-[#0f1a16] shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Ingresando...' : t('auth.login')}
            </button>
          </form>
        </div>

        {/* Pie de página en gris claro #D6DDD9 al 75% de opacidad */}
        <p className="text-center text-[#D6DDD9]/75 text-xs mt-5 tracking-wide">
          Sistema de Gestión de Inventario — v1.0
        </p>
      </div>
    </div>
  )
}
