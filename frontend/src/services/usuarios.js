import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
  serverTimestamp, onSnapshot, query, orderBy
} from 'firebase/firestore'
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth'
import { initializeApp, getApps } from 'firebase/app'
import { db } from './firebase'

export const ROLES = [
  { value: 'administrador',  label: 'Administrador' },
  { value: 'gerencia',       label: 'Gerencia' },
  { value: 'almacenero',     label: 'Almacenero' },
  { value: 'ventas',         label: 'Ventas' },
  { value: 'taller',         label: 'Taller Mecánico' },
  { value: 'personalChino',  label: 'Personal Chino' },
  { value: 'contabilidad',   label: 'Contabilidad' },
  { value: 'aduanas',        label: 'Aduanas' },
]

const firebaseConfig = {
  apiKey:            'AIzaSyCTTcyK-mHSQJQnHGmG-sOVl2IHYx00mXw',
  authDomain:        'sajama-inventario-b5b17.firebaseapp.com',
  projectId:         'sajama-inventario-b5b17',
  storageBucket:     'sajama-inventario-b5b17.firebasestorage.app',
  messagingSenderId: '838813749958',
  appId:             '1:838813749958:web:7a1fb73f890912c86d44ef',
}

const getSecondaryAuth = () => {
  const app = getApps().find(a => a.name === 'secondary')
    || initializeApp(firebaseConfig, 'secondary')
  return getAuth(app)
}

export const crearUsuario = async (email, password, datos) => {
  const secondaryAuth = getSecondaryAuth()
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
  const uid  = cred.user.uid
  await signOut(secondaryAuth)
  await setDoc(doc(db, 'usuarios', uid), {
    ...datos, email, uid,
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
    ...datos, actualizadoEn: serverTimestamp()
  })
}

// Elimina el documento de Firestore
// Nota: el usuario en Authentication queda inactivo pero no se elimina
// (eliminar de Auth requiere Admin SDK / Cloud Function)
export const eliminarUsuario = async (uid) => {
  await deleteDoc(doc(db, 'usuarios', uid))
}

export const suscribirUsuarios = (callback) => {
  const q = query(collection(db, 'usuarios'), orderBy('nombre'))
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}