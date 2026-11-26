import { traducirAlChino } from '../services/traduccion'
import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { db } from '../services/firebase'
import { registrarAccion } from '../services/auditoria'
import {
  collection, addDoc, updateDoc, getDocs, doc, deleteDoc,
  query, orderBy, serverTimestamp, increment, onSnapshot, writeBatch, runTransaction
} from 'firebase/firestore'
import { PageLoader } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { Confirm } from '../components/ui/Confirm'
import {
  ShoppingCart, Plus, Edit2, Trash2, Search,
  RefreshCw, Package, TrendingDown, Download, History,
  ClipboardList, PackageMinus, PackagePlus, Printer
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

const CATEGORIAS_COMPRA = [
  { es: 'Materiales de oficina', zh: '办公用品' },
  { es: 'Insumos administrativos', zh: '行政耗材' },
  { es: 'Herramientas', zh: '五金工具' },
  { es: 'Limpieza e higiene', zh: '清洁保洁' },
  { es: 'Otros', zh: '其他' },
]

const AREAS = [
  { es: 'Administración', zh: '行政部' },
  { es: 'Almacén', zh: '仓库部' },
  { es: 'Gerencia', zh: '总经理室' },
  { es: 'Mantenimiento', zh: '维修维保' },
  { es: 'Taller Mecánico', zh: '机修车间' },
  { es: 'Ventas', zh: '销售部' },
  { es: 'Contabilidad', zh: '财务部' },
  { es: 'General', zh: '综合部' },
]

const UNIDADES_FORM = [
  { val: 'UNIDAD', zh: '个/件' },
  { val: 'PIEZA', zh: '件' },
  { val: 'CAJA', zh: '箱' },
  { val: 'PAQUETE', zh: '包' },
  { val: 'RESMA', zh: '令' },
  { val: 'LITRO', zh: '升' },
  { val: 'GALÓN', zh: '加仑' },
  { val: 'BALDE', zh: '桶' },
  { val: 'KILOGRAMO', zh: '公斤' },
  { val: 'GRAMO', zh: '克' },
  { val: 'ROLLO', zh: '卷' },
  { val: 'PAR', zh: '双/对' },
  { val: 'JUEGO', zh: '套' },
  { val: 'BOLSA', zh: '袋' },
  { val: 'METRO', zh: '米' },
  { val: 'HORA', zh: '小时' },
  { val: 'TORNILLO', zh: '螺丝' },
  { val: 'OTRO', zh: '其他' },
]

const MAX_FILAS_FORM = 8

// ── Generador de numeración correlativa ────────────────────────────────
// Los tres formularios (Solicitud de Compra, Salida de Insumos e Ingreso de
// Material) usan numeración correlativa simple (1, 2, 3...), cada uno con
// su propio contador independiente en Firestore, para que no se mezclen ni
// se salten números entre sí.
async function generarNumeroSecuencial(nombreContador, padding = 4) {
  const refContador = doc(db, 'contadores', nombreContador)
  const seq = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(refContador)
    const actual = snap.exists() ? (snap.data().ultimo || 0) : 0
    const siguiente = actual + 1
    transaction.set(refContador, { ultimo: siguiente }, { merge: true })
    return siguiente
  })
  return String(seq).padStart(padding, '0')
}

const obtenerNumeroSolicitudCompra = async () => (await generarNumeroSecuencial('comprasSolicitud', 4)) + '-SC'
const obtenerNumeroSalidaInsumos   = async () => (await generarNumeroSecuencial('comprasSalidaInsumos', 4)) + '-SI'
const obtenerNumeroIngresoMaterial = async () => (await generarNumeroSecuencial('comprasIngresoMaterial', 4)) + '-IM'

