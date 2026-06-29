import {
  collection, addDoc, getDocs, doc, updateDoc, query,
  orderBy, serverTimestamp, increment, onSnapshot, writeBatch
} from 'firebase/firestore'
import { db } from './firebase'
import { registrarAccion } from './auditoria'

const COL = 'salidas'

export const solicitarSalida = async (data, usuario, rol) => {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    estado: 'pendiente',
    solicitante: usuario,
    creadoEn: serverTimestamp(),
    autorizadoPor: null,
    autorizadoEn: null
  })
  await registrarAccion({
    usuario, rol, modulo: 'Salidas', accion: 'CREAR',
    detalle: `Solicitó salida de ${data.cantidad} x [${data.itemCodigo}] ${data.itemDescripcion} → ${data.destino}`,
    datosDespues: data
  })
  return ref
}

export const aprobarSalida = async (salidaId, itemId, cantidad, itemDesc, usuario, rol) => {
  const batch = writeBatch(db)
  batch.update(doc(db, COL, salidaId), {
    estado: 'aprobado',
    autorizadoPor: usuario,
    autorizadoEn: serverTimestamp()
  })
  batch.update(doc(db, 'inventario', itemId), {
    stock: increment(-Number(cantidad)),
    totalSalidas: increment(Number(cantidad)),
    actualizadoEn: serverTimestamp()
  })
  await batch.commit()
  await registrarAccion({
    usuario, rol, modulo: 'Salidas', accion: 'APROBAR',
    detalle: `Aprobó salida de ${cantidad} x ${itemDesc} (ID: ${salidaId})`
  })
}

export const rechazarSalida = async (salidaId, motivo, itemDesc, usuario, rol) => {
  await updateDoc(doc(db, COL, salidaId), {
    estado: 'rechazado',
    motivoRechazo: motivo,
    autorizadoPor: usuario,
    autorizadoEn: serverTimestamp()
  })
  await registrarAccion({
    usuario, rol, modulo: 'Salidas', accion: 'RECHAZAR',
    detalle: `Rechazó salida de ${itemDesc} — Motivo: ${motivo}`
  })
}

export const getSalidas = async () => {
  const snap = await getDocs(query(collection(db, COL), orderBy('creadoEn', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const suscribirSalidas = (callback) => {
  const q = query(collection(db, COL), orderBy('creadoEn', 'desc'))
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}
