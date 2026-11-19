import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import {
  suscribirAuditoria,
  ejecutarBackupYPurgaAuditoria,
  verificarYEjecutarBackupSemanalAuto,
  obtenerHistorialBackups
} from '../services/auditoria'
import { PageLoader } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import {
  Search, RefreshCw, Eye, ShieldAlert, FileText, Download,
  Database, Calendar, Filter, Archive, CheckCircle2, Loader2, HardDrive,
  Code, LayoutGrid, CheckSquare, Image as ImageIcon
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const ACCION_COLOR = {
  CREAR:      'green',
  EDITAR:     'blue',
  ELIMINAR:   'red',
  APROBAR:    'green',
  RECHAZAR:   'red',
  LOGIN:      'gray',
  VENTA:      'purple',
  DESPACHADO: 'blue',
  ENTREGADO:  'cyan'
}

const ACCION_ICON = {
  CREAR:      '➕',
  EDITAR:     '✏️',
  ELIMINAR:   '🗑️',
  APROBAR:    '✅',
  RECHAZAR:   '❌',
  LOGIN:      '🔑',
  VENTA:      '🛍️',
  DESPACHADO: '🚚',
  ENTREGADO:  '📦'
}

const ACCION_ZH = {
  CREAR:      '新建',
  EDITAR:     '编辑',
  ELIMINAR:   '删除',
  APROBAR:    '审核通过',
  RECHAZAR:   '拒绝',
  LOGIN:      '登录',
  VENTA:      '销售',
  DESPACHADO: '发运出库',
  ENTREGADO:  '交付完成'
}

const MAPA_ETIQUETAS = {
  codigo: 'Código',
  descripcion: 'Descripción (Español)',
  descripcionZh: 'Descripción en Chino (中文)',
  nombreEs: 'Nombre (Español)',
  nombreZh: 'Nombre en Chino (中文)',
  categoria: 'Categoría',
  ubicacion: 'Ubicación en Almacén',
  stock: 'Cantidad de Stock',
  stockInicial: 'Stock Inicial',
  stockMin: 'Stock Mínimo',
  totalSalidas: 'Total Salidas',
  precio: 'Precio (Bs)',
  precioBs: 'Precio en Bolivianos (Bs)',
  precioUsd: 'Precio en Dólares ($ USD)',
  empresa: 'Empresa Asignada',
  unidad: 'Unidad de Medida',
  modelo: 'Modelo',
  serie: 'N° Serie / Chasis / Placa',
  chasis: 'N° Chasis',
  estado: 'Estado Actual',
  numPoliza: 'N° Póliza de Aduana',
  polizaUrl: 'Documento Póliza PDF',
  fotoUrl: 'Fotografía del Ítem',
  fotoMaquinaUrl: 'Fotografía de la Máquina',
  fotoEquipoUrl: 'Fotografía del Equipo',
  fotoPlacaUrl: 'Foto Placa / Chasis',
  notas: 'Notas / Observaciones',
  observaciones: 'Observaciones',
  compradorNombre: 'Comprador / Razón Social',
  compradorCiNit: 'CI / NIT Comprador',
  compradorTelefono: 'Teléfono Comprador',
  compradorDireccion: 'Dirección Comprador',
  vendedorNombre: 'Vendedor Responsable',
  vendedorTelefono: 'Teléfono Vendedor',
  formaPago: 'Forma de Pago',
  tipoCambioDolar: 'Tipo de Cambio (BCB)',
  montoTotalBs: 'Monto Total (Bs)',
  montoTotalUsd: 'Monto Total ($ USD)',
  fecha: 'Fecha de Operación',
  actualizadoPor: 'Modificado por',
  creadoPor: 'Registrado por'
}

const MAPA_ETIQUETAS_ZH = {
  codigo: '编号/代码',
  descripcion: '西语描述',
  descripcionZh: '中文描述',
  nombreEs: '西语名称',
  nombreZh: '中文名称',
  categoria: '分类',
  ubicacion: '存放位置',
  stock: '当前库存',
  stockInicial: '初始库存',
  stockMin: '最低安全库存',
  totalSalidas: '累计出库量',
  precio: '单价 (Bs)',
  precioBs: '玻币单价 (Bs)',
  precioUsd: '美元单价 ($ USD)',
  empresa: '所属公司',
  unidad: '计量单位',
  modelo: '型号',
  serie: '序列号 / 底盘号 / 车牌',
  chasis: '底盘号',
  estado: '当前状态',
  numPoliza: '海关单号',
  polizaUrl: '海关单PDF',
  fotoUrl: '物品照片',
  fotoMaquinaUrl: '机械照片',
  fotoEquipoUrl: '设备照片',
  fotoPlacaUrl: '铭牌/车牌照片',
  notas: '备注说明',
  observaciones: '备注说明',
  compradorNombre: '买方 / 公司名称',
  compradorCiNit: '买方身份证/税号',
  compradorTelefono: '买方联系电话',
  compradorDireccion: '买方地址',
  vendedorNombre: '责任销售员',
  vendedorTelefono: '销售联系电话',
  formaPago: '付款方式',
  tipoCambioDolar: '官方汇率 (BCB)',
  montoTotalBs: '总金额 (Bs)',
  montoTotalUsd: '总金额 ($ USD)',
  fecha: '操作日期',
  actualizadoPor: '修改人',
  creadoPor: '创建人'
}

function RenderizarValorFormateado({ campo, valor }) {
  const { i18n } = useTranslation()
  const isZh = i18n.language === 'zh'

  if (valor === null || valor === undefined || valor === '') {
    return <span className="text-gray-300 italic">—</span>
  }

  if (typeof valor === 'object') {
    if (Array.isArray(valor)) {
      return (
        <div className="space-y-1">
          {valor.map((item, idx) => (
            <div key={idx} className="bg-gray-50 border border-gray-200 p-2 rounded-lg text-[11px]">
              {typeof item === 'object' ? <RenderizarFichaAmigable datos={item} /> : String(item)}
            </div>
          ))}
        </div>
      )
    }
    return <pre className="text-[10px] font-mono bg-gray-100 p-2 rounded-lg">{JSON.stringify(valor, null, 2)}</pre>
  }

  const str = String(valor)

  if (str.startsWith('http') && (str.match(/\.(jpeg|jpg|png|webp|gif)/i) || str.includes('firebasestorage.googleapis.com'))) {
    if (campo?.toLowerCase().includes('poliza') || str.toLowerCase().includes('.pdf')) {
      return (
        <a href={str} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline font-bold text-xs bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 shadow-sm">
          <FileText size={14}/> {isZh ? '查看PDF文件' : 'Ver Documento PDF'}
        </a>
      )
    }
    return (
      <div className="mt-1">
        <a href={str} target="_blank" rel="noopener noreferrer" title={isZh ? '点击查看大图' : 'Clic para abrir imagen en tamaño completo'}>
          <img src={str} alt={campo} className="w-24 h-24 rounded-xl object-cover border border-gray-300 shadow-sm hover:scale-105 transition-transform cursor-pointer bg-white" />
        </a>
      </div>
    )
  }

  if (campo === 'ubicacion') {
    return <span className="inline-block px-2.5 py-0.5 bg-blue-100 text-blue-800 font-bold rounded-full text-xs border border-blue-300">{str}</span>
  }
  if (campo === 'estado') {
    return <span className="inline-block px-2.5 py-0.5 bg-purple-100 text-purple-800 font-bold rounded-full text-xs border border-purple-300">{str}</span>
  }
  if (campo === 'precioUsd' || campo === 'montoTotalUsd') {
    return <span className="font-mono font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">$ {Number(str).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
  }
  if (campo === 'precio' || campo === 'precioBs' || campo === 'montoTotalBs') {
    return <span className="font-mono font-bold text-gray-900">{Number(str).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs</span>
  }

  return <span className="font-semibold text-gray-800 text-xs">{str}</span>
}

function RenderizarFichaAmigable({ datos }) {
  const { i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  if (!datos || typeof datos !== 'object') return null
  const entradas = Object.entries(datos).filter(([k]) => !['id', 'creadoEn', 'actualizadoEn'].includes(k))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
      {entradas.map(([key, val]) => {
        const label = isZh ? (MAPA_ETIQUETAS_ZH[key] || MAPA_ETIQUETAS[key] || key) : (MAPA_ETIQUETAS[key] || key)
        return (
          <div key={key} className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-sm space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-gray-400 block tracking-wide">{label}</span>
            <div className="text-xs">
              <RenderizarValorFormateado campo={key} valor={val} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RenderizarComparacionCambios({ datosAntes, datosDespues }) {
  const { i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const todasLasClaves = [...new Set([...Object.keys(datosAntes || {}), ...Object.keys(datosDespues || {})])]
  const clavesRelevantes = todasLasClaves.filter(k => !['id', 'creadoEn', 'actualizadoEn', 'actualizadoPor'].includes(k))

  const clavesModificadas = clavesRelevantes.filter(k => JSON.stringify(datosAntes?.[k]) !== JSON.stringify(datosDespues?.[k]))

  if (clavesModificadas.length === 0) {
    return <p className="text-xs text-gray-500 italic bg-gray-50 p-3 rounded-lg border border-gray-200">
      {isZh ? '前后状态一致，未检测到字段变动。' : 'No se detectaron cambios entre el estado anterior y el nuevo.'}
    </p>
  }

  return (
    <div className="space-y-2">
      <p className="font-bold text-gray-800 text-xs flex items-center justify-between">
        <span>🔄 {isZh ? `检测到的变更项 (${clavesModificadas.length} 个字段被修改):` : `Registro de Cambios Detectados (${clavesModificadas.length} campos modificados):`}</span>
        <span className="text-[10px] font-normal text-gray-500">{isZh ? '已高亮标出新值' : 'Resaltados los nuevos valores'}</span>
      </p>

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
              <th className="py-2.5 px-3 text-left">{isZh ? '修改字段' : 'Campo Modificado'}</th>
              <th className="py-2.5 px-3 text-left text-red-800 bg-red-50/60">{isZh ? '修改前原值' : 'Valor ANTERIOR'}</th>
              <th className="py-2.5 px-3 text-left text-emerald-800 bg-emerald-50/60">{isZh ? '修改后新值' : 'Valor NUEVO'}</th>
            </tr>
          </thead>
          <tbody>
            {clavesModificadas.map(key => {
              const valAntes = datosAntes?.[key]
              const valDespues = datosDespues?.[key]
              const labelAmigable = isZh ? (MAPA_ETIQUETAS_ZH[key] || MAPA_ETIQUETAS[key] || key) : (MAPA_ETIQUETAS[key] || key)

              return (
                <tr key={key} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="py-2.5 px-3 font-bold text-gray-800 bg-gray-50/50">
                    {labelAmigable}
                  </td>
                  <td className="py-2.5 px-3 bg-red-50/30 text-red-900">
                    <RenderizarValorFormateado campo={key} valor={valAntes} />
                  </td>
                  <td className="py-2.5 px-3 bg-emerald-50/30 text-emerald-900 font-bold">
                    <RenderizarValorFormateado campo={key} valor={valDespues} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Auditoria() {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const { perfil } = useAuth()
  const [tab, setTab]           = useState('logs') // 'logs' | 'backups'
  const [logs, setLogs]         = useState([])
  const [backups, setBackups]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [cargandoBackups, setCargandoBackups] = useState(false)
  const [ejecutandoBackup, setEjecutandoBackup] = useState(false)

  // Filtros
  const [busqueda, setBusqueda]   = useState('')
  const [filtroAc, setFiltroAc]   = useState('')
  const [filtroMod, setFiltroMod] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin]       = useState('')

  const [verDetalle, setDetalle]     = useState(null)
  const [modoTecnico, setModoTecnico] = useState(false) // false = Lectura Fácil, true = JSON Técnico

  useEffect(() => {
    // Suscribir a los registros en vivo de auditoría
    const unsub = suscribirAuditoria(data => {
      setLogs(data)
      setLoading(false)
    }, 300)

    // Verificar si corresponde ejecutar el backup automático semanal
    verificarYEjecutarBackupSemanalAuto().then(res => {
      if (res?.ok && res?.count > 0) {
        toast.success(
          isZh
            ? `⚡ 每周备份已执行：已归档并清理 ${res.count} 条早期记录 (>60天)。`
            : `⚡ Backup Semanal Ejecutado: Se archivaron y depuraron ${res.count} registros antiguos (>60 días).`,
          { duration: 6000 }
        )
      }
    })

    return unsub
  }, [])

  useEffect(() => {
    if (tab === 'backups') {
      cargarBackups()
    }
  }, [tab])

  const cargarBackups = async () => {
    setCargandoBackups(true)
    try {
      const list = await obtenerHistorialBackups()
      setBackups(list)
    } catch (e) {
      toast.error((isZh ? '加载备份列表失败: ' : 'Error cargando historial de backups: ') + e.message)
    } finally {
      setCargandoBackups(false)
    }
  }

  const handleEjecutarBackupManual = async () => {
    const msg = isZh
      ? '是否立即执行每周备份并清理数据库？\n超过60天的旧记录将备份至Storage并从Firestore中删除。'
      : '¿Desea ejecutar ahora el backup semanal y depuración de la base de datos?\nSe exportarán a Storage y eliminarán de Firestore todos los registros con más de 60 días de antigüedad.'
    if (!window.confirm(msg)) return
    setEjecutandoBackup(true)
    try {
      const res = await ejecutarBackupYPurgaAuditoria({ creadoPor: perfil?.nombre || 'Administrador' })
      if (res.count > 0) {
        toast.success(
          isZh
            ? `备份成功！已归档 ${res.count} 条旧记录到云端。`
            : `¡Backup Exitoso! Se archivaron ${res.count} registros antiguos en Storage.`
        )
        cargarBackups()
      } else {
        toast.info(res.mensaje || (isZh ? '没有符合清理条件的早期记录。' : 'No hay registros antiguos para depurar.'))
      }
    } catch (e) {
      toast.error((isZh ? '备份过程中出错: ' : 'Error durante el backup: ') + e.message)
    } finally {
      setEjecutandoBackup(false)
    }
  }

  // Filtrado de registros en vivo
  const filtered = logs.filter(l => {
    const q = busqueda.toLowerCase()
    const matchQ = !q || l.usuario?.toLowerCase().includes(q) || l.detalle?.toLowerCase().includes(q) || l.modulo?.toLowerCase().includes(q)
    const matchA = !filtroAc  || l.accion  === filtroAc
    const matchM = !filtroMod || l.modulo  === filtroMod

    let matchFecha = true
    if (l.fecha?.toDate) {
      const logFecha = l.fecha.toDate()
      if (fechaInicio) {
        const start = new Date(fechaInicio + 'T00:00:00')
        if (logFecha < start) matchFecha = false
      }
      if (fechaFin && matchFecha) {
        const end = new Date(fechaFin + 'T23:59:59')
        if (logFecha > end) matchFecha = false
      }
    }
    return matchQ && matchA && matchM && matchFecha
  })

  const modulos  = [...new Set(logs.map(l => l.modulo).filter(Boolean))]
  const acciones = [...new Set(logs.map(l => l.accion).filter(Boolean))]

  // Generador de Reportes en PDF con jsPDF + AutoTable
  const exportarPDF = () => {
    if (filtered.length === 0) {
      return toast.error(isZh ? '当前筛选条件下没有可导出的审计记录。' : 'No hay registros de auditoría para exportar con los filtros actuales.')
    }

    try {
      const doc = new jsPDF('p', 'mm', 'a4')

      // Encabezado Corporativo
      doc.setFillColor(15, 23, 42) // Slate 900
      doc.rect(0, 0, 210, 28, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(15)
      doc.setFont('helvetica', 'bold')
      doc.text('SAJAMA S.R.L. — INFORME DE AUDITORÍA Y CONTROL', 14, 13)

      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'normal')
      doc.text(`Emisión: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')} | Solicitado por: ${perfil?.nombre || 'Administrador'} (${perfil?.rol || 'SUPER ADMIN'})`, 14, 21)

      // Resumen Ejecutivo
      doc.setTextColor(30, 41, 59)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('1. Resumen Ejecutivo del Reporte', 14, 35)

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      const txtFiltro = `Total Registros: ${filtered.length} | Periodo: ${fechaInicio || 'Inicio'} a ${fechaFin || 'Hoy'} | Módulo: ${filtroMod || 'Todos'} | Acción: ${filtroAc || 'Todas'}`
      doc.text(txtFiltro, 14, 40)

      // Preparación de datos de la tabla
      const tableData = filtered.map(log => [
        log.fecha?.toDate ? format(log.fecha.toDate(), 'dd/MM/yy HH:mm:ss', { locale: es }) : '—',
        log.usuario || 'Sistema',
        log.rol || '—',
        log.modulo || 'General',
        log.accion || '—',
        log.detalle || '—'
      ])

      autoTable(doc, {
        startY: 45,
        head: [['Fecha y Hora', 'Usuario', 'Rol', 'Módulo', 'Acción', 'Detalle de la Operación']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillStyle: 'F', fillColor: [30, 58, 138], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 26 },
          2: { cellWidth: 20 },
          3: { cellWidth: 24 },
          4: { cellWidth: 22 },
          5: { cellWidth: 'auto' }
        },
        didDrawPage: (data) => {
          const pageNum = doc.internal.getNumberOfPages()
          doc.setFontSize(8)
          doc.setTextColor(140)
          doc.text(`Página ${pageNum}`, 196, 285, { align: 'right' })
          doc.text('Sajama S.R.L. — Documento Confidencial de Auditoría de Sistemas', 14, 285)
        }
      })

      doc.save(`Reporte_Auditoria_Sajama_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`)
      toast.success(isZh ? '审计PDF报告导出成功。' : 'Reporte PDF de Auditoría generado exitosamente.')
    } catch (e) {
      toast.error((isZh ? '生成PDF出错: ' : 'Error al generar el archivo PDF: ') + e.message)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      {/* Encabezado Principal y Pestañas */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <ShieldAlert size={24} className="text-amber-600"/> {isZh ? '系统综合审计与安全日志' : 'Log de Auditoría y Control Integrados'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {isZh ? '全链路操作追溯、自动按周归档备份以及官方审计报表导出' : 'Trazabilidad total de acciones, respaldo semanal automatizado y exportación oficial de reportes'}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setTab('logs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${tab === 'logs' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            <Database size={14}/> {isZh ? `实时记录 (${logs.length})` : `Registros en Vivo (${logs.length})`}
          </button>
          <button
            onClick={() => setTab('backups')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${tab === 'backups' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            <Archive size={14}/> {isZh ? '数据归档与备份' : 'Backups y Resguardos'}
          </button>
        </div>
      </div>

      {tab === 'logs' && (
        <>
          {/* Panel de Filtros y Acciones */}
          <div className="card p-4 space-y-3 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                <Filter size={14} className="text-primary"/> {isZh ? '检索与筛选条件' : 'Filtros de Búsqueda y Selección'}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={exportarPDF}
                  className="btn-primary btn-sm bg-purple-700 hover:bg-purple-800 border-purple-800">
                  <FileText size={14}/> {isZh ? '导出PDF' : 'Exportar PDF'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div className="md:col-span-2 relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input className="input pl-9 text-xs" placeholder={isZh ? '按操作人、详情或模块搜索...' : 'Buscar por usuario, detalle o módulo...'}
                  value={busqueda} onChange={e => setBusqueda(e.target.value)} />
              </div>

              <div>
                <select className="input text-xs" value={filtroAc} onChange={e => setFiltroAc(e.target.value)}>
                  <option value="">{isZh ? '所有操作类型' : 'Todas las acciones'}</option>
                  {acciones.map(a => <option key={a} value={a}>{a}{isZh && ACCION_ZH[a] ? ` (${ACCION_ZH[a]})` : ''}</option>)}
                </select>
              </div>

              <div>
                <select className="input text-xs" value={filtroMod} onChange={e => setFiltroMod(e.target.value)}>
                  <option value="">{isZh ? '所有模块' : 'Todos los módulos'}</option>
                  {modulos.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input type="date" className="input text-xs" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} title={isZh ? '开始日期' : 'Fecha Inicio'}/>
                <span className="text-gray-400 text-xs">-</span>
                <input type="date" className="input text-xs" value={fechaFin} onChange={e => setFechaFin(e.target.value)} title={isZh ? '结束日期' : 'Fecha Fin'}/>
              </div>
            </div>

            {(busqueda || filtroAc || filtroMod || fechaInicio || fechaFin) && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => { setBusqueda(''); setFiltroAc(''); setFiltroMod(''); setFechaInicio(''); setFechaFin('') }}
                  className="btn-secondary btn-xs text-xs">
                  <RefreshCw size={12}/> {isZh ? '重置筛选' : 'Limpiar Filtros'}
                </button>
              </div>
            )}
          </div>

          {/* Tabla de Registros */}
          <div className="card p-0 overflow-hidden">
            {filtered.length === 0 ? <EmptyState mensaje={isZh ? '当前筛选条件下无审计记录' : 'No hay registros de auditoría para los filtros aplicados'}/> : (
              <div className="overflow-x-auto">
                <table className="table-auto w-full text-xs">
                  <thead><tr className="bg-gray-50 border-b border-gray-200">
                    {[
                      isZh ? '日期与时间' : 'Fecha y Hora',
                      isZh ? '用户' : 'Usuario',
                      isZh ? '角色' : 'Rol',
                      isZh ? '模块' : 'Módulo',
                      isZh ? '操作' : 'Acción',
                      isZh ? '操作详细说明' : 'Detalle de la Operación',
                      isZh ? '查看' : 'Ver'
                    ].map(h => (
                      <th key={h} className="th py-2.5 px-3 text-left font-bold text-gray-700">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filtered.map(log => (
                      <tr key={log.id} className="tr-hover border-b border-gray-100">
                        <td className="td py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                          {log.fecha?.toDate
                            ? format(log.fecha.toDate(), 'dd/MM/yy HH:mm:ss', { locale: es })
                            : '—'}
                        </td>
                        <td className="td py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-primary-pale rounded-full flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                              {log.usuario?.[0]?.toUpperCase() || '?'}
                            </div>
                            <span className="font-semibold text-gray-800">{log.usuario}</span>
                          </div>
                        </td>
                        <td className="td py-2.5 px-3 text-gray-500 capitalize">{log.rol || (isZh ? '普通用户' : 'Usuario')}</td>
                        <td className="td py-2.5 px-3"><Badge tipo="blue">{log.modulo}</Badge></td>
                        <td className="td py-2.5 px-3">
                          <Badge tipo={ACCION_COLOR[log.accion] || 'gray'}>
                            {ACCION_ICON[log.accion]} {isZh && ACCION_ZH[log.accion] ? ACCION_ZH[log.accion] : log.accion}
                          </Badge>
                        </td>
                        <td className="td py-2.5 px-3 text-gray-700 max-w-sm">
                          <div className="truncate font-medium" title={log.detalle}>{log.detalle}</div>
                        </td>
                        <td className="td py-2.5 px-3">
                          {(log.datosAntes || log.datosDespues || log.maquinasInfo || log.equiposInfo || log.datosTransporte) && (
                            <button onClick={() => setDetalle(log)}
                              className="p-1 rounded-lg hover:bg-primary-pale text-primary transition-colors"
                              title={isZh ? '查看审计详情' : 'Ver detalle de auditoría'}>
                              <Eye size={15}/>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'backups' && (
        <div className="space-y-4">
          {/* Card de Estado del Respaldo Automático */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-md space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <Archive size={20} className="text-yellow-400"/> {isZh ? '每周自动备份与Firestore数据归档清理系统' : 'Sistema de Resguardo Semanal y Depuración de Firestore'}
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  {isZh
                    ? '超过60天的审计记录每周会自动打包为压缩json格式备份至Firebase Storage，并从Firestore中清除以确保数据库高效轻量。'
                    : 'Los registros de auditoría de más de 60 días se respaldan automáticamente cada semana en formato comprimido `.json` en Firebase Storage y se purgan de Firestore para mantener la base de datos óptima y ligera.'}
                </p>
              </div>

              <button
                onClick={handleEjecutarBackupManual}
                disabled={ejecutandoBackup}
                className="btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-xs px-4 py-2">
                {ejecutandoBackup ? <Loader2 size={14} className="animate-spin inline mr-1"/> : <HardDrive size={14} className="inline mr-1"/>}
                {ejecutandoBackup ? (isZh ? '正在执行备份...' : 'Ejecutando Backup...') : (isZh ? '立即执行每周备份' : 'Ejecutar Backup Semanal Ahora')}
              </button>
            </div>
          </div>

          {/* Historial de Backups Archivados */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <Database size={15} className="text-primary"/> {isZh ? '云端归档备份文件历史 (Storage)' : 'Historial de Archivos Respaldados en Nube (Storage)'}
              </h4>
              <button onClick={cargarBackups} className="btn-secondary btn-xs">
                <RefreshCw size={12}/> {isZh ? '刷新列表' : 'Actualizar Lista'}
              </button>
            </div>

            {cargandoBackups ? (
              <div className="p-8 text-center text-gray-400 text-xs">{isZh ? '正在加载备份列表...' : 'Cargando lista de respaldos...'}</div>
            ) : backups.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                {isZh ? '暂无每周备份记录。当系统运行满60天将自动归档。' : 'No hay respaldos semanales registrados aún. Los backups automáticos se generarán al superar los 60 días de retención.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-auto w-full text-xs">
                  <thead><tr className="bg-gray-50 border-b border-gray-200">
                    <th className="th text-left">{isZh ? '备份时间' : 'Fecha de Respaldo'}</th>
                    <th className="th text-left">{isZh ? '文件名' : 'Nombre de Archivo'}</th>
                    <th className="th text-center">{isZh ? '已归档记录数' : 'Registros Archivados'}</th>
                    <th className="th text-left">{isZh ? '执行人' : 'Ejecutado Por'}</th>
                    <th className="th text-right">{isZh ? '下载' : 'Descargar'}</th>
                  </tr></thead>
                  <tbody>
                    {backups.map(b => (
                      <tr key={b.id} className="tr-hover border-b border-gray-100">
                        <td className="td font-mono text-gray-600">
                          {b.fecha?.toDate ? format(b.fecha.toDate(), 'dd/MM/yyyy HH:mm:ss') : '—'}
                        </td>
                        <td className="td font-mono font-bold text-gray-800">{b.nombreArchivo}</td>
                        <td className="td text-center">
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold text-[11px]">
                            {b.totalRegistros} {isZh ? '条记录' : 'registros'}
                          </span>
                        </td>
                        <td className="td text-gray-600 font-medium">{b.creadoPor || (isZh ? '系统' : 'Sistema')}</td>
                        <td className="td text-right">
                          {b.downloadUrl ? (
                            <a href={b.downloadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline font-bold">
                              <Download size={13}/> {isZh ? '下载JSON' : 'Descargar JSON'}
                            </a>
                          ) : (
                            <span className="text-gray-300">—</span>
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

      {/* Modal ver detalle del cambio con Interfaz Humanizada */}
      <Modal open={!!verDetalle} onClose={() => setDetalle(null)} title={isZh ? '审计事件完整详情' : 'Detalle Completo de Auditoría'} size="lg">
        {verDetalle && (
          <div className="space-y-4 text-xs">
            {/* Barra de estado y Conmutador Modo Lectura Fácil / Modo Técnico */}
            <div className="flex items-center justify-between flex-wrap gap-2 bg-gray-100 p-2 rounded-xl border border-gray-200">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-gray-700 uppercase tracking-wide text-[11px] flex items-center gap-1">
                  <LayoutGrid size={15} className="text-primary"/> {isZh ? '审计视图模式' : 'Vista de Auditoría'}
                </span>
              </div>

              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                <button
                  type="button"
                  onClick={() => setModoTecnico(false)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors flex items-center gap-1 ${!modoTecnico ? 'bg-primary text-white' : 'text-gray-600 hover:text-gray-900'}`}>
                  <LayoutGrid size={13}/> {isZh ? '人机易读模式' : 'Modo Lectura Fácil'}
                </button>
                <button
                  type="button"
                  onClick={() => setModoTecnico(true)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors flex items-center gap-1 ${modoTecnico ? 'bg-slate-800 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
                  <Code size={13}/> {isZh ? '技术代码模式 (JSON)' : 'Modo Técnico (JSON)'}
                </button>
              </div>
            </div>

            {/* Cabecera Principal de Información del Evento */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                [isZh ? '操作用户' : 'Usuario',   verDetalle.usuario],
                [isZh ? '系统角色' : 'Rol',       verDetalle.rol],
                [isZh ? '操作模块' : 'Módulo',    verDetalle.modulo],
                [isZh ? '动作类型' : 'Acción',    isZh && ACCION_ZH[verDetalle.accion] ? `${verDetalle.accion} (${ACCION_ZH[verDetalle.accion]})` : verDetalle.accion],
                [isZh ? '发生时间' : 'Fecha',     verDetalle.fecha?.toDate ? format(verDetalle.fecha.toDate(), 'dd/MM/yyyy HH:mm:ss') : '—'],
                [isZh ? '操作描述' : 'Detalle',   verDetalle.detalle],
              ].map(([k, v]) => (
                <div key={k} className="bg-white rounded-xl p-2.5 border border-gray-200 shadow-sm">
                  <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide">{k}</p>
                  <p className="font-bold text-gray-900 mt-0.5 truncate">{v || '—'}</p>
                </div>
              ))}
            </div>

            {/* VISTA 1: MODO LECTURA FÁCIL (HUMANIZADA) */}
            {!modoTecnico ? (
              <div className="space-y-4">
                {/* 1. Si hay comparación Antes vs Después (Ediciones / Ajustes) */}
                {(verDetalle.datosAntes || verDetalle.datosDespues) && (
                  <div className="space-y-3">
                    {verDetalle.datosAntes && verDetalle.datosDespues ? (
                      <RenderizarComparacionCambios datosAntes={verDetalle.datosAntes} datosDespues={verDetalle.datosDespues} />
                    ) : (
                      <div>
                        <p className="font-bold text-gray-800 text-xs mb-2">
                          {verDetalle.datosDespues
                            ? (isZh ? '🟢 新增/登记的数据卡片:' : '🟢 Ficha de Datos Registrados:')
                            : (isZh ? '🔴 变更前/已删除的数据卡片:' : '🔴 Ficha de Datos Eliminados:')}
                        </p>
                        <RenderizarFichaAmigable datos={verDetalle.datosDespues || verDetalle.datosAntes} />
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Si contiene máquinas/equipos en lote (Ventas / Transportes) */}
                {verDetalle.maquinasInfo && (
                  <div className="space-y-2">
                    <p className="font-bold text-purple-900 text-xs flex items-center gap-1.5 border-b border-purple-100 pb-1">
                      {isZh
                        ? `📋 本次操作涉及的机械 (${verDetalle.maquinasInfo.length}):`
                        : `📋 Máquinas Involucradas en la Operación (${verDetalle.maquinasInfo.length}):`}
                    </p>
                    <div className="space-y-2.5 max-h-64 overflow-y-auto">
                      {verDetalle.maquinasInfo.map((m, idx) => (
                        <div key={idx} className="bg-purple-50/60 border border-purple-200 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between font-bold text-gray-900 text-xs">
                            <span className="text-purple-900">{idx + 1}. {m.nombreEs || m.descripcion}</span>
                            {m.nombreZh && <span className="text-purple-700 font-medium">({m.nombreZh})</span>}
                          </div>
                          <RenderizarFichaAmigable datos={m} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Datos de Transporte o Venta adicionales */}
                {verDetalle.datosTransporte && (
                  <div className="space-y-2">
                    <p className="font-bold text-blue-900 text-xs flex items-center gap-1.5 border-b border-blue-100 pb-1">
                      {isZh ? '📄 商务 / 运输 / 销售附加信息:' : '📄 Datos Comercial / Transporte / Venta:'}
                    </p>
                    <RenderizarFichaAmigable datos={verDetalle.datosTransporte} />
                  </div>
                )}
              </div>
            ) : (
              /* VISTA 2: MODO TÉCNICO (CÓDIGO JSON RAW) */
              <div className="space-y-3 font-mono text-[11px]">
                {verDetalle.datosAntes && (
                  <div>
                    <p className="font-bold text-red-700 mb-1 flex items-center gap-1">
                      🔴 {isZh ? '变更前原始数据 (JSON):' : 'Datos ANTES (JSON):'}
                    </p>
                    <pre className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-900 overflow-x-auto">
                      {JSON.stringify(verDetalle.datosAntes, null, 2)}
                    </pre>
                  </div>
                )}

                {verDetalle.datosDespues && (
                  <div>
                    <p className="font-bold text-emerald-700 mb-1 flex items-center gap-1">
                      🟢 {isZh ? '变更后最新数据 (JSON):' : 'Datos DESPUÉS (JSON):'}
                    </p>
                    <pre className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-900 overflow-x-auto">
                      {JSON.stringify(verDetalle.datosDespues, null, 2)}
                    </pre>
                  </div>
                )}

                {verDetalle.maquinasInfo && (
                  <div>
                    <p className="font-bold text-purple-700 mb-1">
                      📋 {isZh ? '关联机械列表 (JSON):' : 'Máquinas Info (JSON):'}
                    </p>
                    <pre className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-purple-900 overflow-x-auto">
                      {JSON.stringify(verDetalle.maquinasInfo, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
