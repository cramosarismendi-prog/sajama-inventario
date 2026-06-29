import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
  serverTimestamp, onSnapshot, query, orderBy
} from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth, db } from './firebase'

const COL = 'usuarios'

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
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await setDoc(doc(db, COL, cred.user.uid), {
    ...datos,
    email,
    creadoEn: serverTimestamp(),
    activo: true
  })
  return cred.user.uid
}

export const getUsuarios = async () => {
  const snap = await getDocs(query(collection(db, COL), orderBy('nombre')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const actualizarUsuario = async (uid, datos) => {
  await updateDoc(doc(db, COL, uid), { ...datos, actualizadoEn: serverTimestamp() })
}

export const suscribirUsuarios = (callback) => {
  const q = query(collection(db, COL), orderBy('nombre'))
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}