// ── Impresión genérica bilingüe (mismo estilo que Orden de Salida) ─────
function imprimirFormularioGenerico(cfg) {
  const {
    tituloEs, tituloZh, numero, fecha, departamento, solicitante, entregadoPor,
    incluyeModelo, incluyeEntregadoPor, filas, montoTotal,
    firmaIzqEs, firmaIzqZh, firmaDerEs, firmaDerZh,
  } = cfg

  const fechaFmt = fecha ? format(new Date(fecha + 'T00:00:00'), 'dd/MM/yyyy') : ''
  const filasValidas = filas.filter(f => f.descripcion || f.cantidad)
  const filasHTML = filasValidas.map((f, i) => `
    <tr>
      <td style="text-align:center;border:1px solid #aaa;padding:2px 4px">${i + 1}</td>
      <td style="border:1px solid #aaa;padding:2px 4px">${f.descripcion || ''}</td>
      <td style="border:1px solid #aaa;padding:2px 4px">${f.descripcionZh || ''}</td>
      ${incluyeModelo ? `<td style="border:1px solid #aaa;padding:2px 4px">${f.modelo || ''}</td>` : ''}
      <td style="text-align:center;border:1px solid #aaa;padding:2px 4px">${f.unidad || ''}</td>
      <td style="text-align:center;border:1px solid #aaa;padding:2px 4px">${f.cantidad || ''}</td>
      <td style="text-align:center;border:1px solid #aaa;padding:2px 4px">${f.precio || ''}</td>
      <td style="text-align:center;border:1px solid #aaa;padding:2px 4px">${((Number(f.cantidad) || 0) * (Number(f.precio) || 0)) || ''}</td>
      <td style="border:1px solid #aaa;padding:2px 4px">${f.observaciones || ''}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${tituloEs} ${numero}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Noto Sans SC','Microsoft YaHei',Arial,sans-serif; font-size:9pt; color:#111; padding:12mm; }
.header { display:flex; align-items:center; gap:10px; margin-bottom:6px; border-bottom:2px solid #16241F; padding-bottom:6px; }
.logo { width:56px; height:56px; border-radius:8px; overflow:hidden; border:1px solid #16241F; display:flex; align-items:center; justify-content:center; flex-shrink:0; background:#FDE200; }
.logo img { width:100%; height:100%; object-fit:cover; }
.htxt { flex:1; text-align:center; }
.empresa { font-size:16pt; font-weight:700; color:#16241F; }
.titzh { font-size:12pt; font-weight:700; margin-top:3px; color:#16241F; }
.tites { font-size:8.5pt; color:#233830; }
.campos { margin:6px 0; }
.row-campo { display:flex; gap:20px; margin-bottom:4px; font-size:8.5pt; }
.campo { display:flex; align-items:center; gap:4px; flex:1; }
.campo b { white-space:nowrap; font-size:8pt; }
.val { border-bottom:1px solid #777; flex:1; padding:1px 3px; min-height:13px; }
table { width:100%; border-collapse:collapse; margin:6px 0; font-size:8.5pt; }
th { background:#E2E7E4; border:1px solid #888; padding:3px 4px; text-align:center; font-weight:700; white-space:pre-line; line-height:1.4; color:#16241F; }
td { border:1px solid #aaa; padding:2px 4px; height:15px; }
.total-row td { font-weight:700; background:#f2f2f2; }
.firmas { display:flex; border:1px solid #999; margin-top:10px; }
.fc { flex:1; border-right:1px solid #999; padding:8px; font-size:8pt; }
.fc:last-child { border-right:none; }
.lf { border-bottom:1px solid #aaa; margin:16px 0 2px 0; }
.lbl { font-weight:700; margin-top:4px; }
@page { size: landscape; size: A4 landscape; margin: 8mm; }
@media print { body{padding:0} }
</style></head><body>
<div class="header">
  <div class="logo"><img src="${window.location.origin}/logo-sajama.jpg" alt="Sajama 4x4" /></div>
  <div class="htxt">
    <div class="empresa">Sajama.SRL &nbsp; 萨哈马</div>
    <div class="titzh">${tituloZh || ''}</div>
    <div class="tites">${tituloEs}</div>
  </div>
</div>
<div class="campos">
  <div class="row-campo">
    <div class="campo"><b>Departamento:</b><span class="val">${departamento || ''}</span></div>
    <div class="campo"><b>N° / 编号:</b><span class="val">${numero}</span></div>
  </div>
  <div class="row-campo">
    <div class="campo"><b>Solicitante:</b><span class="val">${solicitante || ''}</span></div>
    <div class="campo"><b>Fecha:</b><span class="val">${fechaFmt}</span></div>
  </div>
  ${incluyeEntregadoPor ? `<div class="row-campo"><div class="campo"><b>Entregado por:</b><span class="val">${entregadoPor || ''}</span></div></div>` : ''}
</div>
<table>
  <thead><tr>
    <th style="width:5%">Ítem<br/>序号</th>
    <th style="width:22%">Descripción del material<br/>材料描述</th>
    <th style="width:14%">Nombre en Chino<br/>中文名称</th>
    ${incluyeModelo ? `<th style="width:10%">Modelo<br/>型号</th>` : ''}
    <th style="width:7%">Unidad<br/>单位</th>
    <th style="width:7%">Cantidad<br/>数量</th>
    <th style="width:9%">Precio U(Bs)<br/>价格</th>
    <th style="width:9%">Total(Bs)<br/>总价</th>
    <th>Observaciones<br/>备注</th>
  </tr></thead>
  <tbody>
    ${filasHTML}
    <tr class="total-row">
      <td colspan="${incluyeModelo ? 6 : 5}" style="text-align:right;padding-right:8px">Monto Total 合计金额 (Bs):</td>
      <td colspan="2" style="text-align:center">${montoTotal.toLocaleString()}</td>
      <td></td>
    </tr>
  </tbody>
</table>
<div class="firmas">
  <div class="fc"><div class="lbl">${firmaIzqEs}</div><div>${firmaIzqZh || ''}</div><div class="lf"></div></div>
  <div class="fc"><div class="lbl">${firmaDerEs}</div><div>${firmaDerZh || ''}</div><div class="lf"></div></div>
</div>
<script>
window.onload = () => {
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => setTimeout(() => window.print(), 150));
  } else {
    setTimeout(() => window.print(), 600);
  }
};
<\/script>
</body></html>`

  const w = window.open('', '_blank', 'width=1100,height=750')
  w.document.write(html)
  w.document.close()
}

// ── Formulario genérico reutilizado por las 3 modalidades (crear o editar) ──
function FormularioGenerico({
  titulo, tituloZh, coleccion, generarNumero, incluyeModelo, incluyeEntregadoPor,
  firmaIzqEs, firmaIzqZh, firmaDerEs, firmaDerZh, perfil, onGuardado,
  registroExistente, // si viene, el formulario abre en modo edición
}) {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const docIdRef = useRef(registroExistente?.id || null)
  const numRef   = useRef(registroExistente?.numero || '')

  const [numero, setNumero]             = useState(registroExistente?.numero || '')
  const [fecha, setFecha]               = useState(registroExistente?.fecha || format(new Date(), 'yyyy-MM-dd'))
  const [departamento, setDepartamento] = useState(registroExistente?.departamento || '')
  const [solicitante, setSolicitante]   = useState(registroExistente?.solicitante || perfil?.nombre || '')
  const [entregadoPor, setEntregadoPor] = useState(registroExistente?.entregadoPor || '')
  const [guardando, setGuardando]       = useState(false)
  const timersRef = useRef({})

  const filaVacia = () => ({ descripcion:'', descripcionZh:'', modelo:'', unidad:'', cantidad:'', precio:'', observaciones:'' })

  const filasIniciales = () => {
    if (registroExistente?.filas?.length) {
      const copia = registroExistente.filas.map(f => ({ ...filaVacia(), ...f }))
      while (copia.length < MAX_FILAS_FORM) copia.push(filaVacia())
      return copia
    }
    return Array.from({ length: MAX_FILAS_FORM }, filaVacia)
  }

  const [filas, setFilas] = useState(filasIniciales)

  useEffect(() => {
    // Solo genera número nuevo si es un formulario NUEVO (sin registro existente)
    if (!registroExistente) {
      generarNumero().then(n => { numRef.current = n; setNumero(n) }).catch(() => setNumero('ERROR'))
    }
  }, [])

  const actualizarFila = (idx, campo, valor) => {
    setFilas(prev => { const n = [...prev]; n[idx] = { ...n[idx], [campo]: valor }; return n })

    // Autotraducir la descripción al chino (con debounce, igual que en Inventario/FormItem)
    if (campo === 'descripcion') {
      clearTimeout(timersRef.current[idx])
      if (valor.trim().length < 3) return
      timersRef.current[idx] = setTimeout(async () => {
        const zh = await traducirAlChino(valor)
        if (zh) {
          setFilas(prev => {
            const n = [...prev]
            // Solo autocompleta si el campo chino sigue vacío (no pisa una edición manual)
            if (!n[idx]?.descripcionZh) n[idx] = { ...n[idx], descripcionZh: zh }
            return n
          })
        }
      }, 900)
    }
  }

  const montoTotal = filas.reduce((acc, f) => acc + ((Number(f.cantidad) || 0) * (Number(f.precio) || 0)), 0)

  const guardar = async () => {
    const filasValidas = filas.filter(f => f.descripcion || f.cantidad)
    if (filasValidas.length === 0) { toast.error(isZh ? '请至少添加一项物料' : 'Agrega al menos un ítem'); return }
    setGuardando(true)
    try {
      const payload = {
        numero: numRef.current, fecha, departamento, solicitante,
        ...(incluyeEntregadoPor ? { entregadoPor } : {}),
        filas: filasValidas.map(f => ({ ...f, total: (Number(f.cantidad) || 0) * (Number(f.precio) || 0) })),
        montoTotal, estado: 'emitido',
      }

      if (docIdRef.current) {
        // Edición: actualiza el documento existente
        await updateDoc(doc(db, coleccion, docIdRef.current), {
          ...payload,
          actualizadoPor: perfil?.nombre, actualizadoEn: serverTimestamp(),
        })
        await registrarAccion({
          usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Compras', accion: 'EDITAR',
          detalle: `${titulo} N° ${numRef.current}: actualizado — ${filasValidas.length} ítem(s), ${montoTotal} Bs`,
        })
        toast.success(isZh ? `${tituloZh || titulo} 更新成功` : `${titulo} actualizado correctamente`)
      } else {
        // Creación nueva
        const ref = await addDoc(collection(db, coleccion), {
          ...payload,
          creadoPor: perfil?.nombre, creadoEn: serverTimestamp(),
        })
        docIdRef.current = ref.id
        await registrarAccion({
          usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Compras', accion: 'CREAR',
          detalle: `${titulo} N° ${numRef.current}: ${filasValidas.length} ítem(s) — ${montoTotal} Bs`,
        })
        toast.success(isZh ? `${tituloZh || titulo} 保存成功` : `${titulo} guardado correctamente`)
      }
      onGuardado?.()
    } catch (e) { toast.error((isZh ? '错误: ' : 'Error: ') + e.message) }
    setGuardando(false)
  }

  const imprimir = () => {
    imprimirFormularioGenerico({
      tituloEs: titulo, tituloZh, numero: numRef.current, fecha, departamento, solicitante, entregadoPor,
      incluyeModelo, incluyeEntregadoPor, filas, montoTotal,
      firmaIzqEs, firmaIzqZh, firmaDerEs, firmaDerZh,
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">{isZh ? '部门 / 领用科室' : 'Departamento'}</label>
          <select className="input" value={departamento} onChange={e => setDepartamento(e.target.value)}>
            <option value="">{isZh ? '请选择部门...' : 'Seleccionar...'}</option>
            {AREAS.map(a => <option key={a.es} value={a.es}>{isZh ? a.zh : a.es}</option>)}
          </select>
        </div>
        <div><label className="label">{isZh ? '申请 / 登记单号' : 'N° de solicitud'}</label>
          <input className="input font-mono" value={numero} placeholder={isZh ? '保存时自动生成' : 'Se asignará al guardar'} readOnly/>
        </div>
        <div><label className="label">{isZh ? '申请人 / 经手人' : 'Solicitante'}</label>
          <input className="input" value={solicitante} onChange={e => setSolicitante(e.target.value)}/>
        </div>
        <div><label className="label">{isZh ? '业务日期' : 'Fecha'}</label>
          <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)}/>
        </div>
        {incluyeEntregadoPor && (
          <div className="col-span-2"><label className="label">{isZh ? '发放人 / 交付责任人' : 'Entregado por'}</label>
            <input className="input" value={entregadoPor} onChange={e => setEntregadoPor(e.target.value)}/>
          </div>
        )}
      </div>

      {registroExistente && (
        <div className="bg-[#EEF2F0] border border-[#CBD4CF] rounded-lg px-3 py-2 text-sm text-[#16241F]">
          {isZh ? `✏️ 正在编辑已有单据 N° ${numero}。保存后将直接更新此记录。` : `✏️ Editando registro existente N° ${numero}. Al guardar se actualizará este mismo documento.`}
        </div>
      )}

      <div className="overflow-x-auto border border-[#E2E7E4] rounded-xl">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#F4F6F5]">
              <th className="th w-8 text-center">{isZh ? '序号' : '#'}</th>
              <th className="th">{isZh ? '物料描述 (西文)' : 'Descripción'}</th>
              <th className="th">{isZh ? '中文名称' : 'Nombre Chino'}</th>
              {incluyeModelo && <th className="th">{isZh ? '规格型号' : 'Modelo'}</th>}
              <th className="th">{isZh ? '单位' : 'Unidad'}</th>
              <th className="th w-16">{isZh ? '数量' : 'Cant.'}</th>
              <th className="th w-20">{isZh ? '单价' : 'Precio U.'}</th>
              <th className="th w-20">{isZh ? '合计' : 'Total'}</th>
              <th className="th">{isZh ? '备注' : 'Obs.'}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="td p-1 text-center text-gray-400">{idx + 1}</td>
                <td className="td p-1"><input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.descripcion} onChange={e => actualizarFila(idx, 'descripcion', e.target.value)}/></td>
                <td className="td p-1"><input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.descripcionZh} onChange={e => actualizarFila(idx, 'descripcionZh', e.target.value)}/></td>
                {incluyeModelo && (
                  <td className="td p-1"><input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.modelo} onChange={e => actualizarFila(idx, 'modelo', e.target.value)}/></td>
                )}
                <td className="td p-1">
                  <select className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.unidad} onChange={e => actualizarFila(idx, 'unidad', e.target.value)}>
                    <option value="">—</option>
                    {UNIDADES_FORM.map(u => <option key={u.val} value={u.val}>{isZh ? `${u.val} (${u.zh})` : u.val}</option>)}
                  </select>
                </td>
                <td className="td p-1"><input type="number" min="0" className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 text-center focus:outline-none" value={f.cantidad} onChange={e => actualizarFila(idx, 'cantidad', e.target.value)}/></td>
                <td className="td p-1"><input type="number" min="0" step="0.01" className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 text-center focus:outline-none" value={f.precio} onChange={e => actualizarFila(idx, 'precio', e.target.value)}/></td>
                <td className="td p-1 text-center font-semibold text-primary">
                  {((Number(f.cantidad) || 0) * (Number(f.precio) || 0)) || '—'}
                </td>
                <td className="td p-1"><input className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" value={f.observaciones} onChange={e => actualizarFila(idx, 'observaciones', e.target.value)}/></td>
              </tr>
            ))}
            <tr className="bg-gray-50">
              <td colSpan={incluyeModelo ? 6 : 5} className="td text-right font-bold text-xs pr-3">{isZh ? '合计金额 (Bs):' : 'Monto Total (Bs):'}</td>
              <td colSpan={2} className="td text-center font-bold text-primary">{montoTotal.toLocaleString()}</td>
              <td className="td"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button onClick={imprimir} className="btn-secondary btn-sm"><Printer size={14}/> {isZh ? '打印' : 'Imprimir'}</button>
        <button onClick={guardar} disabled={guardando} className="btn-primary">
          {guardando ? (isZh ? '正在保存...' : 'Guardando...') : (registroExistente ? (isZh ? '更新' : 'Actualizar') : (isZh ? '保存' : 'Guardar'))}
        </button>
      </div>
    </div>
  )
}

