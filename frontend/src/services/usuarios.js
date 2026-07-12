import {
  collection, doc, getDocs, setDoc, updateDoc,
  serverTimestamp, onSnapshot, query, orderBy
} from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth, db } from './firebase'

export const ROLES = [
  { value: 'administrador',  label: 'Administrador' },
  { value: 'gerencia',       label: 'Gerencia' },
  { value: 'almacenero',     label: 'Almacenero' },
  { value: 'ventas',         label: 'Ventas' },
  { value: 'taller',         label: 'Taller Mecánico' },
  { value: 'personalChino',  label: 'Personal Chino' },
  { value: 'contabilidad',   label: 'Contabilidad' },
]

export const crearUsuario = async (email, password, datos) => {
  // 1. Crear en Firebase Authentication
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  const uid  = cred.user.uid

  // 2. Guardar en Firestore con setDoc (garantiza que se usa el UID correcto)
  await setDoc(doc(db, 'usuarios', uid), {
    ...datos,
    email,
    uid,
    creadoEn: serverTimestamp(),
    activo: true,
  })

  return uid
}

export const getUsuarios = async () => {
  const snap = await getDocs(query(collection(db, 'usuarios'), orderBy('nombre')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const actualizarUsuario = async (uid, datos) => {
  await updateDoc(doc(db, 'usuarios', uid), {
    ...datos,
    actualizadoEn: serverTimestamp()
  })
}

export const suscribirUsuarios = (callback) => {
  const q = query(collection(db, 'usuarios'), orderBy('nombre'))
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}
