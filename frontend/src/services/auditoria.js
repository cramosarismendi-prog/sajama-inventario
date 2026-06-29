import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot, getDocs, where } from 'firebase/firestore'
import { db } from './firebase'

const COL = 'auditoria'

/**
 * Registra una acción en el log de auditoría.
 * Se llama desde cualquier módulo cuando hay una modificación.
 */
export const registrarAccion = async ({ usuario, rol, modulo, accion, detalle, datosAntes = null, datosDespues = null }) => {
  try {
    await addDoc(collection(db, COL), {
      usuario,
      rol,
      modulo,
      accion,       // 'CREAR' | 'EDITAR' | 'ELIMINAR' | 'APROBAR' | 'RECHAZAR' | 'LOGIN'
      detalle,      // Descripción legible: "Editó ítem [Correa 8PK1068]"
      datosAntes,   // Snapshot anterior (para ediciones)
      datosDespues, // Snapshot nuevo
      fecha: serverTimestamp(),
      ip: null,     // Se puede agregar con una Cloud Function en producción
    })
  } catch (e) {
    console.warn('Error registrando auditoría:', e.message)
    // No interrumpir el flujo principal si falla el log
  }
}

export const suscribirAuditoria = (callback, limitN = 200) => {
  const q = query(collection(db, COL), orderBy('fecha', 'desc'), limit(limitN))
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}

export const getAuditoriaPorUsuario = async (nombreUsuario) => {
  const snap = await getDocs(query(collection(db, COL),
    where('usuario', '==', nombreUsuario), orderBy('fecha', 'desc'), limit(100)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getAuditoriaPorModulo = async (modulo) => {
  const snap = await getDocs(query(collection(db, COL),
    where('modulo', '==', modulo), orderBy('fecha', 'desc'), limit(100)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
