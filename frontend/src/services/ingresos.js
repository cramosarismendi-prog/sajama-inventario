import {
  collection, addDoc, getDocs, query, orderBy,
  serverTimestamp, doc, increment, onSnapshot, writeBatch
} from 'firebase/firestore'
import { db } from './firebase'
import { registrarAccion } from './auditoria'

const COL = 'ingresos'

export const registrarIngreso = async (data, usuario, rol) => {
  const batch = writeBatch(db)
  const ingresoRef = doc(collection(db, COL))
  batch.set(ingresoRef, {
    ...data,
    creadoEn: serverTimestamp(),
    creadoPor: usuario,
    estado: 'confirmado'
  })
  const itemRef = doc(db, 'inventario', data.itemId)
  batch.update(itemRef, {
    stock: increment(Number(data.cantidad)),
    actualizadoEn: serverTimestamp()
  })
  await batch.commit()
  await registrarAccion({
    usuario, rol, modulo: 'Ingresos', accion: 'CREAR',
    detalle: `Registró ingreso de ${data.cantidad} x [${data.itemCodigo}] ${data.itemDescripcion} (${data.fuente})`,
    datosDespues: data
  })
  return ingresoRef.id
}

export const getIngresos = async () => {
  const snap = await getDocs(query(collection(db, COL), orderBy('creadoEn', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const suscribirIngresos = (callback) => {
  const q = query(collection(db, COL), orderBy('creadoEn', 'desc'))
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}