// ── Formulario de artículo (edición, se mantiene) ──────────────────────
function FormArticulo({ item, onGuardar, onCancelar }) {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm()
  useEffect(() => {
    if (item) reset(item)
    else reset({ nombre:'', categoria:'Materiales de oficina', unidad:'unidad', stockMin:1, precio:0, notas:'' })
  }, [item, reset])
  return (
    <form onSubmit={handleSubmit(onGuardar)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">{isZh ? '物料名称 *' : 'Nombre del artículo *'}</label>
          <input className="input" placeholder={isZh ? '例如: A4复印纸' : 'Ej: Resma de papel A4'}
            {...register('nombre', { required: isZh ? '必填项' : 'Requerido' })} />
          {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
        </div>
        <div>
          <label className="label">{isZh ? '物料类别 *' : 'Categoría *'}</label>
          <select className="input" {...register('categoria', { required: isZh ? '必填项' : 'Requerido' })}>
            {CATEGORIAS_COMPRA.map(c => <option key={c.es} value={c.es}>{isZh ? c.zh : c.es}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">{isZh ? '计量单位' : 'Unidad'}</label>
          <select className="input" {...register('unidad')}>
            {['unidad','caja','paquete','resma','litro','kg','rollo','par','juego'].map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{isZh ? '预警库存' : 'Stock mínimo'}</label>
          <input className="input" type="number" min="0"
            {...register('stockMin', { valueAsNumber: true })} />
        </div>
        <div>
          <label className="label">{isZh ? '单价 (Bs)' : 'Precio unitario (Bs)'}</label>
          <input className="input" type="number" step="0.01" min="0"
            {...register('precio', { valueAsNumber: true })} />
        </div>
      </div>
      <div>
        <label className="label">{isZh ? '备注说明' : 'Notas'}</label>
        <textarea className="input resize-none" rows={2} {...register('notas')} />
      </div>
      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancelar} className="btn-secondary">{isZh ? '取消' : 'Cancelar'}</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? (isZh ? '正在保存...' : 'Guardando...') : item ? (isZh ? '更新' : 'Actualizar') : (isZh ? '创建物料' : 'Crear artículo')}
        </button>
      </div>
    </form>
  )
}

// ── Formulario de salida/asignación (se mantiene) ───────────────────────
function FormSalida({ articulo, onGuardar, onCancelar }) {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()
  return (
    <form onSubmit={handleSubmit(onGuardar)} className="space-y-4">
      <div className="bg-warning-pale rounded-lg p-3 text-sm text-warning">
        <b>{articulo?.nombre}</b> · {isZh ? '当前可用库存:' : 'Stock disponible:'} <b>{articulo?.stock ?? 0} {articulo?.unidad}</b>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">{isZh ? '领用出库数量 *' : 'Cantidad *'}</label>
          <input className="input" type="number" min="1" max={articulo?.stock}
            {...register('cantidad', { required: isZh ? '必填项' : 'Requerido', min: 1, valueAsNumber: true })} />
          {errors.cantidad && <p className="text-red-500 text-xs mt-1">{errors.cantidad.message}</p>}
        </div>
        <div>
          <label className="label">{isZh ? '领用部门 / 去向 *' : 'Asignado a *'}</label>
          <select className="input" {...register('asignadoA', { required: isZh ? '必填项' : 'Requerido' })}>
            <option value="">{isZh ? '请选择...' : 'Seleccionar...'}</option>
            {AREAS.map(a => <option key={a.es} value={a.es}>{isZh ? a.zh : a.es}</option>)}
          </select>
          {errors.asignadoA && <p className="text-red-500 text-xs mt-1">{errors.asignadoA.message}</p>}
        </div>
      </div>
      <div>
        <label className="label">{isZh ? '领用责任人' : 'Persona responsable'}</label>
        <input className="input" placeholder={isZh ? '接收人物料签收姓名' : 'Nombre de quien recibe'} {...register('persona')} />
      </div>
      <div>
        <label className="label">{isZh ? '备注说明' : 'Observaciones'}</label>
        <textarea className="input resize-none" rows={2} {...register('observaciones')} />
      </div>
      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancelar} className="btn-secondary">{isZh ? '取消' : 'Cancelar'}</button>
        <button type="submit" disabled={isSubmitting} className="btn-warning">
          {isSubmitting ? (isZh ? '正在登记...' : 'Registrando...') : (isZh ? '确认发放领用' : 'Confirmar asignación')}
        </button>
      </div>
    </form>
  )
}

// ── Página principal ──────────────────────────────────────────────────
export default function Compras() {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const { perfil } = useAuth()
  const [articulos,    setArticulos]    = useState([])
  const [movimientos,  setMovimientos]  = useState([])
  const [solicitudes,       setSolicitudes]       = useState([])
  const [salidasInsumos,    setSalidasInsumos]    = useState([])
  const [ingresosMaterial,  setIngresosMaterial]  = useState([])
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState('catalogo')
  const [busqueda,     setBusqueda]     = useState('')
  const [catFiltro,    setCat]          = useState('')
  const [modalArt,     setModalArt]     = useState(false)
  const [modalSalida,  setModalSalida]  = useState(false)

  const [modalSolicitud,      setModalSolicitud]      = useState(false)
  const [modalSalidaInsumos,  setModalSalidaInsumos]  = useState(false)
  const [modalIngreso,        setModalIngreso]        = useState(false)

  // Registro en edición para cada tipo de formulario (null = modo "nuevo")
  const [editSolicitud,      setEditSolicitud]      = useState(null)
  const [editSalidaInsumos,  setEditSalidaInsumos]  = useState(null)
  const [editIngreso,        setEditIngreso]        = useState(null)

  const [editArt,      setEditArt]      = useState(null)
  const [delArt,       setDelArt]       = useState(null)
  const [artSalida,    setArtSalida]    = useState(null)

  useEffect(() => {
    const unsubA = onSnapshot(
      query(collection(db, 'compras_articulos'), orderBy('nombre')),
      snap => { setArticulos(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) }
    )
    const unsubM = onSnapshot(
      query(collection(db, 'compras_movimientos'), orderBy('creadoEn', 'desc')),
      snap => setMovimientos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    const unsubS = onSnapshot(
      query(collection(db, 'compras_solicitudes'), orderBy('creadoEn', 'desc')),
      snap => setSolicitudes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    const unsubSI = onSnapshot(
      query(collection(db, 'compras_salidas_insumos'), orderBy('creadoEn', 'desc')),
      snap => setSalidasInsumos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    const unsubIM = onSnapshot(
      query(collection(db, 'compras_ingresos_material'), orderBy('creadoEn', 'desc')),
      snap => setIngresosMaterial(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => { unsubA(); unsubM(); unsubS(); unsubSI(); unsubIM() }
  }, [])

  const guardarArticulo = async (data) => {
    try {
      if (editArt) {
        await updateDoc(doc(db, 'compras_articulos', editArt.id), {
          ...data, actualizadoEn: serverTimestamp(), actualizadoPor: perfil?.nombre
        })
        await registrarAccion({ usuario: perfil?.nombre, rol: perfil?.rol,
          modulo: 'Compras', accion: 'EDITAR', detalle: `Editó artículo: ${data.nombre}` })
        toast.success(isZh ? '物料更新成功' : 'Artículo actualizado')
      }
      setModalArt(false); setEditArt(null)
    } catch(e) { toast.error((isZh ? '错误: ' : 'Error: ') + e.message) }
  }

  const eliminarArticulo = async () => {
    try {
      await deleteDoc(doc(db, 'compras_articulos', delArt.id))
      await registrarAccion({ usuario: perfil?.nombre, rol: perfil?.rol,
        modulo: 'Compras', accion: 'ELIMINAR', detalle: `Eliminó artículo: ${delArt.nombre}` })
      toast.success(isZh ? '物料删除成功' : 'Artículo eliminado')
      setDelArt(null)
    } catch(e) { toast.error(isZh ? '删除失败' : 'Error al eliminar') }
  }

  const registrarAsignacion = async (data) => {
    try {
      if (data.cantidad > (artSalida?.stock || 0)) {
        toast.error(isZh ? '库存不足' : 'Stock insuficiente'); return
      }
      const batch = writeBatch(db)
      const movRef = doc(collection(db, 'compras_movimientos'))
      batch.set(movRef, {
        tipo: 'asignacion', articuloId: artSalida.id,
        articuloNombre: artSalida.nombre, articuloCategoria: artSalida.categoria,
        cantidad: data.cantidad, asignadoA: data.asignadoA,
        persona: data.persona || '', observaciones: data.observaciones || '',
        fecha: format(new Date(), 'yyyy-MM-dd'),
        creadoPor: perfil?.nombre, creadoEn: serverTimestamp(),
      })
      batch.update(doc(db, 'compras_articulos', artSalida.id), {
        stock: increment(-data.cantidad),
        totalAsignado: increment(data.cantidad),
        actualizadoEn: serverTimestamp(),
      })
      await batch.commit()

      await registrarAccion({ usuario: perfil?.nombre, rol: perfil?.rol,
        modulo: 'Compras', accion: 'APROBAR',
        detalle: `Asignación: ${data.cantidad} x ${artSalida.nombre} → ${data.asignadoA} (${data.persona || ''})` })

      toast.success(isZh ? `已成功分派: ${data.cantidad} x ${artSalida.nombre} → ${data.asignadoA}` : `Asignado: ${data.cantidad} x ${artSalida.nombre} → ${data.asignadoA}`)
      setModalSalida(false); setArtSalida(null)
    } catch(e) { toast.error((isZh ? '错误: ' : 'Error: ') + e.message) }
  }

  const exportarExcel = () => {
    const datos = movimientos.map(m => ({
      [isZh ? '类型' : 'Tipo']:        m.tipo === 'compra' ? (isZh ? '采购' : 'Compra') : (isZh ? '领用' : 'Asignación'),
      [isZh ? '物料' : 'Artículo']:    m.articuloNombre,
      [isZh ? '类别' : 'Categoría']:   m.articuloCategoria,
      [isZh ? '数量' : 'Cantidad']:    m.cantidad,
      [isZh ? '单价' : 'Precio unit.']:m.precioUnitario || '',
      [isZh ? '总额 Bs' : 'Total Bs']:  m.totalBs || '',
      [isZh ? '供应商' : 'Proveedor']: m.proveedor || '',
      [isZh ? '去向部门' : 'Asignado a']:m.asignadoA || '',
      [isZh ? '经办人' : 'Persona']:   m.persona || '',
      [isZh ? '日期' : 'Fecha']:       m.fecha || '',
      [isZh ? '登记人' : 'Registrado por']: m.creadoPor,
    }))
    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Compras')
    XLSX.writeFile(wb, `Compras_SAJAMA_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const totalGastado    = movimientos.filter(m => m.tipo === 'compra').reduce((a,m) => a + (m.totalBs||0), 0)
  const totalArticulos  = articulos.length
  const sinStock        = articulos.filter(a => !a.stock || a.stock === 0).length
  const stockBajo       = articulos.filter(a => a.stockMin && a.stock > 0 && a.stock <= a.stockMin).length

  const artFiltrados = articulos.filter(a => {
    const q = busqueda.toLowerCase()
    return (!q || a.nombre?.toLowerCase().includes(q)) &&
           (!catFiltro || a.categoria === catFiltro)
  })

  const canEdit = ['administrador','gerencia','almacenero'].includes(perfil?.rol)

  const reimprimir = (registro, incluyeModelo, incluyeEntregadoPor, tituloEs, tituloZh, firmaIzqEs, firmaIzqZh, firmaDerEs, firmaDerZh) => {
    imprimirFormularioGenerico({
      tituloEs, tituloZh, numero: registro.numero, fecha: registro.fecha,
      departamento: registro.departamento, solicitante: registro.solicitante,
      entregadoPor: registro.entregadoPor, incluyeModelo, incluyeEntregadoPor,
      filas: registro.filas || [], montoTotal: registro.montoTotal || 0,
      firmaIzqEs, firmaIzqZh, firmaDerEs, firmaDerZh,
    })
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="flex items-center gap-2">
            <ShoppingCart size={22} className="text-warning"/> {isZh ? '采购与物料管理' : 'Compras y Materiales'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isZh ? '办公用品、五金工具及行政物资领用与入库综合管理' : 'Gestión de materiales de oficina, herramientas e insumos administrativos'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportarExcel} className="btn-secondary btn-sm">
            <Download size={14}/> {isZh ? '导出Excel' : 'Exportar'}
          </button>
          {canEdit && <>
            <button onClick={() => { setEditSolicitud(null); setModalSolicitud(true) }} className="btn-warning btn-sm">
              <ClipboardList size={14}/> {isZh ? '采购申请单' : 'Solicitud de Compra'}
            </button>
            <button onClick={() => { setEditSalidaInsumos(null); setModalSalidaInsumos(true) }} className="btn-secondary btn-sm">
              <PackageMinus size={14}/> {isZh ? '材料出库单' : 'Salida de Insumos'}
            </button>
            <button onClick={() => { setEditIngreso(null); setModalIngreso(true) }} className="btn-primary btn-sm">
              <PackagePlus size={14}/> {isZh ? '材料入库单' : 'Ingreso de Material'}
            </button>
          </>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: isZh ? '物料品类总数' : 'Total artículos',  val: totalArticulos,                        color:'bg-primary-pale text-primary' },
          { label: isZh ? '采购支出总计 (Bs)' : 'Gasto total (Bs)', val: totalGastado.toLocaleString() + ' Bs', color:'bg-warning-pale text-warning' },
          { label: isZh ? '缺货 / 断货' : 'Sin stock',        val: sinStock,                              color:'bg-red-50 text-red-700'       },
          { label: isZh ? '库存预警' : 'Stock bajo',       val: stockBajo,                             color:'bg-yellow-50 text-yellow-700' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl p-4 ${k.color}`}>
            <p className="text-2xl font-bold">{k.val}</p>
            <p className="text-xs font-medium mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {[
          { key:'catalogo',           label: isZh ? '物资目录' : 'Catálogo',        icon: Package      },
          { key:'solicitudes',        label: isZh ? '采购申请' : 'Solicitudes',     icon: ClipboardList},
          { key:'salidas_insumos',    label: isZh ? '材料出库' : 'Salidas Insumos', icon: PackageMinus },
          { key:'ingresos_material',  label: isZh ? '材料入库' : 'Ingresos',        icon: PackagePlus  },
          { key:'compras',            label: isZh ? '采购历史' : 'Compras (hist.)', icon: ShoppingCart },
          { key:'asignaciones',       label: isZh ? '领用分派' : 'Asignaciones',    icon: TrendingDown },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon size={15}/> {label}
          </button>
        ))}
      </div>

      {tab === 'catalogo' && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap gap-3">
            <div className="flex-1 min-w-48 relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input className="input pl-9" placeholder={isZh ? '搜索物料名称...' : 'Buscar artículo...'}
                value={busqueda} onChange={e => setBusqueda(e.target.value)}/>
            </div>
            <select className="input w-auto" value={catFiltro} onChange={e => setCat(e.target.value)}>
              <option value="">{isZh ? '全部物料类别' : 'Todas las categorías'}</option>
              {CATEGORIAS_COMPRA.map(c => <option key={c.es} value={c.es}>{isZh ? c.zh : c.es}</option>)}
            </select>
            {(busqueda || catFiltro) && (
              <button onClick={() => { setBusqueda(''); setCat('') }} className="btn-secondary btn-sm">
                <RefreshCw size={13}/> {isZh ? '清空' : 'Limpiar'}
              </button>
            )}
          </div>

          <div className="card p-0 overflow-hidden">
            {artFiltrados.length === 0 ? <EmptyState mensaje={isZh ? '暂无物料记录' : 'No hay artículos registrados'}/> : (
              <div className="overflow-x-auto">
                <table className="table-auto w-full">
                  <thead><tr>
                    {[isZh ? '物料名称' : 'Artículo', isZh ? '类别' : 'Categoría', isZh ? '单位' : 'Unidad', isZh ? '库存' : 'Stock', isZh ? '最低库存' : 'Stock mín.', isZh ? '单价 (Bs)' : 'Precio (Bs)', isZh ? '累计领用' : 'Total asignado', isZh ? '操作' : 'Acciones'].map(h => (
                      <th key={h} className="th">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {artFiltrados.map(a => (
                      <tr key={a.id} className="tr-hover">
                        <td className="td font-medium">{a.nombre}</td>
                        <td className="td"><Badge tipo="blue">{CATEGORIAS_COMPRA.find(c => c.es === a.categoria)?.zh && isZh ? CATEGORIAS_COMPRA.find(c => c.es === a.categoria).zh : a.categoria}</Badge></td>
                        <td className="td text-gray-500 text-sm">{a.unidad}</td>
                        <td className="td">
                          {!a.stock || a.stock === 0
                            ? <Badge tipo="red">{isZh ? '缺货' : 'Sin stock'}</Badge>
                            : a.stockMin && a.stock <= a.stockMin
                              ? <Badge tipo="yellow">{a.stock} {a.unidad}</Badge>
                              : <Badge tipo="green">{a.stock} {a.unidad}</Badge>
                          }
                        </td>
                        <td className="td text-gray-500">{a.stockMin ?? '—'}</td>
                        <td className="td">{a.precio ? `${a.precio} Bs` : '—'}</td>
                        <td className="td text-gray-500">{a.totalAsignado ?? 0}</td>
                        <td className="td">
                          {canEdit && (
                            <div className="flex gap-1.5">
                              <button onClick={() => { setArtSalida(a); setModalSalida(true) }}
                                className="p-1.5 rounded-lg hover:bg-warning-pale text-warning transition-colors" title={isZh ? '分派领用' : 'Asignar'}>
                                <TrendingDown size={14}/>
                              </button>
                              <button onClick={() => { setEditArt(a); setModalArt(true) }}
                                className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors" title={isZh ? '编辑' : 'Editar'}>
                                <Edit2 size={14}/>
                              </button>
                              <button onClick={() => setDelArt(a)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title={isZh ? '删除' : 'Eliminar'}>
                                <Trash2 size={14}/>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'solicitudes' && (
        <div className="card p-0 overflow-hidden">
          {solicitudes.length === 0 ? <EmptyState mensaje={isZh ? '暂无采购申请单' : 'No hay solicitudes de compra registradas'}/> : (
            <div className="overflow-x-auto">
              <table className="table-auto w-full">
                <thead><tr>
                  {[isZh ? '单号' : 'N°', isZh ? '日期' : 'Fecha', isZh ? '申请部门' : 'Departamento', isZh ? '申请人' : 'Solicitante', isZh ? '品类数' : 'Ítems', isZh ? '总额 (Bs)' : 'Total Bs', isZh ? '制单人' : 'Por', isZh ? '操作' : 'Acciones'].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {solicitudes.map(s => (
                    <tr key={s.id} className="tr-hover">
                      <td className="td font-mono text-xs">{s.numero}</td>
                      <td className="td text-xs text-gray-500">{s.fecha || '—'}</td>
                      <td className="td"><Badge tipo="blue">{AREAS.find(a => a.es === s.departamento)?.zh && isZh ? AREAS.find(a => a.es === s.departamento).zh : s.departamento}</Badge></td>
                      <td className="td font-medium">{s.solicitante}</td>
                      <td className="td text-gray-500">{s.filas?.length || 0}</td>
                      <td className="td font-bold text-warning">{s.montoTotal?.toLocaleString() || 0} Bs</td>
                      <td className="td text-xs text-gray-400">{s.creadoPor}</td>
                      <td className="td">
                        <div className="flex gap-1.5">
                          {canEdit && (
                            <button onClick={() => { setEditSolicitud(s); setModalSolicitud(true) }}
                              className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors" title={isZh ? '编辑' : 'Editar'}>
                              <Edit2 size={14}/>
                            </button>
                          )}
                          <button onClick={() => reimprimir(s, true, false,
                            'Formulario de Solicitud de Compra Material', 'SAJAMA 4X4 采购申请表',
                            'Solicitado por Gerente de Departamento', '申请部门经理',
                            'Aprobado por Gerente', '重事长/总经理')}
                            className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors" title={isZh ? '重新打印' : 'Reimprimir'}>
                            <Printer size={14}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'salidas_insumos' && (
        <div className="card p-0 overflow-hidden">
          {salidasInsumos.length === 0 ? <EmptyState mensaje={isZh ? '暂无材料出库记录' : 'No hay salidas de insumos registradas'}/> : (
            <div className="overflow-x-auto">
              <table className="table-auto w-full">
                <thead><tr>
                  {[isZh ? '单号' : 'N°', isZh ? '日期' : 'Fecha', isZh ? '领用部门' : 'Departamento', isZh ? '领用人' : 'Solicitante', isZh ? '品类数' : 'Ítems', isZh ? '总额 (Bs)' : 'Total Bs', isZh ? '制单人' : 'Por', isZh ? '操作' : 'Acciones'].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {salidasInsumos.map(s => (
                    <tr key={s.id} className="tr-hover">
                      <td className="td font-mono text-xs">{s.numero}</td>
                      <td className="td text-xs text-gray-500">{s.fecha || '—'}</td>
                      <td className="td"><Badge tipo="blue">{AREAS.find(a => a.es === s.departamento)?.zh && isZh ? AREAS.find(a => a.es === s.departamento).zh : s.departamento}</Badge></td>
                      <td className="td font-medium">{s.solicitante}</td>
                      <td className="td text-gray-500">{s.filas?.length || 0}</td>
                      <td className="td font-bold text-warning">{s.montoTotal?.toLocaleString() || 0} Bs</td>
                      <td className="td text-xs text-gray-400">{s.creadoPor}</td>
                      <td className="td">
                        <div className="flex gap-1.5">
                          {canEdit && (
                            <button onClick={() => { setEditSalidaInsumos(s); setModalSalidaInsumos(true) }}
                              className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors" title={isZh ? '编辑' : 'Editar'}>
                              <Edit2 size={14}/>
                            </button>
                          )}
                          <button onClick={() => reimprimir(s, true, false,
                            'Formulario de Salida de Materiales e Insumos', 'SAJAMA 4X4 材料/服务发布申请批准表',
                            'Solicitado por Gerente de Departamento', '申请部门经理',
                            'Aprobado por Gerente', '董事长/总经理')}
                            className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors" title={isZh ? '重新打印' : 'Reimprimir'}>
                            <Printer size={14}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'ingresos_material' && (
        <div className="card p-0 overflow-hidden">
          {ingresosMaterial.length === 0 ? <EmptyState mensaje={isZh ? '暂无材料入库记录' : 'No hay ingresos de material registrados'}/> : (
            <div className="overflow-x-auto">
              <table className="table-auto w-full">
                <thead><tr>
                  {[isZh ? '单号' : 'N°', isZh ? '日期' : 'Fecha', isZh ? '入库部门' : 'Departamento', isZh ? '接收人' : 'Solicitante', isZh ? '交付人' : 'Entregado por', isZh ? '品类数' : 'Ítems', isZh ? '总额 (Bs)' : 'Total Bs', isZh ? '制单人' : 'Por', isZh ? '操作' : 'Acciones'].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {ingresosMaterial.map(s => (
                    <tr key={s.id} className="tr-hover">
                      <td className="td font-mono text-xs">{s.numero}</td>
                      <td className="td text-xs text-gray-500">{s.fecha || '—'}</td>
                      <td className="td"><Badge tipo="blue">{AREAS.find(a => a.es === s.departamento)?.zh && isZh ? AREAS.find(a => a.es === s.departamento).zh : s.departamento}</Badge></td>
                      <td className="td font-medium">{s.solicitante}</td>
                      <td className="td text-gray-500">{s.entregadoPor || '—'}</td>
                      <td className="td text-gray-500">{s.filas?.length || 0}</td>
                      <td className="td font-bold text-warning">{s.montoTotal?.toLocaleString() || 0} Bs</td>
                      <td className="td text-xs text-gray-400">{s.creadoPor}</td>
                      <td className="td">
                        <div className="flex gap-1.5">
                          {canEdit && (
                            <button onClick={() => { setEditIngreso(s); setModalIngreso(true) }}
                              className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors" title={isZh ? '编辑' : 'Editar'}>
                              <Edit2 size={14}/>
                            </button>
                          )}
                          <button onClick={() => reimprimir(s, false, true,
                            'Formulario de Ingreso de Material', 'SAJAMA 4X4 材料入库单',
                            'Recibido por Encargado de Almacén', '仓库负责人',
                            'Aprobado por Gerente', '董事长/总经理')}
                            className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors" title={isZh ? '重新打印' : 'Reimprimir'}>
                            <Printer size={14}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'compras' && (
        <div className="card p-0 overflow-hidden">
          {movimientos.filter(m => m.tipo === 'compra').length === 0
            ? <EmptyState mensaje={isZh ? '暂无采购记录' : 'No hay compras registradas'}/>
            : (
            <div className="overflow-x-auto">
              <table className="table-auto w-full">
                <thead><tr>
                  {[isZh ? '日期' : 'Fecha', isZh ? '物料' : 'Artículo', isZh ? '类别' : 'Categoría', isZh ? '数量' : 'Cantidad', isZh ? '单价' : 'Precio unit.', isZh ? '总额 (Bs)' : 'Total Bs', isZh ? '供应商' : 'Proveedor', isZh ? '去向部门' : 'Asignado a', isZh ? '经办人' : 'Por'].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {movimientos.filter(m => m.tipo === 'compra').map(m => (
                    <tr key={m.id} className="tr-hover">
                      <td className="td text-xs text-gray-500">{m.fecha || '—'}</td>
                      <td className="td font-medium">{m.articuloNombre}</td>
                      <td className="td"><Badge tipo="blue">{CATEGORIAS_COMPRA.find(c => c.es === m.articuloCategoria)?.zh && isZh ? CATEGORIAS_COMPRA.find(c => c.es === m.articuloCategoria).zh : m.articuloCategoria}</Badge></td>
                      <td className="td font-bold text-success">+{m.cantidad}</td>
                      <td className="td text-gray-500">{m.precioUnitario ? `${m.precioUnitario} Bs` : '—'}</td>
                      <td className="td font-bold text-warning">{m.totalBs ? `${m.totalBs} Bs` : '—'}</td>
                      <td className="td text-gray-500">{m.proveedor || '—'}</td>
                      <td className="td text-gray-500">{AREAS.find(a => a.es === m.asignadoA)?.zh && isZh ? AREAS.find(a => a.es === m.asignadoA).zh : (m.asignadoA || '—')}</td>
                      <td className="td text-xs text-gray-400">{m.creadoPor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'asignaciones' && (
        <div className="card p-0 overflow-hidden">
          {movimientos.filter(m => m.tipo === 'asignacion').length === 0
            ? <EmptyState mensaje={isZh ? '暂无领用记录' : 'No hay asignaciones registradas'}/>
            : (
            <div className="overflow-x-auto">
              <table className="table-auto w-full">
                <thead><tr>
                  {[isZh ? '日期' : 'Fecha', isZh ? '物料' : 'Artículo', isZh ? '类别' : 'Categoría', isZh ? '数量' : 'Cantidad', isZh ? '领用部门' : 'Asignado a', isZh ? '领用人' : 'Persona', isZh ? '备注' : 'Observaciones', isZh ? '经办人' : 'Por'].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {movimientos.filter(m => m.tipo === 'asignacion').map(m => (
                    <tr key={m.id} className="tr-hover">
                      <td className="td text-xs text-gray-500">{m.fecha || '—'}</td>
                      <td className="td font-medium">{m.articuloNombre}</td>
                      <td className="td"><Badge tipo="blue">{CATEGORIAS_COMPRA.find(c => c.es === m.articuloCategoria)?.zh && isZh ? CATEGORIAS_COMPRA.find(c => c.es === m.articuloCategoria).zh : m.articuloCategoria}</Badge></td>
                      <td className="td font-bold text-danger">-{m.cantidad}</td>
                      <td className="td"><Badge tipo="yellow">{AREAS.find(a => a.es === m.asignadoA)?.zh && isZh ? AREAS.find(a => a.es === m.asignadoA).zh : m.asignadoA}</Badge></td>
                      <td className="td text-gray-500">{m.persona || '—'}</td>
                      <td className="td text-xs text-gray-500">{m.observaciones || '—'}</td>
                      <td className="td text-xs text-gray-400">{m.creadoPor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal open={modalArt} onClose={() => { setModalArt(false); setEditArt(null) }}
        title={editArt ? (isZh ? '编辑物料信息' : 'Editar artículo') : (isZh ? '新建物料' : 'Crear artículo')} size="md">
        <FormArticulo item={editArt} onGuardar={guardarArticulo} onCancelar={() => { setModalArt(false); setEditArt(null) }}/>
      </Modal>

      <Modal open={modalSalida} onClose={() => { setModalSalida(false); setArtSalida(null) }}
        title={isZh ? '物资领用 / 分派交付' : 'Asignar / Entregar'} size="md">
        <FormSalida articulo={artSalida} onGuardar={registrarAsignacion}
          onCancelar={() => { setModalSalida(false); setArtSalida(null) }}/>
      </Modal>

      <Modal open={modalSolicitud} onClose={() => { setModalSolicitud(false); setEditSolicitud(null) }}
        title={editSolicitud ? (isZh ? `编辑采购申请单 N° ${editSolicitud.numero}` : `Editar Solicitud de Compra N° ${editSolicitud.numero}`) : (isZh ? "SAJAMA 4X4 采购申请表" : "Formulario de Solicitud de Compra Material")} size="lg">
        <FormularioGenerico
          titulo="Formulario de Solicitud de Compra Material"
          tituloZh="SAJAMA 4X4 采购申请表"
          coleccion="compras_solicitudes"
          generarNumero={obtenerNumeroSolicitudCompra}
          incluyeModelo incluyeEntregadoPor={false}
          firmaIzqEs="Solicitado por Gerente de Departamento" firmaIzqZh="申请部门经理"
          firmaDerEs="Aprobado por Gerente" firmaDerZh="重事长/总经理"
          perfil={perfil}
          registroExistente={editSolicitud}
          onGuardado={() => { setModalSolicitud(false); setEditSolicitud(null) }}
        />
      </Modal>

      <Modal open={modalSalidaInsumos} onClose={() => { setModalSalidaInsumos(false); setEditSalidaInsumos(null) }}
        title={editSalidaInsumos ? (isZh ? `编辑材料出库单 N° ${editSalidaInsumos.numero}` : `Editar Salida de Insumos N° ${editSalidaInsumos.numero}`) : (isZh ? "SAJAMA 4X4 材料/服务发布申请批准表" : "Formulario de Salida de Materiales e Insumos")} size="lg">
        <FormularioGenerico
          titulo="Formulario de Salida de Materiales e Insumos"
          tituloZh="SAJAMA 4X4 材料/服务发布申请批准表"
          coleccion="compras_salidas_insumos"
          generarNumero={obtenerNumeroSalidaInsumos}
          incluyeModelo incluyeEntregadoPor={false}
          firmaIzqEs="Solicitado por Gerente de Departamento" firmaIzqZh="申请部门经理"
          firmaDerEs="Aprobado por Gerente" firmaDerZh="董事长/总经理"
          perfil={perfil}
          registroExistente={editSalidaInsumos}
          onGuardado={() => { setModalSalidaInsumos(false); setEditSalidaInsumos(null) }}
        />
      </Modal>

      <Modal open={modalIngreso} onClose={() => { setModalIngreso(false); setEditIngreso(null) }}
        title={editIngreso ? (isZh ? `编辑材料入库单 N° ${editIngreso.numero}` : `Editar Ingreso de Material N° ${editIngreso.numero}`) : (isZh ? "SAJAMA 4X4 材料入库单" : "Formulario de Ingreso de Material")} size="lg">
        <FormularioGenerico
          titulo="Formulario de Ingreso de Material"
          tituloZh="SAJAMA 4X4 材料入库单"
          coleccion="compras_ingresos_material"
          generarNumero={obtenerNumeroIngresoMaterial}
          incluyeModelo={false} incluyeEntregadoPor
          firmaIzqEs="Recibido por Encargado de Almacén" firmaIzqZh="仓库负责人"
          firmaDerEs="Aprobado por Gerente" firmaDerZh="董事长/总经理"
          perfil={perfil}
          registroExistente={editIngreso}
          onGuardado={() => { setModalIngreso(false); setEditIngreso(null) }}
        />
      </Modal>

      <Confirm open={!!delArt}
        mensaje={isZh ? `确定要删除物料 "${delArt?.nombre}" 吗？其历史记录将丢失。` : `¿Eliminar el artículo "${delArt?.nombre}"? Se perderá su historial.`}
        onConfirm={eliminarArticulo} onCancel={() => setDelArt(null)}/>
    </div>
  )
}
