import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword
} from 'firebase/auth'
import { doc, getDoc, updateDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../services/firebase'
import { getPermisosEfectivos } from '../services/permisos'

const AuthContext = createContext(null)

// Función auxiliar para determinar si la aplicación se ejecuta en entorno local
export const esEntornoLocal = () => {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return Boolean(
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    host === '0.0.0.0' ||
    Boolean(import.meta.env?.DEV)
  )
}

export function AuthProvider({ children }) {
  const [user,          setUser]          = useState(null)
  const [perfil,        setPerfil]        = useState(null)
  const [permisos,      setPermisos]      = useState({})
  const [loading,       setLoading]       = useState(true)
  const [mfaVerificado, setMfaVerificado] = useState(false)

  const TIEMPO_INACTIVIDAD_MS = 30 * 60 * 1000 // 30 minutos de inactividad

  const cargarPerfil = async (uid) => {
    for (let i = 0; i < 5; i++) {
      try {
        const snap = await getDoc(doc(db, 'usuarios', uid))
        if (snap.exists()) {
          const data = snap.data()
          setPerfil(data)
          setPermisos(getPermisosEfectivos(data))

          // Comprobar si ya se verificó el MFA en la sesión actual (solo en entorno local)
          const esLocal = esEntornoLocal()
          const sesionVerificada = sessionStorage.getItem('sajama_mfa_verified_' + uid) === 'true'
          if (!esLocal || !data.mfaHabilitado || sesionVerificada) {
            setMfaVerificado(true)
          } else {
            setMfaVerificado(false)
          }
          return data
        }
      } catch (e) {
        console.warn(`Intento ${i + 1} fallido:`, e.message)
      }
      await new Promise(r => setTimeout(r, 500 * (i + 1)))
    }
    setPerfil(null)
    setPermisos({})
    setMfaVerificado(false)
    return null
  }

  const recargarPerfil = async () => {
    if (user?.uid) {
      return await cargarPerfil(user.uid)
    }
  }

  const completarMfa = () => {
    if (user?.uid) {
      sessionStorage.setItem('sajama_mfa_verified_' + user.uid, 'true')
    }
    setMfaVerificado(true)
  }

  const resetearMfaUsuario = async (targetUid) => {
    const docRef = doc(db, 'usuarios', targetUid)
    await updateDoc(docRef, {
      mfaHabilitado: false,
      mfaSecret: null,
      mfaBackupCodes: [],
      mfaEnroladoEn: null
    })
    if (targetUid === user?.uid) {
      sessionStorage.removeItem('sajama_mfa_verified_' + targetUid)
      await recargarPerfil()
    }
  }

  const cerrarTodasLasSesiones = async () => {
    const docRef = doc(db, 'configuracion', 'seguridad')
    await setDoc(docRef, {
      cierreSesionesTimestamp: serverTimestamp(),
      actualizadoEn: serverTimestamp()
    }, { merge: true })
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        if (!sessionStorage.getItem('sajama_login_time_' + firebaseUser.uid)) {
          sessionStorage.setItem('sajama_login_time_' + firebaseUser.uid, Date.now().toString())
        }
        await cargarPerfil(firebaseUser.uid)
      } else {
        setUser(null)
        setPerfil(null)
        setPermisos({})
        setMfaVerificado(false)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  // Temporizador de Inactividad DESHABILITADO (La sesión se mantiene abierta indefinidamente)
  /*
  useEffect(() => {
    if (!user) return

    let timer = null

    const resetTimer = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        sessionStorage.setItem('sajama_logout_reason', 'inactividad')
        logout()
      }, TIEMPO_INACTIVIDAD_MS)
    }

    const eventos = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    eventos.forEach(evt => window.addEventListener(evt, resetTimer))
    resetTimer()

    return () => {
      if (timer) clearTimeout(timer)
      eventos.forEach(evt => window.removeEventListener(evt, resetTimer))
    }
  }, [user])
  */

  // Listener en tiempo real para cierre global de sesiones ordenado por el Super Admin
  useEffect(() => {
    if (!user) return

    const docRef = doc(db, 'configuracion', 'seguridad')
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        const cierreTs = data.cierreSesionesTimestamp?.toMillis ? data.cierreSesionesTimestamp.toMillis() : 0
        const userLoginTime = parseInt(sessionStorage.getItem('sajama_login_time_' + user.uid) || '0', 10)

        if (cierreTs > userLoginTime) {
          sessionStorage.setItem('sajama_logout_reason', 'cierre_global')
          logout()
        }
      }
    })

    return unsub
  }, [user])

  const login = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    sessionStorage.setItem('sajama_login_time_' + cred.user.uid, Date.now().toString())
    await cargarPerfil(cred.user.uid)
    return cred
  }

  const logout = () => {
    if (user?.uid) {
      sessionStorage.removeItem('sajama_mfa_verified_' + user.uid)
      sessionStorage.removeItem('sajama_login_time_' + user.uid)
    }
    setPerfil(null)
    setPermisos({})
    setMfaVerificado(false)
    return signOut(auth)
  }

  // Verifica acceso a un módulo (ver = puede entrar al módulo)
  const tienePermiso = (modulo) => {
    if (!perfil) return false
    return permisos[modulo]?.ver ?? false
  }

  // Verifica si puede hacer una acción específica
  const puede = (modulo, accion = 'ver') => {
    if (!perfil) return false
    return permisos[modulo]?.[accion] ?? false
  }

  const cambiarPassword = async (passwordActual, passwordNueva) => {
    if (!auth.currentUser) throw new Error('No hay sesión activa')
    const credential = EmailAuthProvider.credential(auth.currentUser.email, passwordActual)
    await reauthenticateWithCredential(auth.currentUser, credential)
    await updatePassword(auth.currentUser, passwordNueva)
  }

  // Super Administrador principal
  const esSuperAdmin = Boolean(
    user?.email?.toLowerCase() === 'admin@sajama.com' ||
    perfil?.rol === 'superadmin' ||
    perfil?.esSuperAdmin === true
  )

  // Determina si el usuario tiene permisos de Administrador de TI / Control de Roles
  const esAdminIT = Boolean(
    esSuperAdmin ||
    perfil?.rol === 'administrador' ||
    perfil?.esEncargadoIT === true
  )

  // Control de 2FA habilitado EXCLUSIVAMENTE para entorno local (localhost / 127.0.0.1 / DEV)
  const esLocal = esEntornoLocal()
  const mfaPendiente = Boolean(esLocal && user && perfil?.mfaHabilitado && !mfaVerificado)
  const mfaObligatorio = Boolean(esLocal && user && perfil && !perfil?.mfaHabilitado)

  return (
    <AuthContext.Provider value={{
      user, perfil, permisos, loading, login, logout,
      tienePermiso, puede, cambiarPassword,
      mfaVerificado, mfaPendiente, mfaObligatorio,
      completarMfa, recargarPerfil, resetearMfaUsuario, cerrarTodasLasSesiones,
      esSuperAdmin, esAdminIT
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)