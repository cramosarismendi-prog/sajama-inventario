import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../services/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [perfil,  setPerfil]  = useState(null)
  const [loading, setLoading] = useState(true)

  const cargarPerfil = async (uid) => {
    // Retry hasta 5 veces con espera progresiva
    for (let i = 0; i < 5; i++) {
      try {
        const snap = await getDoc(doc(db, 'usuarios', uid))
        if (snap.exists()) {
          setPerfil(snap.data())
          return snap.data()
        }
      } catch (e) {
        console.warn(`Intento ${i + 1} fallido al cargar perfil:`, e.message)
      }
      await new Promise(r => setTimeout(r, 500 * (i + 1)))
    }
    console.error('No se pudo cargar el perfil del usuario')
    setPerfil(null)
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
    return signOut(auth)
  }

  const tienePermiso = (modulo) => {
    if (!perfil) return false
    if (perfil.rol === 'administrador') return true
    const permisos = {
      gerencia:      ['inventario','salidas','consultas','reportes'],
      almacenero:    ['inventario','ingresos','salidas','consultas','ordenSalida','ordenEntrada','lista'],
      ventas:        ['consultas','salidas','reportes'],
      taller:        ['consultas','salidas'],
      personalChino: ['consultas','reportes'],
      contabilidad:  ['consultas','reportes'],
    }
    return (permisos[perfil.rol] || []).includes(modulo)
  }

  return (
    <AuthContext.Provider value={{ user, perfil, loading, login, logout, tienePermiso }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
