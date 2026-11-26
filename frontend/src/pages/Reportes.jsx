import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { getItems } from '../services/inventario'
import { getSalidas } from '../services/salidas'
import { getIngresos } from '../services/ingresos'
import { PageLoader } from '../components/ui/Spinner'
import { Download } from 'lucide-react'
import { exportarInventarioExcel } from '../utils/exportar'

const COLORS = ['#16241F','#2E5A47','#C9B81A','#B45309','#4B6B5F','#64748B']

export default function Reportes() {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const [items,    setItems]    = useState([])
  const [salidas,  setSalidas]  = useState([])
  const [ingresos, setIngresos] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    Promise.all([getItems(), getSalidas(), getIngresos()]).then(([i, s, g]) => {
      setItems(i); setSalidas(s); setIngresos(g); setLoading(false)
    })
  }, [])

  if (loading) return <PageLoader />

  const CATEGORIAS_MAP = {
    Maquinarias: isZh ? '机械设备' : 'Maquinarias',
    Equipos:     isZh ? '小型设备' : 'Equipos',
    Repuestos:   isZh ? '零备件'   : 'Repuestos',
    Materiales:  isZh ? '基建物料' : 'Materiales',
    Insumos:     isZh ? '耗材油品' : 'Insumos',
  }

  // Datos para gráficos
  const porCategoria = ['Maquinarias','Equipos','Repuestos','Materiales','Insumos'].map(cat => ({
    name: CATEGORIAS_MAP[cat] || cat,
    stock: items.filter(i => i.categoria === cat).reduce((a, i) => a + (i.stock || 0), 0),
    items: items.filter(i => i.categoria === cat).length
  }))

  const porDestino = ['ventas','taller','transporte','bajas'].map(d => ({
    name: {
      ventas:     isZh ? '销售出库' : 'Ventas',
      taller:     isZh ? '机修车间' : 'Taller',
      transporte: isZh ? '车队运输' : 'Transporte',
      bajas:      isZh ? '报废核销' : 'Bajas'
    }[d],
    value: salidas.filter(s => s.destino === d).length
  })).filter(d => d.value > 0)

  const sinPrecio  = items.filter(i => !i.precio || i.precio === 0).length
  const sinStock   = items.filter(i => !i.stock  || i.stock  === 0).length
  const stockBajo  = items.filter(i => i.stockMin && i.stock > 0 && i.stock <= i.stockMin).length
  const valorTotal = items.reduce((a, i) => a + ((i.precio || 0) * (i.stock || 0)), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>{isZh ? '数据统计与报表' : 'Panel de Reportes'}</h1>
        <button onClick={() => exportarInventarioExcel(items)} className="btn-secondary btn-sm">
          <Download size={14} /> {isZh ? '导出库存Excel' : 'Exportar inventario'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: isZh ? '物料总品种' : 'Total ítems',       val: items.length,                                   sub: isZh ? '在库目录' : 'en catálogo',       color: 'bg-primary text-white' },
          { label: isZh ? '存货估值总额' : 'Valor inventario',  val: `${valorTotal.toLocaleString()} Bs`,            sub: isZh ? '已核价物料' : 'ítems con precio',  color: 'bg-success text-white' },
          { label: isZh ? '出库总流水' : 'Total salidas',     val: salidas.length,                                  sub: `${salidas.filter(s=>s.estado==='pendiente').length} ${isZh ? '待确认' : 'pendientes'}`, color: 'bg-warning text-white' },
          { label: isZh ? '入库总流水' : 'Total ingresos',    val: ingresos.length,                                 sub: isZh ? '流转记录' : 'movimientos',       color: 'bg-primary-light text-white' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl p-5 ${k.color}`}>
            <p className="text-2xl font-bold">{k.val}</p>
            <p className="text-sm font-medium opacity-90">{k.label}</p>
            <p className="text-xs opacity-70 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Alertas */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: isZh ? '缺货断货' : 'Sin stock',    val: sinStock,  color: 'bg-red-50 border-red-200 text-red-700' },
          { label: isZh ? '库存预警' : 'Stock bajo',   val: stockBajo, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
          { label: isZh ? '未核单价' : 'Sin precio',   val: sinPrecio, color: 'bg-orange-50 border-orange-200 text-orange-700' },
        ].map(a => (
          <div key={a.label} className={`rounded-xl p-4 border ${a.color}`}>
            <p className="text-3xl font-bold">{a.val}</p>
            <p className="text-sm font-medium">{a.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stock por categoría */}
        <div className="card">
          <h3 className="mb-4">{isZh ? '各品类库存分布' : 'Stock por categoría'}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={porCategoria}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="stock" fill="#16241F" radius={[4,4,0,0]} name={isZh ? '库存总数' : 'Stock total'} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Salidas por destino */}
        <div className="card">
          <h3 className="mb-4">{isZh ? '出库去向分布' : 'Salidas por destino'}</h3>
          {porDestino.length === 0
            ? <p className="text-gray-400 text-sm text-center py-16">{isZh ? '暂无出库统计记录' : 'Sin salidas registradas'}</p>
            : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={porDestino} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {porDestino.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabla top items por stock */}
      <div className="card">
        <h3 className="mb-4">{isZh ? '在库库存量前 10 名物料' : 'Top 10 ítems por stock'}</h3>
        <div className="overflow-x-auto">
          <table className="table-auto w-full">
            <thead><tr>
              {[isZh ? '序号' : '#', isZh ? '编码' : 'Código', isZh ? '物料描述' : 'Descripción', isZh ? '类别' : 'Categoría', isZh ? '在库库存' : 'Stock', isZh ? '参考单价 (Bs)' : 'Precio (Bs)'].map(h => <th key={h} className="th">{h}</th>)}
            </tr></thead>
            <tbody>
              {[...items].sort((a,b) => (b.stock||0)-(a.stock||0)).slice(0,10).map((item, i) => (
                <tr key={item.id} className="tr-hover">
                  <td className="td text-gray-400 text-xs">{i+1}</td>
                  <td className="td font-mono text-primary font-semibold">{item.codigo}</td>
                  <td className="td font-medium">
                    <div>{(isZh && item.descripcionZh) ? item.descripcionZh : item.descripcion}</div>
                    {isZh && item.descripcionZh && <div className="text-[11px] text-gray-400">{item.descripcion}</div>}
                  </td>
                  <td className="td text-gray-500 text-xs">{CATEGORIAS_MAP[item.categoria] || item.categoria}</td>
                  <td className="td font-bold text-green-700">{item.stock ?? 0} {item.unidad}</td>
                  <td className="td">{item.precio ? `${Number(item.precio).toLocaleString()} Bs` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}