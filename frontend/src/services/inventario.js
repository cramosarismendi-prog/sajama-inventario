import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp, increment, where
} from 'firebase/firestore'
import { db } from './firebase'
import { registrarAccion } from './auditoria'

const COL = 'inventario'

export const getItems = async (filtros = {}) => {
  let q = query(collection(db, COL), orderBy('codigo'))
  if (filtros.categoria) q = query(collection(db, COL), where('categoria', '==', filtros.categoria), orderBy('codigo'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getItem = async (id) => {
  const snap = await getDoc(doc(db, COL, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const crearItem = async (data, usuario, rol) => {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    stock: data.stockInicial || 0,
    totalSalidas: 0,
    creadoEn: serverTimestamp(),
    creadoPor: usuario,
    actualizadoEn: serverTimestamp()
  })
  await registrarAccion({
    usuario, rol, modulo: 'Inventario', accion: 'CREAR',
    detalle: `Creó ítem [${data.codigo}] ${data.descripcion}`,
    datosDespues: data
  })
  return ref
}

export const actualizarItem = async (id, data, usuario, rol, itemAnterior = null) => {
  await updateDoc(doc(db, COL, id), {
    ...data,
    actualizadoEn: serverTimestamp(),
    actualizadoPor: usuario
  })
  await registrarAccion({
    usuario, rol, modulo: 'Inventario', accion: 'EDITAR',
    detalle: `Editó ítem [${data.codigo}] ${data.descripcion}`,
    datosAntes: itemAnterior,
    datosDespues: data
  })
}

export const eliminarItem = async (id, item, usuario, rol) => {
  await deleteDoc(doc(db, COL, id))
  await registrarAccion({
    usuario, rol, modulo: 'Inventario', accion: 'ELIMINAR',
    detalle: `Eliminó ítem [${item?.codigo}] ${item?.descripcion}`,
    datosAntes: item
  })
}

export const suscribirInventario = (callback) => {
  const q = query(collection(db, COL), orderBy('codigo'))
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}
