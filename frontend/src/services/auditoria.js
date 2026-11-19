import {
  collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot,
  getDocs, where, writeBatch, doc, Timestamp
} from 'firebase/firestore'
import { ref, uploadString, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase'
import { format } from 'date-fns'

const COL = 'auditoria'
const COL_BACKUPS = 'backups_auditoria'

/**
 * Registra una acción en el log de auditoría.
 * Se llama desde cualquier módulo cuando hay una modificación.
 */
export const registrarAccion = async ({
  usuario, rol, modulo, accion, detalle, datosAntes = null, datosDespues = null, ...rest
}) => {
  try {
    await addDoc(collection(db, COL), {
      usuario: usuario || 'Sistema',
      rol: rol || 'Usuario',
      modulo: modulo || 'General',
      accion: accion || 'ACCION', // 'CREAR' | 'EDITAR' | 'ELIMINAR' | 'APROBAR' | 'RECHAZAR' | 'LOGIN' | 'VENDIDO' | 'DESPACHADO' | 'ENTREGADO'
      detalle: detalle || '',     // Descripción legible
      datosAntes,   // Snapshot anterior (para ediciones)
      datosDespues, // Snapshot nuevo
      ...rest,
      fecha: serverTimestamp(),
    })
  } catch (e) {
    console.warn('Error registrando auditoría:', e.message)
    // No interrumpir el flujo principal si falla el log
  }
}

export const suscribirAuditoria = (callback, limitN = 300) => {
  const q = query(collection(db, COL), orderBy('fecha', 'desc'), limit(limitN))
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}

export const getAuditoriaPorUsuario = async (nombreUsuario) => {
  const snap = await getDocs(query(collection(db, COL),
    where('usuario', '==', nombreUsuario), orderBy('fecha', 'desc'), limit(200)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getAuditoriaPorModulo = async (modulo) => {
  const snap = await getDocs(query(collection(db, COL),
    where('modulo', '==', modulo), orderBy('fecha', 'desc'), limit(200)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Realiza un backup automático de registros de auditoría de más de 60 días,
 * los guarda en Firebase Storage como un archivo JSON respaldado y depura (elimina)
 * los registros antiguos de Firestore para mantener la base de datos liviana y optimizada.
 */
export const ejecutarBackupYPurgaAuditoria = async ({ creadoPor = 'Sistema (Automático Semanal)', diasRetencion = 60 } = {}) => {
  try {
    const ahora = new Date()
    const fechaCorte = new Date(ahora.getTime() - diasRetencion * 24 * 60 * 60 * 1000)
    const timestampCorte = Timestamp.fromDate(fechaCorte)

    // Consultar registros antiguos de auditoría anteriores a fechaCorte
    const qAntiguos = query(collection(db, COL), where('fecha', '<=', timestampCorte), orderBy('fecha', 'asc'))
    const snapAntiguos = await getDocs(qAntiguos)

    if (snapAntiguos.empty) {
      return { ok: true, count: 0, mensaje: 'No hay registros con más de 60 días para respaldar.' }
    }

    const registros = snapAntiguos.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        ...data,
        fechaISO: data.fecha?.toDate ? data.fecha.toDate().toISOString() : new Date().toISOString()
      }
    })

    const tagFecha = format(ahora, 'yyyy-MM-dd_HHmm')
    const nombreArchivo = `backup_auditoria_${tagFecha}.json`
    const pathStorage = `backups/auditoria/${nombreArchivo}`

    const jsonContenido = JSON.stringify({
      version: '1.0',
      fechaGeneracion: ahora.toISOString(),
      diasRetencion,
      totalRegistros: registros.length,
      creadoPor,
      registros
    }, null, 2)

    // Subir a Firebase Storage
    const storageRef = ref(storage, pathStorage)
    await uploadString(storageRef, jsonContenido, 'raw', { contentType: 'application/json' })
    const downloadUrl = await getDownloadURL(storageRef)

    // Guardar historial del backup en Firestore (colección backups_auditoria)
    const docBackupRef = await addDoc(collection(db, COL_BACKUPS), {
      nombreArchivo,
      pathStorage,
      downloadUrl,
      totalRegistros: registros.length,
      creadoPor,
      diasRetencion,
      fechaCorteISO: fechaCorte.toISOString(),
      fecha: serverTimestamp()
    })

    // Eliminar los documentos respaldados de la colección activa 'auditoria' en lotes de 500
    const docsAEliminar = snapAntiguos.docs
    for (let i = 0; i < docsAEliminar.length; i += 400) {
      const batch = writeBatch(db)
      const chunk = docsAEliminar.slice(i, i + 400)
      chunk.forEach(docSnap => batch.delete(docSnap.ref))
      await batch.commit()
    }

    return {
      ok: true,
      count: registros.length,
      downloadUrl,
      nombreArchivo,
      backupId: docBackupRef.id,
      mensaje: `Backup exitoso: Se archivaron y depuraron ${registros.length} registros antiguos.`
    }
  } catch (error) {
    console.error('Error durante la ejecución del backup de auditoría:', error)
    throw new Error('Fallo al ejecutar el backup de auditoría: ' + error.message)
  }
}

/**
 * Verifica si han transcurrido más de 7 días desde el último backup automático.
 * Si es así, desencadena la ejecución automática de respaldo y purga.
 */
export const verificarYEjecutarBackupSemanalAuto = async () => {
  try {
    const q = query(collection(db, COL_BACKUPS), orderBy('fecha', 'desc'), limit(1))
    const snap = await getDocs(q)
    let ultimoBackupFecha = null

    if (!snap.empty) {
      const data = snap.docs[0].data()
      ultimoBackupFecha = data.fecha?.toDate ? data.fecha.toDate() : null
    }

    const ahora = new Date()
    const hace7Dias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000)

    if (!ultimoBackupFecha || ultimoBackupFecha < hace7Dias) {
      console.log('⚡ Ejecutando backup semanal automático de auditoría...')
      return await ejecutarBackupYPurgaAuditoria({ creadoPor: 'Sistema (Automático Semanal)' })
    }

    return { ok: true, count: 0, ejecutado: false, ultimoBackupFecha }
  } catch (e) {
    console.warn('Advertencia en verificación de backup automático:', e.message)
    return { ok: false, error: e.message }
  }
}

/**
 * Obtiene el historial de backups realizados de la colección 'backups_auditoria'.
 */
export const obtenerHistorialBackups = async () => {
  const snap = await getDocs(query(collection(db, COL_BACKUPS), orderBy('fecha', 'desc'), limit(100)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
