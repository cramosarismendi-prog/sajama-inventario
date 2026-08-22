import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot, doc,
  setDoc, runTransaction, deleteDoc, serverTimestamp
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import { registrarAccion } from '../services/auditoria'
import { PageLoader } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'
import { Confirm } from '../components/ui/Confirm'
import {
  Fuel, Plus, ArrowDownLeft, ArrowUpRight, Search, Printer,
  Trash2, Filter, Droplet, Truck, FileText, CheckCircle2, AlertCircle
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const COMBUSTIBLES = ['Gasolina', 'Diésel']

// ── Impresión de Planilla de Entradas / Compras ──────────────────────
function imprimirPlanillaEntradas(entradas) {
  const totalLitrosGasolina = entradas.filter(e => e.combustible === 'Gasolina').reduce((a, b) => a + (Number(b.cantidad) || 0), 0)
  const totalLitrosDiesel   = entradas.filter(e => e.combustible === 'Diésel' || e.combustible === 'Diesel').reduce((a, b) => a + (Number(b.cantidad) || 0), 0)
  const montoTotalBs        = entradas.reduce((a, b) => a + (Number(b.precioTotal) || 0), 0)
  const fechaHoy            = format(new Date(), 'dd/MM/yyyy')

  const filasHTML = entradas.map((e, i) => {
    const fechaFmt = e.fecha ? format(new Date(e.fecha + 'T00:00:00'), 'dd/MM/yyyy') : (e.creadoEn?.toDate ? format(e.creadoEn.toDate(), 'dd/MM/yyyy') : '—')
    return `
      <tr>
        <td style="text-align:center;border:1px solid #777;padding:5px">${i + 1}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px;font-weight:bold">${fechaFmt}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px;font-weight:bold;color:${e.combustible === 'Gasolina' ? '#0369a1' : '#b45309'}">${e.combustible}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold;font-size:9pt">${Number(e.cantidad || 0).toLocaleString()} L</td>
        <td style="border:1px solid #777;padding:5px;font-weight:600">${e.responsable || '—'}</td>
        <td style="border:1px solid #777;padding:5px">${e.proveedor || '—'}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px">${e.precioUnitario ? Number(e.precioUnitario).toLocaleString() + ' Bs' : '—'}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold">${e.precioTotal ? Number(e.precioTotal).toLocaleString() + ' Bs' : '—'}</td>
        <td style="border:1px solid #777;padding:5px;font-size:7.5pt">${e.observaciones || '—'}</td>
      </tr>
    `
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Planilla de Compras de Combustible - SAJAMA</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans SC','Microsoft YaHei',Arial,sans-serif; font-size:8.5pt; color:#111; padding:6mm 8mm; }
.header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; border-bottom:2px solid #1a3c6e; padding-bottom:6px; }
.logo { font-size:16pt; font-weight:900; color:#1a3c6e; }
.htxt { flex:1; text-align:center; }
.titzh { font-size:14pt; font-weight:700; }
.tites { font-size:10pt; color:#1a3c6e; font-weight:600; margin-top:2px; }

table { width:100%; border-collapse:collapse; margin-top:8px; font-size:8pt; }
th { background:#e2e8f0; border:1px solid #555; padding:5px 4px; text-align:center; font-weight:700; line-height:1.2; font-size:8pt; }
td { border:1px solid #777; padding:4px 6px; }
.total-row td { font-weight:700; background:#f1f5f9; }

@page { size:A4 landscape; margin:8mm 8mm; }
@media print { body { padding:0; } }
</style></head><body>
<div class="header">
  <div class="logo">Sajama.SRL</div>
  <div class="htxt">
    <div class="titzh">SAJAMA 公司燃油采购与入库清单</div>
    <div class="tites">Planilla de Registro de Entradas y Compras de Combustible - SAJAMA</div>
  </div>
  <div style="font-size:8pt;text-align:right;color:#555">Fecha de impresión:<br/><b>${fechaHoy}</b></div>
</div>

<table>
  <thead><tr>
    <th style="width:4%">No.</th>
    <th style="width:10%">Fecha</th>
    <th style="width:12%">Combustible</th>
    <th style="width:12%">Cantidad (L)</th>
    <th style="width:18%">Responsable Compra</th>
    <th style="width:14%">Proveedor / Nota</th>
    <th style="width:10%">P. Unit (Bs)</th>
    <th style="width:10%">P. Total (Bs)</th>
    <th style="width:10%">Observaciones</th>
  </tr></thead>
  <tbody>
    ${filasHTML}
    <tr class="total-row">
      <td colspan="3" style="text-align:right;padding-right:8px;font-size:8.5pt">Total acumulado (${entradas.length} compras):</td>
      <td style="text-align:right;font-size:9pt;font-weight:bold;padding-right:6px">Gasolina: ${totalLitrosGasolina.toLocaleString()} L<br/>Diésel: ${totalLitrosDiesel.toLocaleString()} L</td>
      <td colspan="3"></td>
      <td style="text-align:right;font-size:9pt;font-weight:bold;padding-right:6px">${montoTotalBs.toLocaleString()} Bs</td>
      <td></td>
    </tr>
  </tbody>
</table>

<script>
window.onload = () => { setTimeout(() => window.print(), 300); };
<\/script>
</body></html>`

  const w = window.open('', '_blank', 'width=1100,height=800')
  w.document.write(html)
  w.document.close()
}

// ── Impresión de Planilla de Despachos / Salidas ──────────────────────
function imprimirPlanillaDespachos(salidas) {
  const totalLitrosGasolina = salidas.filter(s => s.combustible === 'Gasolina').reduce((a, b) => a + (Number(b.cantidad) || 0), 0)
  const totalLitrosDiesel   = salidas.filter(s => s.combustible === 'Diésel' || s.combustible === 'Diesel').reduce((a, b) => a + (Number(b.cantidad) || 0), 0)
  const montoTotalBs        = salidas.reduce((a, b) => a + (Number(b.precioTotal) || 0), 0)
  const fechaHoy            = format(new Date(), 'dd/MM/yyyy')

  const filasHTML = salidas.map((s, i) => {
    const fechaFmt = s.fecha ? format(new Date(s.fecha + 'T00:00:00'), 'dd/MM/yyyy') : (s.creadoEn?.toDate ? format(s.creadoEn.toDate(), 'dd/MM/yyyy') : '—')
    return `
      <tr>
        <td style="text-align:center;border:1px solid #777;padding:5px">${i + 1}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px;font-weight:bold">${fechaFmt}</td>
        <td style="text-align:center;border:1px solid #777;padding:5px;font-weight:bold;color:${s.combustible === 'Gasolina' ? '#0369a1' : '#b45309'}">${s.combustible}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold;font-size:9pt">${Number(s.cantidad || 0).toLocaleString()} L</td>
        <td style="border:1px solid #777;padding:5px;font-family:monospace;font-weight:bold">${s.seriePlaca || '—'}</td>
        <td style="border:1px solid #777;padding:5px;font-weight:600">${s.nroMovil || '—'}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px">${s.precioUnitario ? Number(s.precioUnitario).toLocaleString() + ' Bs' : '—'}</td>
        <td style="text-align:right;border:1px solid #777;padding:5px;font-weight:bold">${s.precioTotal ? Number(s.precioTotal).toLocaleString() + ' Bs' : '—'}</td>
        <td style="border:1px solid #777;padding:5px">${s.destino || '—'}</td>
        <td style="border:1px solid #777;padding:5px;font-size:7.5pt">${s.observaciones || '—'}</td>
      </tr>
    `
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Planilla de Despacho de Combustible - SAJAMA</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans SC','Microsoft YaHei',Arial,sans-serif; font-size:8.5pt; color:#111; padding:6mm 8mm; }
.header { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; border-bottom:2px solid #1a3c6e; padding-bottom:6px; }
.logo { font-size:16pt; font-weight:900; color:#1a3c6e; }
.htxt { flex:1; text-align:center; }
.titzh { font-size:14pt; font-weight:700; }
.tites { font-size:10pt; color:#1a3c6e; font-weight:600; margin-top:2px; }

table { width:100%; border-collapse:collapse; margin-top:8px; font-size:8pt; }
th { background:#e2e8f0; border:1px solid #555; padding:5px 4px; text-align:center; font-weight:700; line-height:1.2; font-size:8pt; }
td { border:1px solid #777; padding:4px 6px; }
.total-row td { font-weight:700; background:#f1f5f9; }

@page { size:A4 landscape; margin:8mm 8mm; }
@media print { body { padding:0; } }
</style></head><body>
<div class="header">
  <div class="logo">Sajama.SRL</div>
  <div class="htxt">
    <div class="titzh">SAJAMA 公司燃油加油与派送清单</div>
    <div class="tites">Planilla de Control de Despacho de Combustible - SAJAMA</div>
  </div>
  <div style="font-size:8pt;text-align:right;color:#555">Fecha de impresión:<br/><b>${fechaHoy}</b></div>
</div>

<table>
  <thead><tr>
    <th style="width:4%">No.</th>
    <th style="width:9%">Fecha</th>
    <th style="width:10%">Combustible</th>
    <th style="width:10%">Cantidad (L)</th>
    <th style="width:12%">Placa / Chasis</th>
    <th style="width:11%">N° Móvil</th>
    <th style="width:9%">P. Unit (Bs)</th>
    <th style="width:9%">P. Total (Bs)</th>
    <th style="width:13%">Destino</th>
    <th style="width:13%">Observaciones</th>
  </tr></thead>
  <tbody>
    ${filasHTML}
    <tr class="total-row">
      <td colspan="3" style="text-align:right;padding-right:8px;font-size:8.5pt">Total despachado (${salidas.length} registros):</td>
      <td style="text-align:right;font-size:9pt;font-weight:bold;padding-right:6px">Gasolina: ${totalLitrosGasolina.toLocaleString()} L<br/>Diésel: ${totalLitrosDiesel.toLocaleString()} L</td>
      <td colspan="3"></td>
      <td style="text-align:right;font-size:9pt;font-weight:bold;padding-right:6px">${montoTotalBs.toLocaleString()} Bs</td>
      <td colspan="2"></td>
    </tr>
  </tbody>
</table>

<script>
window.onload = () => { setTimeout(() => window.print(), 300); };
<\/script>
</body></html>`

  const w = window.open('', '_blank', 'width=1100,height=800')
  w.document.write(html)
  w.document.close()
}

// ── Impresión de Vale de Despacho Individual (Comprobante A4 Landscape) ──
function imprimirValeDespacho(despacho) {
  const fechaFmt = despacho.fecha ? format(new Date(despacho.fecha + 'T00:00:00'), 'dd/MM/yyyy') : ''

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Vale de Despacho de Combustible - SAJAMA</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans SC','Microsoft YaHei',Arial,sans-serif; font-size:9pt; color:#111; padding:8mm; }
.ticket { border:2px solid #1a3c6e; padding:12px; border-radius:6px; background:#fff; max-width:850px; margin:0 auto; }
.header { display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #1a3c6e; padding-bottom:8px; margin-bottom:12px; }
.logo { font-size:18pt; font-weight:900; color:#1a3c6e; }
.htxt { flex:1; text-align:center; }
.titzh { font-size:14pt; font-weight:700; }
.tites { font-size:10pt; color:#1a3c6e; font-weight:600; margin-top:2px; }

.grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; }
.box { border:1px solid #777; padding:8px 10px; border-radius:4px; background:#fafafa; }
.label { font-size:7.5pt; color:#555; font-weight:bold; display:block; text-transform:uppercase; }
.val { font-size:10pt; color:#000; font-weight:bold; margin-top:2px; }

.firmas { display:grid; grid-template-columns:1fr 1fr; gap:30px; margin-top:35px; text-align:center; }
.linea-firma { border-top:1px solid #444; pt:4px; font-size:8.5pt; font-weight:bold; }

@page { size:A4 landscape; margin:8mm; }
@media print { body { padding:0; } }
</style></head><body>
<div class="ticket">
  <div class="header">
    <div class="logo">Sajama.SRL</div>
    <div class="htxt">
      <div class="titzh">SAJAMA 公司加油派送凭证</div>
      <div class="tites">VALE DE DESPACHO DE COMBUSTIBLE - SAJAMA</div>
    </div>
    <div style="text-align:right;font-size:8.5pt">
      Fecha: <b>${fechaFmt}</b>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <span class="label">Tipo de Combustible / 燃油种类</span>
      <div class="val" style="color:${despacho.combustible === 'Gasolina' ? '#0369a1' : '#b45309'}">${despacho.combustible}</div>
    </div>
    <div class="box">
      <span class="label">Cantidad Despachada / 派送数量</span>
      <div class="val" style="font-size:13pt;color:#166534">${Number(despacho.cantidad || 0).toLocaleString()} Litros</div>
    </div>
    <div class="box">
      <span class="label">Placa / Chasis / 车牌-底盘号</span>
      <div class="val" style="font-family:monospace">${despacho.seriePlaca || '—'}</div>
    </div>
    <div class="box">
      <span class="label">N° Móvil / 手机/设备编号</span>
      <div class="val">${despacho.nroMovil || '—'}</div>
    </div>
    <div class="box">
      <span class="label">Destino / 目的地</span>
      <div class="val">${despacho.destino || '—'}</div>
    </div>
    <div class="box">
      <span class="label">Precio Total / 总价 (Bs)</span>
      <div class="val">${despacho.precioTotal ? Number(despacho.precioTotal).toLocaleString() + ' Bs' : '—'}</div>
    </div>
  </div>

  ${despacho.observaciones ? `
    <div class="box" style="margin-bottom:12px">
      <span class="label">Observaciones / 备注</span>
      <div class="val" style="font-weight:normal;font-size:9pt">${despacho.observaciones}</div>
    </div>
  ` : ''}

  <div class="firmas">
    <div>
      <div style="height:35px"></div>
      <div class="linea-firma">Firma de Quien Entrega (Despachador)<br/><span style="font-weight:normal;font-size:7.5pt">${despacho.creadoPor || 'SAJAMA'}</span></div>
    </div>
    <div>
      <div style="height:35px"></div>
      <div class="linea-firma">Firma y Nombre del Conductor / Receptor<br/><span style="font-weight:normal;font-size:7.5pt">${despacho.responsable || 'Conductor / Cliente'}</span></div>
    </div>
  </div>
</div>

<script>
window.onload = () => { setTimeout(() => window.print(), 300); };
<\/script>
</body></html>`

  const w = window.open('', '_blank', 'width=950,height=750')
  w.document.write(html)
  w.document.close()
}

export default function Abastecimiento() {
  const { perfil } = useAuth()
  const [saldos, setSaldos] = useState({ gasolina: 0, diesel: 0 })
  const [entradas, setEntradas] = useState([])
  const [salidas, setSalidas] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resumen') // 'resumen', 'entradas', 'salidas'

  // Modales
  const [modalEntrada, setModalEntrada] = useState(false)
  const [modalSalida, setModalSalida] = useState(false)
  const [delEntrada, setDelEntrada] = useState(null)
  const [delSalida, setDelSalida] = useState(null)
  const [guardando, setGuardando] = useState(false)

  // Filtros
  const [busquedaEntrada, setBusquedaEntrada] = useState('')
  const [busquedaSalida, setBusquedaSalida] = useState('')

  // Form State Entrada (Compra)
  const [formEntrada, setFormEntrada] = useState({
    combustible: 'Gasolina',
    cantidad: '',
    responsable: '',
    proveedor: '',
    precioUnitario: '',
    precioTotal: '',
    fecha: format(new Date(), 'yyyy-MM-dd'),
    observaciones: ''
  })

  // Form State Salida (Despacho)
  const [formSalida, setFormSalida] = useState({
    combustible: 'Gasolina',
    cantidad: '',
    seriePlaca: '',
    nroMovil: '',
    precioUnitario: '',
    precioTotal: '',
    destino: '',
    responsable: '',
    fecha: format(new Date(), 'yyyy-MM-dd'),
    observaciones: ''
  })

  // Carga en tiempo real de Saldos, Entradas y Salidas
  useEffect(() => {
    const unsubSaldos = onSnapshot(
      doc(db, 'abastecimiento_saldos', 'combustibles'),
      snap => {
        if (snap.exists()) {
          setSaldos(snap.data())
        } else {
          setSaldos({ gasolina: 0, diesel: 0 })
        }
      },
      err => console.error('Error cargando saldos:', err)
    )

    const unsubEntradas = onSnapshot(
      query(collection(db, 'abastecimiento_entradas'), orderBy('creadoEn', 'desc')),
      snap => {
        setEntradas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      err => console.error('Error cargando entradas:', err)
    )

    const unsubSalidas = onSnapshot(
      query(collection(db, 'abastecimiento_salidas'), orderBy('creadoEn', 'desc')),
      snap => {
        setSalidas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      err => console.error('Error cargando salidas:', err)
    )

    return () => {
      unsubSaldos()
      unsubEntradas()
      unsubSalidas()
    }
  }, [])

  const canEdit = ['administrador', 'gerencia', 'almacenero', 'contabilidad'].includes(perfil?.rol)
  const canDelete = perfil?.rol === 'administrador'

  // Cálculo automático de Precio Total en Form Entradas
  const handleCantidadEntradaChange = (val) => {
    const qty = parseFloat(val) || 0
    const pu = parseFloat(formEntrada.precioUnitario) || 0
    setFormEntrada(prev => ({
      ...prev,
      cantidad: val,
      precioTotal: (qty > 0 && pu > 0) ? (qty * pu).toFixed(2) : prev.precioTotal
    }))
  }

  const handlePUEntradaChange = (val) => {
    const pu = parseFloat(val) || 0
    const qty = parseFloat(formEntrada.cantidad) || 0
    setFormEntrada(prev => ({
      ...prev,
      precioUnitario: val,
      precioTotal: (qty > 0 && pu > 0) ? (qty * pu).toFixed(2) : prev.precioTotal
    }))
  }

  // Cierre y Reset Form Entrada
  const resetFormEntrada = () => {
    setFormEntrada({
      combustible: 'Gasolina', cantidad: '', responsable: '',
      proveedor: '', precioUnitario: '', precioTotal: '',
      fecha: format(new Date(), 'yyyy-MM-dd'), observaciones: ''
    })
  }

  // Guardar Entrada (Compra) con Transacción Atómica de Stock (+ Suma)
  const handleGuardarEntrada = async (e) => {
    e.preventDefault()
    const qty = parseFloat(formEntrada.cantidad)
    if (!qty || qty <= 0) return toast.error('Ingresa una cantidad válida de litros')
    if (!formEntrada.responsable.trim()) return toast.error('Ingresa el nombre del responsable de compra')

    setGuardando(true)
    try {
      const docEntradaRef = doc(collection(db, 'abastecimiento_entradas'))
      const saldoRef = doc(db, 'abastecimiento_saldos', 'combustibles')
      const campoComb = formEntrada.combustible === 'Gasolina' ? 'gasolina' : 'diesel'

      await runTransaction(db, async (transaction) => {
        const saldoDoc = await transaction.get(saldoRef)
        const currentStock = saldoDoc.exists() ? (Number(saldoDoc.data()[campoComb]) || 0) : 0
        const newStock = currentStock + qty

        transaction.set(saldoRef, { [campoComb]: newStock, ultimaActualizacion: serverTimestamp() }, { merge: true })
        transaction.set(docEntradaRef, {
          combustible: formEntrada.combustible,
          cantidad: qty,
          responsable: formEntrada.responsable.trim(),
          proveedor: formEntrada.proveedor.trim(),
          precioUnitario: parseFloat(formEntrada.precioUnitario) || 0,
          precioTotal: parseFloat(formEntrada.precioTotal) || 0,
          fecha: formEntrada.fecha,
          observaciones: formEntrada.observaciones.trim(),
          stockPosterior: newStock,
          creadoPor: perfil?.nombre || 'Sistema',
          creadoEn: serverTimestamp()
        })
      })

      await registrarAccion({
        usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Abastecimiento',
        accion: 'CREAR_ENTRADA', detalle: `Registró compra de ${qty}L de ${formEntrada.combustible} (Resp: ${formEntrada.responsable})`
      })

      toast.success(`Entrada de ${qty} Litros de ${formEntrada.combustible} registrada correctamente`)
      setModalEntrada(false)
      resetFormEntrada()
    } catch (err) {
      console.error(err)
      toast.error('Error al registrar entrada: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  // Cálculo automático en Form Salidas
  const handleCantidadSalidaChange = (val) => {
    const qty = parseFloat(val) || 0
    const pu = parseFloat(formSalida.precioUnitario) || 0
    setFormSalida(prev => ({
      ...prev,
      cantidad: val,
      precioTotal: (qty > 0 && pu > 0) ? (qty * pu).toFixed(2) : prev.precioTotal
    }))
  }

  const handlePUSalidaChange = (val) => {
    const pu = parseFloat(val) || 0
    const qty = parseFloat(formSalida.cantidad) || 0
    setFormSalida(prev => ({
      ...prev,
      precioUnitario: val,
      precioTotal: (qty > 0 && pu > 0) ? (qty * pu).toFixed(2) : prev.precioTotal
    }))
  }

  // Cierre y Reset Form Salida
  const resetFormSalida = () => {
    setFormSalida({
      combustible: 'Gasolina', cantidad: '', seriePlaca: '', nroMovil: '',
      precioUnitario: '', precioTotal: '', destino: '', responsable: '',
      fecha: format(new Date(), 'yyyy-MM-dd'), observaciones: ''
    })
  }

  // Guardar Salida (Despacho) con Transacción Atómica de Stock (- Resta)
  const handleGuardarSalida = async (e) => {
    e.preventDefault()
    const qty = parseFloat(formSalida.cantidad)
    if (!qty || qty <= 0) return toast.error('Ingresa una cantidad válida de litros')
    if (!formSalida.seriePlaca.trim()) return toast.error('Ingresa el número de Placa / Chasis')
    if (!formSalida.nroMovil.trim()) return toast.error('Ingresa el N° de Móvil')

    setGuardando(true)
    try {
      const docSalidaRef = doc(collection(db, 'abastecimiento_salidas'))
      const saldoRef = doc(db, 'abastecimiento_saldos', 'combustibles')
      const campoComb = formSalida.combustible === 'Gasolina' ? 'gasolina' : 'diesel'

      await runTransaction(db, async (transaction) => {
        const saldoDoc = await transaction.get(saldoRef)
        const currentStock = saldoDoc.exists() ? (Number(saldoDoc.data()[campoComb]) || 0) : 0

        if (qty > currentStock) {
          throw new Error(`Stock insuficiente de ${formSalida.combustible}. Stock actual: ${currentStock} L`)
        }

        const newStock = currentStock - qty

        transaction.set(saldoRef, { [campoComb]: newStock, ultimaActualizacion: serverTimestamp() }, { merge: true })
        transaction.set(docSalidaRef, {
          combustible: formSalida.combustible,
          cantidad: qty,
          seriePlaca: formSalida.seriePlaca.trim(),
          nroMovil: formSalida.nroMovil.trim(),
          precioUnitario: parseFloat(formSalida.precioUnitario) || 0,
          precioTotal: parseFloat(formSalida.precioTotal) || 0,
          destino: formSalida.destino.trim(),
          responsable: formSalida.responsable.trim(),
          fecha: formSalida.fecha,
          observaciones: formSalida.observaciones.trim(),
          stockPosterior: newStock,
          creadoPor: perfil?.nombre || 'Sistema',
          creadoEn: serverTimestamp()
        })
      })

      await registrarAccion({
        usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Abastecimiento',
        accion: 'CREAR_SALIDA', detalle: `Despachó ${qty}L de ${formSalida.combustible} a ${formSalida.seriePlaca} (${formSalida.nroMovil})`
      })

      toast.success(`Despacho de ${qty} Litros registrado correctamente`)
      setModalSalida(false)
      resetFormSalida()
    } catch (err) {
      console.error(err)
      toast.error(err.message)
    } finally {
      setGuardando(false)
    }
  }

  // Eliminar Entrada
  const handleEliminarEntrada = async () => {
    if (!delEntrada) return
    try {
      await deleteDoc(doc(db, 'abastecimiento_entradas', delEntrada.id))
      await registrarAccion({
        usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Abastecimiento',
        accion: 'ELIMINAR_ENTRADA', detalle: `Eliminó entrada de ${delEntrada.cantidad}L ${delEntrada.combustible}`
      })
      toast.success('Registro de entrada eliminado')
      setDelEntrada(null)
    } catch (err) {
      toast.error('Error al eliminar: ' + err.message)
    }
  }

  // Eliminar Salida
  const handleEliminarSalida = async () => {
    if (!delSalida) return
    try {
      await deleteDoc(doc(db, 'abastecimiento_salidas', delSalida.id))
      await registrarAccion({
        usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Abastecimiento',
        accion: 'ELIMINAR_SALIDA', detalle: `Eliminó despacho de ${delSalida.cantidad}L ${delSalida.combustible}`
      })
      toast.success('Registro de despacho eliminado')
      setDelSalida(null)
    } catch (err) {
      toast.error('Error al eliminar: ' + err.message)
    }
  }

  // Filtros de Entradas
  const entradasFiltradas = entradas.filter(e => {
    if (!busquedaEntrada.trim()) return true
    const q = busquedaEntrada.toLowerCase()
    return (
      e.combustible?.toLowerCase().includes(q) ||
      e.responsable?.toLowerCase().includes(q) ||
      e.proveedor?.toLowerCase().includes(q) ||
      e.observaciones?.toLowerCase().includes(q)
    )
  })

  // Filtros de Salidas
  const salidasFiltradas = salidas.filter(s => {
    if (!busquedaSalida.trim()) return true
    const q = busquedaSalida.toLowerCase()
    return (
      s.combustible?.toLowerCase().includes(q) ||
      s.seriePlaca?.toLowerCase().includes(q) ||
      s.nroMovil?.toLowerCase().includes(q) ||
      s.destino?.toLowerCase().includes(q) ||
      s.responsable?.toLowerCase().includes(q) ||
      s.observaciones?.toLowerCase().includes(q)
    )
  })

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            <Fuel size={28} className="text-primary"/> Abastecimiento y Despacho
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Control de inventario, compras de combustible y vales de despacho a maquinaria/vehículos
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <button onClick={() => { resetFormEntrada(); setModalEntrada(true) }} className="btn-secondary flex items-center gap-1.5 text-xs sm:text-sm">
              <Plus size={16} className="text-emerald-600"/> <ArrowDownLeft size={16} className="text-emerald-600"/> Registrar Entrada (Compra)
            </button>
            <button onClick={() => { resetFormSalida(); setModalSalida(true) }} className="btn-primary flex items-center gap-1.5 text-xs sm:text-sm">
              <Plus size={16}/> <ArrowUpRight size={16}/> Registrar Despacho (Salida)
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards de Saldos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card Gasolina */}
        <div className="card p-4 border-l-4 border-l-sky-500 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock Gasolina</p>
            <h3 className="text-2xl font-black text-sky-950 mt-1">
              {(saldos.gasolina || 0).toLocaleString()} <span className="text-sm font-bold text-sky-700">Litros</span>
            </h3>
            <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[11px] font-bold ${
              (saldos.gasolina || 0) > 500 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {(saldos.gasolina || 0) > 500 ? 'Stock Suficiente' : 'Stock Bajo'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-600">
            <Droplet size={26}/>
          </div>
        </div>

        {/* Card Diésel */}
        <div className="card p-4 border-l-4 border-l-amber-500 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock Diésel</p>
            <h3 className="text-2xl font-black text-amber-950 mt-1">
              {(saldos.diesel || 0).toLocaleString()} <span className="text-sm font-bold text-amber-700">Litros</span>
            </h3>
            <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[11px] font-bold ${
              (saldos.diesel || 0) > 500 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {(saldos.diesel || 0) > 500 ? 'Stock Suficiente' : 'Stock Bajo'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Truck size={26}/>
          </div>
        </div>

        {/* Card Histórico Entradas */}
        <div className="card p-4 border-l-4 border-l-emerald-500 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Comprado (Entradas)</p>
            <h3 className="text-xl font-bold text-gray-800 mt-1">
              {entradas.length} <span className="text-xs text-gray-500 font-normal">compras</span>
            </h3>
            <p className="text-xs text-emerald-600 font-medium mt-1">
              + {entradas.reduce((a, b) => a + (Number(b.cantidad) || 0), 0).toLocaleString()} L ingresados
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <ArrowDownLeft size={24}/>
          </div>
        </div>

        {/* Card Histórico Salidas */}
        <div className="card p-4 border-l-4 border-l-indigo-500 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Despachado (Salidas)</p>
            <h3 className="text-xl font-bold text-gray-800 mt-1">
              {salidas.length} <span className="text-xs text-gray-500 font-normal">despachos</span>
            </h3>
            <p className="text-xs text-indigo-600 font-medium mt-1">
              - {salidas.reduce((a, b) => a + (Number(b.cantidad) || 0), 0).toLocaleString()} L despachados
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <ArrowUpRight size={24}/>
          </div>
        </div>
      </div>

      {/* Control de Pestañas (Tabs) */}
      <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl max-w-full overflow-x-auto">
        <button
          onClick={() => setTab('resumen')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            tab === 'resumen' ? 'bg-white text-gray-900 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📊 Resumen y Saldos
        </button>
        <button
          onClick={() => setTab('entradas')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            tab === 'entradas' ? 'bg-white text-emerald-700 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📥 Historial de Entradas ({entradas.length})
        </button>
        <button
          onClick={() => setTab('salidas')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            tab === 'salidas' ? 'bg-white text-primary shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📤 Historial de Despachos ({salidas.length})
        </button>
      </div>

      {/* CONTENIDO TAB 1: RESUMEN Y SALDOS */}
      {tab === 'resumen' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card Resumen Gasolina */}
          <div className="card p-5 border border-sky-100 bg-gradient-to-br from-white to-sky-50/30">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">⛽</div>
                <div>
                  <h3 className="font-bold text-gray-900">Tanque de Gasolina</h3>
                  <p className="text-xs text-gray-500">Unidad de medida: Litros (L)</p>
                </div>
              </div>
              <span className="text-xl font-black text-sky-700">{(saldos.gasolina || 0).toLocaleString()} L</span>
            </div>

            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Entradas acumuladas:</span>
                <span className="font-semibold text-emerald-700">
                  + {entradas.filter(e => e.combustible === 'Gasolina').reduce((a, b) => a + (Number(b.cantidad) || 0), 0).toLocaleString()} L
                </span>
              </div>
              <div className="flex justify-between">
                <span>Despachos acumulados:</span>
                <span className="font-semibold text-red-600">
                  - {salidas.filter(s => s.combustible === 'Gasolina').reduce((a, b) => a + (Number(b.cantidad) || 0), 0).toLocaleString()} L
                </span>
              </div>
            </div>

            {canEdit && (
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => { setFormEntrada(prev => ({ ...prev, combustible: 'Gasolina' })); setModalEntrada(true) }}
                  className="btn-secondary btn-sm flex-1 text-xs"
                >
                  <Plus size={14}/> Cargar Gasolina
                </button>
                <button
                  onClick={() => { setFormSalida(prev => ({ ...prev, combustible: 'Gasolina' })); setModalSalida(true) }}
                  className="btn-primary btn-sm flex-1 text-xs"
                >
                  <ArrowUpRight size={14}/> Despachar Gasolina
                </button>
              </div>
            )}
          </div>

          {/* Card Resumen Diésel */}
          <div className="card p-5 border border-amber-100 bg-gradient-to-br from-white to-amber-50/30">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">🚜</div>
                <div>
                  <h3 className="font-bold text-gray-900">Tanque de Diésel</h3>
                  <p className="text-xs text-gray-500">Unidad de medida: Litros (L)</p>
                </div>
              </div>
              <span className="text-xl font-black text-amber-800">{(saldos.diesel || 0).toLocaleString()} L</span>
            </div>

            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Entradas acumuladas:</span>
                <span className="font-semibold text-emerald-700">
                  + {entradas.filter(e => e.combustible === 'Diésel' || e.combustible === 'Diesel').reduce((a, b) => a + (Number(b.cantidad) || 0), 0).toLocaleString()} L
                </span>
              </div>
              <div className="flex justify-between">
                <span>Despachos acumulados:</span>
                <span className="font-semibold text-red-600">
                  - {salidas.filter(s => s.combustible === 'Diésel' || s.combustible === 'Diesel').reduce((a, b) => a + (Number(b.cantidad) || 0), 0).toLocaleString()} L
                </span>
              </div>
            </div>

            {canEdit && (
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => { setFormEntrada(prev => ({ ...prev, combustible: 'Diésel' })); setModalEntrada(true) }}
                  className="btn-secondary btn-sm flex-1 text-xs"
                >
                  <Plus size={14}/> Cargar Diésel
                </button>
                <button
                  onClick={() => { setFormSalida(prev => ({ ...prev, combustible: 'Diésel' })); setModalSalida(true) }}
                  className="btn-primary btn-sm flex-1 text-xs"
                >
                  <ArrowUpRight size={14}/> Despachar Diésel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO TAB 2: ENTRADAS / COMPRAS */}
      {tab === 'entradas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por combustible, responsable, proveedor..."
                value={busquedaEntrada}
                onChange={e => setBusquedaEntrada(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button onClick={() => imprimirPlanillaEntradas(entradasFiltradas)} className="btn-secondary flex items-center gap-1.5">
              <Printer size={16}/> Imprimir Planilla de Entradas
            </button>
          </div>

          <div className="card p-0 overflow-hidden shadow-sm border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[750px]">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Combustible</th>
                    <th className="py-3 px-4">Cantidad</th>
                    <th className="py-3 px-4">Responsable Compra</th>
                    <th className="py-3 px-4">Proveedor / Factura</th>
                    <th className="py-3 px-4">Precio Total</th>
                    <th className="py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entradasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-gray-400">
                        No hay registros de compras / entradas de combustible
                      </td>
                    </tr>
                  ) : (
                    entradasFiltradas.map(e => {
                      const fechaFmt = e.fecha ? format(new Date(e.fecha + 'T00:00:00'), 'dd/MM/yyyy') : (e.creadoEn?.toDate ? format(e.creadoEn.toDate(), 'dd/MM/yyyy') : '—')
                      return (
                        <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 text-xs font-semibold text-gray-700">{fechaFmt}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                              e.combustible === 'Gasolina' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              <Droplet size={12}/> {e.combustible}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-emerald-700">
                            + {Number(e.cantidad || 0).toLocaleString()} L
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-800">{e.responsable}</td>
                          <td className="py-3 px-4 text-gray-500 text-xs">{e.proveedor || '—'}</td>
                          <td className="py-3 px-4 font-semibold text-gray-900">
                            {e.precioTotal ? `${Number(e.precioTotal).toLocaleString()} Bs` : '—'}
                          </td>
                          <td className="py-3 px-4">
                            {canDelete && (
                              <button
                                onClick={() => setDelEntrada(e)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar entrada"
                              >
                                <Trash2 size={16}/>
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO TAB 3: DESPACHOS / SALIDAS */}
      {tab === 'salidas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por placa, móvil, combustible, destino..."
                value={busquedaSalida}
                onChange={e => setBusquedaSalida(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button onClick={() => imprimirPlanillaDespachos(salidasFiltradas)} className="btn-secondary flex items-center gap-1.5">
              <Printer size={16}/> Imprimir Planilla de Despachos
            </button>
          </div>

          <div className="card p-0 overflow-hidden shadow-sm border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[850px]">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Combustible</th>
                    <th className="py-3 px-4">Cantidad</th>
                    <th className="py-3 px-4">Placa / Chasis</th>
                    <th className="py-3 px-4">N° Móvil</th>
                    <th className="py-3 px-4">Destino</th>
                    <th className="py-3 px-4">Precio Total</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {salidasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-gray-400">
                        No hay registros de despachos / salidas de combustible
                      </td>
                    </tr>
                  ) : (
                    salidasFiltradas.map(s => {
                      const fechaFmt = s.fecha ? format(new Date(s.fecha + 'T00:00:00'), 'dd/MM/yyyy') : (s.creadoEn?.toDate ? format(s.creadoEn.toDate(), 'dd/MM/yyyy') : '—')
                      return (
                        <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 text-xs font-semibold text-gray-700">{fechaFmt}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                              s.combustible === 'Gasolina' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              <Droplet size={12}/> {s.combustible}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-red-600">
                            - {Number(s.cantidad || 0).toLocaleString()} L
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-gray-900">{s.seriePlaca || '—'}</td>
                          <td className="py-3 px-4 font-semibold text-gray-800">{s.nroMovil || '—'}</td>
                          <td className="py-3 px-4 text-gray-600 text-xs">{s.destino || '—'}</td>
                          <td className="py-3 px-4 font-semibold text-gray-900">
                            {s.precioTotal ? `${Number(s.precioTotal).toLocaleString()} Bs` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => imprimirValeDespacho(s)}
                                className="p-1.5 text-primary hover:bg-primary-pale rounded-lg transition-colors"
                                title="Imprimir Vale de Despacho"
                              >
                                <Printer size={16}/>
                              </button>
                              {canDelete && (
                                <button
                                  onClick={() => setDelSalida(s)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Eliminar registro"
                                >
                                  <Trash2 size={16}/>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: REGISTRAR ENTRADA (COMPRA) */}
      <Modal open={modalEntrada} onClose={() => setModalEntrada(false)} title="Registrar Compra / Entrada de Combustible" size="md">
        <form onSubmit={handleGuardarEntrada} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Combustible *</label>
              <select
                value={formEntrada.combustible}
                onChange={e => setFormEntrada({ ...formEntrada, combustible: e.target.value })}
                className="input-field font-bold"
              >
                {COMBUSTIBLES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cantidad (Litros) *</label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                required
                placeholder="Ej. 1000"
                value={formEntrada.cantidad}
                onChange={e => handleCantidadEntradaChange(e.target.value)}
                className="input-field font-bold text-emerald-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Responsable de Compra *</label>
              <input
                type="text"
                required
                placeholder="Nombre del responsable"
                value={formEntrada.responsable}
                onChange={e => setFormEntrada({ ...formEntrada, responsable: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Proveedor / Factura</label>
              <input
                type="text"
                placeholder="Ej. YPFB / Fact. N° 4021"
                value={formEntrada.proveedor}
                onChange={e => setFormEntrada({ ...formEntrada, proveedor: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Precio Unit. (Bs/L)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Ej. 3.74"
                value={formEntrada.precioUnitario}
                onChange={e => handlePUEntradaChange(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Precio Total (Bs)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Ej. 3740"
                value={formEntrada.precioTotal}
                onChange={e => setFormEntrada({ ...formEntrada, precioTotal: e.target.value })}
                className="input-field font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha *</label>
              <input
                type="date"
                required
                value={formEntrada.fecha}
                onChange={e => setFormEntrada({ ...formEntrada, fecha: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              rows={2}
              placeholder="Detalles de la compra, lugar de recepcion..."
              value={formEntrada.observaciones}
              onChange={e => setFormEntrada({ ...formEntrada, observaciones: e.target.value })}
              className="input-field"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={() => setModalEntrada(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary">
              {guardando ? 'Registrando...' : 'Registrar Compra / Entrada'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: REGISTRAR SALIDA (DESPACHO) */}
      <Modal open={modalSalida} onClose={() => setModalSalida(false)} title="Registrar Despacho de Combustible" size="md">
        <form onSubmit={handleGuardarSalida} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex justify-between items-center">
            <span>Stock disponible de {formSalida.combustible}:</span>
            <b className="text-sm text-amber-900">
              {formSalida.combustible === 'Gasolina' ? (saldos.gasolina || 0).toLocaleString() : (saldos.diesel || 0).toLocaleString()} L
            </b>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Combustible *</label>
              <select
                value={formSalida.combustible}
                onChange={e => setFormSalida({ ...formSalida, combustible: e.target.value })}
                className="input-field font-bold"
              >
                {COMBUSTIBLES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cantidad (Litros) *</label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                required
                placeholder="Ej. 150"
                value={formSalida.cantidad}
                onChange={e => handleCantidadSalidaChange(e.target.value)}
                className="input-field font-bold text-red-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Placa / Chasis *</label>
              <input
                type="text"
                required
                placeholder="Ej. 443724 / 2342-KZR"
                value={formSalida.seriePlaca}
                onChange={e => setFormSalida({ ...formSalida, seriePlaca: e.target.value })}
                className="input-field font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">N° Móvil *</label>
              <input
                type="text"
                required
                placeholder="Ej. Móvil 05 / Volqueta 12"
                value={formSalida.nroMovil}
                onChange={e => setFormSalida({ ...formSalida, nroMovil: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Destino *</label>
              <input
                type="text"
                required
                placeholder="Ej. Mina Sajama / Obra Corocoro"
                value={formSalida.destino}
                onChange={e => setFormSalida({ ...formSalida, destino: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Responsable / Conductor</label>
              <input
                type="text"
                placeholder="Nombre del conductor"
                value={formSalida.responsable}
                onChange={e => setFormSalida({ ...formSalida, responsable: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Precio Unit. (Bs/L)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Ej. 3.74"
                value={formSalida.precioUnitario}
                onChange={e => handlePUSalidaChange(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Precio Total (Bs)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Ej. 561"
                value={formSalida.precioTotal}
                onChange={e => setFormSalida({ ...formSalida, precioTotal: e.target.value })}
                className="input-field font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha *</label>
              <input
                type="date"
                required
                value={formSalida.fecha}
                onChange={e => setFormSalida({ ...formSalida, fecha: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              rows={2}
              placeholder="Notas de entrega, estado de horómetro..."
              value={formSalida.observaciones}
              onChange={e => setFormSalida({ ...formSalida, observaciones: e.target.value })}
              className="input-field"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={() => setModalSalida(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary">
              {guardando ? 'Despachando...' : 'Registrar Despacho'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM ELIMINAR ENTRADA */}
      <Confirm
        open={!!delEntrada}
        mensaje={`¿Eliminar el registro de compra de ${delEntrada?.cantidad}L de ${delEntrada?.combustible}?`}
        onConfirm={handleEliminarEntrada}
        onCancel={() => setDelEntrada(null)}
      />

      {/* CONFIRM ELIMINAR SALIDA */}
      <Confirm
        open={!!delSalida}
        mensaje={`¿Eliminar el registro de despacho de ${delSalida?.cantidad}L de ${delSalida?.combustible} a ${delSalida?.seriePlaca}?`}
        onConfirm={handleEliminarSalida}
        onCancel={() => setDelSalida(null)}
      />
    </div>
  )
}
