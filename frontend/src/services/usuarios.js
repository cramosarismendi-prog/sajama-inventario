import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
  serverTimestamp, onSnapshot, query, orderBy
} from 'firebase/firestore'
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth'
import { initializeApp, getApps } from 'firebase/app'
import { db } from './firebase'

export const ROLES = [
  { value: 'administrador',  label: 'Administrador',    labelZh: '管理员' },
  { value: 'gerencia',       label: 'Gerencia',         labelZh: '管理层' },
  { value: 'almacenero',     label: 'Almacenero',       labelZh: '仓库员' },
  { value: 'ventas',         label: 'Ventas',           labelZh: '销售' },
  { value: 'taller',         label: 'Taller Mecánico',  labelZh: '维修车间' },
  { value: 'personalChino',  label: 'Personal Chino',   labelZh: '中国员工' },
  { value: 'contabilidad',   label: 'Contabilidad',     labelZh: '会计' },
  { value: 'aduanas',        label: 'Aduanas',          labelZh: '海关员' },
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