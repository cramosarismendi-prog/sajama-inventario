/**
 * Script de migración: lee el Excel de SAJAMA y sube el inventario a Firestore.
 * Conecta al emulador local por defecto.
 *
 * Uso:
 *   node backend/src/migrate-excel.js
 *   node backend/src/migrate-excel.js --prod    (para producción)
 */
import * as XLSX from 'xlsx'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd    = process.argv.includes('--prod')

// ── Conectar Firebase ──────────────────────────────────────────────────
if (!isProd) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
  initializeApp({ projectId: 'sajama-inventario' })
  console.log('📡 Conectado al emulador local (localhost:8080)')
} else {
  // Para producción: descomenta y coloca tu serviceAccount.json
  // const sa = JSON.parse(fs.readFileSync('./serviceAccount.json'))
  // initializeApp({ credential: cert(sa) })
  console.log('🚨 Modo producción no configurado. Agrega tu serviceAccount.json')
  process.exit(1)
}

const db = getFirestore()

// ── Leer Excel ────────────────────────────────────────────────────────
const EXCEL_PATH = path.join(__dirname, '../../INVENTARIO_SAJAMA.xlsx')
console.log(`\n📂 Leyendo Excel: ${EXCEL_PATH}`)

let workbook
try {
  workbook = XLSX.readFile(EXCEL_PATH)
} catch(e) {
  console.error('❌ No se encontró el archivo Excel. Colócalo en la raíz del proyecto como INVENTARIO_SAJAMA.xlsx')
  process.exit(1)
}

const ws   = workbook.Sheets['INVENTARIO']
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, range: 4 })

// ── Mapear filas ───────────────────────────────────────────────────────
const items = rows
  .filter(r => r[0] && typeof r[0] === 'number')
  .map(r => ({
    codigo:      r[0]  || 0,
    descripcion: r[1]  || '',
    modelo:      r[3]  || '',
    serie:       r[4]  || '',
    unidad:      r[5]  || 'unidad',
    stock:       typeof r[11] === 'number' ? r[11] : 0,
    precio:      typeof r[10] === 'number' ? r[10] : 0,
    categoria:   'Repuestos',  // se puede afinar manualmente después
    stockMin:    5,
    notas:       '',
    creadoPor:   'migración-excel',
    actualizadoEn: new Date(),
  }))

console.log(`✅ ${items.length} ítems leídos del Excel`)

// ── Subir a Firestore ─────────────────────────────────────────────────
async function migrate() {
  const batch = db.batch()
  let count   = 0
  for (const item of items) {
    const ref = db.collection('inventario').doc()
    batch.set(ref, item)
    count++
    if (count % 499 === 0) {        // Firestore: máx 500 ops por batch
      await batch.commit()
      console.log(`  Subidos ${count}/${items.length}...`)
    }
  }
  await batch.commit()
  console.log(`\n🎉 Migración completa: ${count} ítems subidos a Firestore`)
}

migrate().catch(e => { console.error('Error en migración:', e); process.exit(1) })