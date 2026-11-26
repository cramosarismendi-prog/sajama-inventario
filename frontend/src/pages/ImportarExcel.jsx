import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { db } from '../services/firebase'
import { registrarAccion } from '../services/auditoria'
import { collection, getDocs, query, orderBy, doc, addDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore'
import { PageLoader } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, RefreshCw, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { traducirAlChino } from '../services/traduccion'
import toast from 'react-hot-toast'

const CATEGORIAS = ['Maquinarias', 'Equipos', 'Repuestos', 'Materiales', 'Insumos']

const NOMBRES_CAMPO_ZH = {
  codigo: '编号/代码',
  descripcion: '西语描述',
  descripcionZh: '中文描述',
  modelo: '型号',
  serie: '序列号',
  categoria: '分类',
  unidad: '单位',
  ubicacion: '存放位置',
  stock: '库存数量',
  stockMin: '最低库存',
  precio: '单价',
  notas: '备注',
}

// Mapeo flexible de nombres de columna del Excel → campos del sistema
const MAPA_COLUMNAS = {
  codigo:        ['codigo','código','cod','代码','n°','no','num','número','number','id'],
  descripcion:   ['descripcion español','descripcion espanol','descripcion','descripción','description',
                  'desc','nombre','name','detalle','producto','item','存货名称（西语）','西语'],
  descripcionZh: ['descripcion en chino','descripcion chino','chino','chinese','zh','中文',
                  '存货名称（中文）','中文名称','desc chino','descipcion en chino'],
  modelo:        ['modelo','型号','model','tipo','type','referencia','ref','part number'],
  serie:         ['serie','包装号','serial','n° serie','nro serie','numero serie','serial number'],
  categoria:     ['categoria','categoría','category','grupo','clase'],
  unidad:        ['unidad','单位','unit','um','u.m.','medida'],
  ubicacion:     ['ubicacion','ubicación','地点','location','almacen','estante','shelf'],
  stock:         ['stock','存在','cantidad','qty','quantity','existencia','saldo','disponible'],
  stockMin:      ['stock min','stock mínimo','minimo','mínimo','min stock','alerta'],
  precio:        ['precio en bs','precio bs','precio','价格','price','costo','valor','bs'],
  notas:         ['notas','nota','note','notes','observacion','obs','comentario'],
}

function encontrarColumna(headers, posibles) {
  const hLower = headers.map(h => String(h || '').toLowerCase().trim())
  for (const p of posibles) {
    const idx = hLower.findIndex(h => h === p || h.includes(p) || p.includes(h))
    if (idx >= 0) return idx
  }
  return -1
}

function mapearFila(fila, mapaIdx) {
  const get = (campo) => {
    const idx = mapaIdx[campo]
    if (idx === undefined || idx < 0) return null
    const val = fila[idx]
    return val !== undefined && val !== null && val !== '' ? val : null
  }

  const codigo    = get('codigo')
  const stockVal  = get('stock')
  const precioVal = get('precio')

  return {
    codigo:        codigo !== null ? Number(codigo) || codigo : null,
    descripcion:   String(get('descripcion') || '').trim(),
    descripcionZh: String(get('descripcionZh') || '').trim(),
    modelo:        String(get('modelo') || '').trim(),
    serie:         String(get('serie') || '').trim(),
    categoria:     String(get('categoria') || '').trim(),
    unidad:        String(get('unidad') || 'unidad').trim(),
    ubicacion:     String(get('ubicacion') || '').trim(),
    stock:         stockVal !== null ? Number(stockVal) || 0 : 0,
    stockMin:      get('stockMin') !== null ? Number(get('stockMin')) || 5 : 5,
    precio:        precioVal !== null ? Number(precioVal) || 0 : 0,
    notas:         String(get('notas') || '').trim(),
    totalSalidas:  0,
    fotoUrl:       null,
  }
}

export default function ImportarExcel() {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const { perfil } = useAuth()
  const fileRef    = useRef()
  const [fase,     setFase]     = useState('inicio')   // inicio | preview | importando | done
  const [archivo,  setArchivo]  = useState(null)
  const [hojas,    setHojas]    = useState([])
  const [hojaSelec,setHoja]     = useState('')
  const [columnas, setColumnas] = useState({})
  const [filas,    setFilas]    = useState([])
  const [headers,  setHeaders]  = useState([])
  const [resultado,setResultado]= useState(null)
  const [verErrores,setVerErr]  = useState(false)
  const [progreso, setProgreso] = useState(0)

  const leerExcel = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const wb    = XLSX.read(e.target.result, { type: 'binary' })
      setHojas(wb.SheetNames)
      setArchivo({ file, wb })
      setHoja(wb.SheetNames[0])
      procesarHoja(wb, wb.SheetNames[0])
    }
    reader.readAsBinaryString(file)
  }

  const procesarHoja = (wb, nombreHoja) => {
    const ws   = wb.Sheets[nombreHoja]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    if (!data || data.length < 2) {
      toast.error(isZh ? '工作表为空或未包含有效数据' : 'La hoja está vacía o no tiene datos')
      return
    }

    // Buscar la fila de encabezados — en Excel SAJAMA los encabezados reales
    // están en la fila que contiene 'COD' o 'DESCRIPCION' o '代码'
    let headerRow = 0
    for (let i = 0; i < Math.min(15, data.length); i++) {
      const rowStr = data[i].map(c => String(c || '').toLowerCase()).join(' ')
      if (rowStr.includes('cod') || rowStr.includes('descripcion') ||
          rowStr.includes('modelo') || rowStr.includes('stock') ||
          rowStr.includes('unidad') || rowStr.includes('代码')) {
        headerRow = i; break
      }
    }

    const hdrs = data[headerRow].map(h => String(h || '').trim())
    setHeaders(hdrs)

    // Mapear columnas automáticamente
    const mapaIdx = {}
    Object.entries(MAPA_COLUMNAS).forEach(([campo, posibles]) => {
      mapaIdx[campo] = encontrarColumna(hdrs, posibles)
    })
    setColumnas(mapaIdx)

    // Filas de datos (ignorar vacías y encabezado)
    const filasDatos = data.slice(headerRow + 1)
      .filter(fila => fila.some(c => c !== '' && c !== null && c !== undefined))
      .map(fila => mapearFila(fila, mapaIdx))
      .filter(f => f.descripcion || f.codigo)

    setFilas(filasDatos)
    setFase('preview')
  }

  const cambiarHoja = (nombreHoja) => {
    setHoja(nombreHoja)
    procesarHoja(archivo.wb, nombreHoja)
  }

  const ejecutarImportacion = async () => {
    setFase('importando')
    setProgreso(0)

    // Traducir al chino las filas que no tienen descripcionZh
    const filasSinZh = filas.filter(f => f.descripcion && !f.descripcionZh)
    if (filasSinZh.length > 0) {
      toast(isZh ? '正在将描述翻译为中文... 🌐' : 'Traduciendo descripciones al chino... 🌐', { duration: 3000 })
      for (let i = 0; i < filasSinZh.length; i++) {
        const zh = await traducirAlChino(filasSinZh[i].descripcion)
        if (zh) filasSinZh[i].descripcionZh = zh
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 200))
      }
    }

    // Cargar inventario existente para comparar
    const snapExistente = await getDocs(collection(db, 'inventario'))
    const existentes = {}
    let maxCodigoExistente = 0
    snapExistente.docs.forEach(d => {
      const data = d.data()
      if (data.codigo) existentes[String(data.codigo)] = { id: d.id, ...data }
      const num = Number(data.codigo)
      if (!isNaN(num) && num > maxCodigoExistente) maxCodigoExistente = num
    })

    // Contador para asignar código correlativo a las filas que llegan sin código,
    // continuando desde el código más alto que ya existe en el inventario.
    let siguienteCodigoAuto = maxCodigoExistente

    let creados = 0, actualizados = 0, omitidos = 0, autoAsignados = 0
    const errores = []

    for (let i = 0; i < filas.length; i++) {
      const f = filas[i]
      setProgreso(Math.round(((i + 1) / filas.length) * 100))

      try {
        // Si la fila no trae código (columna no detectada o celda vacía),
        // se le asigna uno correlativo automáticamente.
        if (!f.codigo) {
          siguienteCodigoAuto += 1
          f.codigo = siguienteCodigoAuto
          autoAsignados += 1
        }

        const codigoKey = String(f.codigo || '')
        const existe    = codigoKey ? existentes[codigoKey] : null

        if (existe) {
          // Actualizar stock e info del ítem existente
          const stockNuevo = (existe.stock || 0) + (f.stock || 0)
          await updateDoc(doc(db, 'inventario', existe.id), {
            descripcion:   f.descripcion   || existe.descripcion,
            descripcionZh: f.descripcionZh || existe.descripcionZh || '',
            modelo:        f.modelo        || existe.modelo || '',
            serie:         f.serie         || existe.serie  || '',
            categoria:     f.categoria     || existe.categoria || 'Repuestos',
            unidad:        f.unidad        || existe.unidad || 'unidad',
            ubicacion:     f.ubicacion     || existe.ubicacion || '',
            stockMin:      f.stockMin      || existe.stockMin || 5,
            precio:        f.precio        || existe.precio || 0,
            notas:         f.notas         || existe.notas  || '',
            stock:         f.stock > 0 ? f.stock : existe.stock,
            actualizadoEn: serverTimestamp(),
            actualizadoPor: perfil?.nombre,
          })
          actualizados++
        } else {
          // Crear ítem nuevo
          await addDoc(collection(db, 'inventario'), {
            ...f,
            categoria:    f.categoria || 'Repuestos',
            totalSalidas: 0,
            creadoEn:     serverTimestamp(),
            creadoPor:    perfil?.nombre,
            actualizadoEn: serverTimestamp(),
          })
          creados++
        }
      } catch (e) {
        errores.push({ fila: i + 1, desc: f.descripcion, error: e.message })
        omitidos++
      }
    }

    await registrarAccion({
      usuario: perfil?.nombre, rol: perfil?.rol,
      modulo: 'Importar Excel', accion: 'CREAR',
      detalle: `Importó Excel: ${creados} creados, ${actualizados} actualizados, ${omitidos} errores, ${autoAsignados} con código auto-asignado. Archivo: ${archivo.file.name}`,
    })

    setResultado({ creados, actualizados, omitidos, errores, autoAsignados })
    setFase('done')
    toast.success(
      isZh
        ? `导入完成: 新增 ${creados} 条, 更新 ${actualizados} 条` + (autoAsignados > 0 ? `, 自动生成编号 ${autoAsignados} 条` : '')
        : (`Importación completa: ${creados} nuevos, ${actualizados} actualizados` + (autoAsignados > 0 ? `, ${autoAsignados} con código auto-asignado` : ''))
    )
  }

  const reiniciar = () => {
    setFase('inicio'); setArchivo(null); setHojas([]); setHoja('')
    setColumnas({}); setFilas([]); setHeaders([]); setResultado(null); setProgreso(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── RENDER ────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="flex items-center gap-2">
          <FileSpreadsheet size={22} className="text-success"/> {isZh ? '从 Excel 导入数据' : 'Importar desde Excel'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isZh
            ? '上传库存Excel表格，系统将自动匹配列并导入全量库存数据'
            : 'Sube tu archivo Excel de inventario y el sistema importará todos los datos automáticamente'}
        </p>
      </div>

      {/* ── FASE: INICIO ── */}
      {fase === 'inicio' && (
        <div className="card">
          <div
            onClick={() => fileRef.current.click()}
            className="border-2 border-dashed border-gray-300 hover:border-primary rounded-xl p-12 text-center cursor-pointer transition-colors group">
            <FileSpreadsheet size={48} className="mx-auto mb-4 text-gray-300 group-hover:text-primary transition-colors"/>
            <p className="text-lg font-semibold text-gray-600 mb-2">
              {isZh ? '点击此处选择或拖入 Excel 文件' : 'Haz clic para seleccionar el archivo Excel'}
            </p>
            <p className="text-sm text-gray-400">
              {isZh ? '支持格式: .xlsx, .xls, .csv' : 'Formatos soportados: .xlsx, .xls, .csv'}
            </p>
            <p className="text-xs text-gray-300 mt-2">
              {isZh
                ? '自动识别列：编号、西语描述、中文、型号、序列号、分类、单位、库存、单价等'
                : 'Columnas detectadas automáticamente: código, descripción, chino, modelo, serie, categoría, unidad, stock, precio, etc.'}
            </p>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { if (e.target.files[0]) leerExcel(e.target.files[0]) }} />

          {/* Instrucciones */}
          <div className="mt-4 bg-[#EEF2F0] border border-[#DCE3DF] rounded-xl p-4 text-sm text-[#16241F] space-y-1">
            <p className="font-semibold">
              {isZh ? '📋 系统能够自动识别匹配以下列名：' : '📋 El sistema detecta automáticamente columnas con estos nombres:'}
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-2 text-xs text-gray-600">
              {[
                [isZh ? '编号/代码' : 'Código', 'codigo, cod, no, num, id, 代码'],
                [isZh ? '西语描述' : 'Descripción ES', 'descripcion, nombre, producto, item, 存货名称（西语）'],
                [isZh ? '中文描述' : 'Descripción ZH', 'chino, zh, 中文, desc chino, 存货名称（中文）'],
                [isZh ? '型号' : 'Modelo', 'modelo, tipo, referencia, part number, 型号'],
                [isZh ? '序列号/包装号' : 'N° Serie', 'serie, serial, numero serie, 包装号'],
                [isZh ? '分类' : 'Categoría', 'categoria, group, clase'],
                [isZh ? '单位' : 'Unidad', 'unidad, unit, um, 单位'],
                [isZh ? '存放位置' : 'Ubicación', 'ubicacion, almacen, estante, 地点'],
                [isZh ? '库存数量' : 'Stock', 'stock, cantidad, existencia, saldo, 存在'],
                [isZh ? '单价' : 'Precio', 'precio, costo, valor, precio (bs), 价格'],
                [isZh ? '最低安全库存' : 'Stock mín.', 'stock min, minimo, alerta'],
                [isZh ? '备注' : 'Notas', 'notas, observacion, comentario'],
              ].map(([campo, nombres]) => (
                <div key={campo} className="flex gap-2">
                  <span className="font-medium text-primary w-28 shrink-0">{campo}:</span>
                  <span className="text-gray-400 italic">{nombres}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FASE: PREVIEW ── */}
      {fase === 'preview' && (
        <div className="space-y-4">
          {/* Info archivo */}
          <div className="card flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={24} className="text-success"/>
              <div>
                <p className="font-semibold text-gray-800">{archivo.file.name}</p>
                <p className="text-xs text-gray-400">
                  {hojas.length} {isZh ? '个工作表' : 'hoja(s)'} · {filas.length} {isZh ? '条识别到的数据' : 'ítems detectados'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              {hojas.length > 1 && (
                <select className="input w-auto text-sm" value={hojaSelec} onChange={e => cambiarHoja(e.target.value)}>
                  {hojas.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              )}
              <button onClick={reiniciar} className="btn-secondary btn-sm">
                <RefreshCw size={13}/> {isZh ? '更换文件' : 'Cambiar archivo'}
              </button>
            </div>
          </div>

          {/* Mapeo de columnas detectadas */}
          <div className="card">
            <h3 className="mb-3">{isZh ? '自动识别到的字段列' : 'Columnas detectadas automáticamente'}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(MAPA_COLUMNAS).map(([campo, _]) => {
                const idx  = columnas[campo]
                const found = idx !== undefined && idx >= 0
                return (
                  <div key={campo} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${found ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-400'}`}>
                    <span>{found ? '✅' : '⬜'}</span>
                    <span className="font-medium capitalize">
                      {isZh ? (NOMBRES_CAMPO_ZH[campo] || campo) : campo.replace(/([A-Z])/g, ' $1')}
                    </span>
                    {found && <span className="text-green-600 truncate">→ "{headers[idx]}"</span>}
                  </div>
                )
              })}
            </div>
            {columnas.codigo === -1 && (
              <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                {isZh
                  ? '⚠️ 未识别到编号列。导入时系统将为每项自动分配递增的唯一编号。'
                  : '⚠️ No se detectó la columna de código. Se asignará un código correlativo automáticamente a cada ítem al importar.'}
              </div>
            )}
          </div>

          {/* Preview tabla */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3>
                {isZh ? `数据预览 — 共有 ${filas.length} 条待导入数据` : `Vista previa — ${filas.length} ítems a importar`}
              </h3>
              <Badge tipo="blue">
                {filas.filter(f => f.codigo).length} {isZh ? '条自带编号' : 'con código'}
              </Badge>
            </div>
            <div className="overflow-x-auto max-h-80">
              <table className="table-auto w-full text-xs">
                <thead className="sticky top-0">
                  <tr>
                    {[
                      '#',
                      isZh ? '编号' : 'Código',
                      isZh ? '西语描述' : 'Descripción ES',
                      isZh ? '中文描述' : 'Descripción ZH',
                      isZh ? '型号' : 'Modelo',
                      isZh ? '分类' : 'Categoría',
                      isZh ? '单位' : 'Unidad',
                      isZh ? '库存' : 'Stock',
                      isZh ? '单价' : 'Precio'
                    ].map(h => (
                      <th key={h} className="th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.slice(0, 50).map((f, i) => (
                    <tr key={i} className="tr-hover">
                      <td className="td text-gray-400">{i+1}</td>
                      <td className="td font-mono font-bold text-primary">
                        {f.codigo || <span className="text-yellow-500 italic">{isZh ? '自动编号' : 'auto'}</span>}
                      </td>
                      <td className="td font-medium max-w-[160px] truncate" title={f.descripcion}>{f.descripcion || '—'}</td>
                      <td className="td text-gray-500 max-w-[120px] truncate">{f.descripcionZh || '—'}</td>
                      <td className="td text-gray-500">{f.modelo || '—'}</td>
                      <td className="td"><Badge tipo="blue">{f.categoria || '—'}</Badge></td>
                      <td className="td text-gray-500">{f.unidad}</td>
                      <td className="td font-semibold text-green-700">{f.stock}</td>
                      <td className="td">{f.precio ? `${f.precio} Bs` : '—'}</td>
                    </tr>
                  ))}
                  {filas.length > 50 && (
                    <tr>
                      <td colSpan={9} className="td text-center text-gray-400 italic">
                        ... {isZh ? `以及其余 ${filas.length - 50} 条数据` : `y ${filas.length - 50} ítems más`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={reiniciar} className="btn-secondary">
              {isZh ? '取消' : 'Cancelar'}
            </button>
            <button onClick={ejecutarImportacion} className="btn-success">
              <Upload size={14}/> {isZh ? `将 ${filas.length} 条数据导入库存` : `Importar ${filas.length} ítems al inventario`}
            </button>
          </div>
        </div>
      )}

      {/* ── FASE: IMPORTANDO ── */}
      {fase === 'importando' && (
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="w-16 h-16 border-4 border-primary-pale border-t-primary rounded-full animate-spin"/>
          </div>
          <p className="font-semibold text-gray-700 mb-2">{isZh ? '正在导入数据...' : 'Importando datos...'}</p>
          <p className="text-sm text-gray-400 mb-4">{progreso}% {isZh ? '已完成' : 'completado'}</p>
          <div className="w-64 mx-auto bg-gray-200 rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{width: progreso + '%'}}/>
          </div>
          <p className="text-xs text-gray-400 mt-3">{isZh ? '请勿关闭此窗口' : 'No cierres esta ventana'}</p>
        </div>
      )}

      {/* ── FASE: DONE ── */}
      {fase === 'done' && resultado && (
        <div className="space-y-4">
          <div className="card text-center py-8">
            <CheckCircle size={48} className="mx-auto mb-4 text-success"/>
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {isZh ? '🎉 导入顺利完成！' : '¡Importación completada!'}
            </h2>
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-3xl font-bold text-success">{resultado.creados}</p>
                <p className="text-xs text-green-700 mt-1">{isZh ? '新增创建' : 'Ítems creados'}</p>
              </div>
              <div className="bg-[#EEF2F0] border border-[#DCE3DF] rounded-xl p-4">
                <p className="text-3xl font-bold text-primary">{resultado.actualizados}</p>
                <p className="text-xs text-primary mt-1">{isZh ? '匹配更新' : 'Actualizados'}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-3xl font-bold text-danger">{resultado.omitidos}</p>
                <p className="text-xs text-red-600 mt-1">{isZh ? '存在错误' : 'Con errores'}</p>
              </div>
            </div>
            {resultado.autoAsignados > 0 && (
              <div className="max-w-md mx-auto mt-3 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
                {isZh
                  ? `⚠️ ${resultado.autoAsignados} 条数据在Excel中无编号，系统已自动分配连续递增编号。建议在库存目录中进行核对。`
                  : `⚠️ ${resultado.autoAsignados} ítem(s) no traían código en el Excel y se les asignó uno correlativo automáticamente. Revísalos en el inventario para confirmar que estén correctos.`}
              </div>
            )}
            {resultado.errores.length > 0 && (
              <button onClick={() => setVerErr(true)} className="btn-secondary btn-sm mt-4">
                <AlertTriangle size={13}/> {isZh ? `查看 ${resultado.errores.length} 个错误` : `Ver ${resultado.errores.length} errores`}
              </button>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={reiniciar} className="btn-secondary">
              <Upload size={14}/> {isZh ? '导入其他文件' : 'Importar otro archivo'}
            </button>
            <a href="/inventario" className="btn-primary">
              {isZh ? '查看最新库存目录 →' : 'Ver inventario actualizado →'}
            </a>
          </div>

          <Modal open={verErrores} onClose={() => setVerErr(false)} title={isZh ? '导入期间的错误记录' : 'Errores durante la importación'} size="md">
            <div className="space-y-2 text-sm">
              {resultado.errores.map((e, i) => (
                <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="font-semibold text-red-700">
                    {isZh ? `第 ${e.fila} 行: ` : `Fila ${e.fila}: `}{e.desc}
                  </p>
                  <p className="text-red-500 text-xs mt-1">{e.error}</p>
                </div>
              ))}
            </div>
          </Modal>
        </div>
      )}
    </div>
  )
}