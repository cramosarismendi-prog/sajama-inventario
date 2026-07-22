import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../services/firebase'
import { getPermisosEfectivos, puedeDo } from '../services/permisos'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [perfil,  setPerfil]  = useState(null)
  const [permisos,setPermisos]= useState({})
  const [loading, setLoading] = useState(true)

  const cargarPerfil = async (uid) => {
    for (let i = 0; i < 5; i++) {
      try {
        const snap = await getDoc(doc(db, 'usuarios', uid))
        if (snap.exists()) {
          const data = snap.data()
          setPerfil(data)
          setPermisos(getPermisosEfectivos(data))
          return data
        }
      } catch (e) {
        console.warn(`Intento ${i + 1} fallido:`, e.message)
      }
      await new Promise(r => setTimeout(r, 500 * (i + 1)))
    }
    setPerfil(null)
    setPermisos({})
    return null
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        await cargarPerfil(firebaseUser.uid)
      } else {
        setUser(null)
        setPerfil(null)
        setPermisos({})
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const login = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    await cargarPerfil(cred.user.uid)
    return cred
  }

  const logout = () => {
    setPerfil(null)
    setPermisos({})
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

  // Cambia la contraseña del usuario ACTUALMENTE logueado.
  // Firebase exige reautenticar con la contraseña actual antes de
  // permitir el cambio — esto es lo que garantiza que nadie pueda
  // usar esta función para tocar la cuenta de otra persona: solo
  // funciona sobre auth.currentUser, y solo si se conoce la
  // contraseña actual de ESA misma cuenta.
  const cambiarPassword = async (passwordActual, passwordNueva) => {
    if (!auth.currentUser) throw new Error('No hay sesión activa')
    const credential = EmailAuthProvider.credential(auth.currentUser.email, passwordActual)
    await reauthenticateWithCredential(auth.currentUser, credential)
    await updatePassword(auth.currentUser, passwordNueva)
  }

  return (
    <AuthContext.Provider value={{ user, perfil, permisos, loading, login, logout, tienePermiso, puede, cambiarPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)