import { useTranslation } from 'react-i18next'

export default function Lista() {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'

  const AUTORIZADORES = [
    {
      moduloEs: 'Salidas (todas)',
      moduloZh: '出库单据 (全量)',
      autorizadores: [
        { es: 'Administrador', zh: '超级管理员' },
        { es: 'Gerencia', zh: '总经理室' },
        { es: 'Almacenero', zh: '仓库主管' },
      ]
    },
    {
      moduloEs: 'Ingresos',
      moduloZh: '入库单据',
      autorizadores: [
        { es: 'Administrador', zh: '超级管理员' },
        { es: 'Almacenero', zh: '仓库主管' },
      ]
    },
    {
      moduloEs: 'Usuarios',
      moduloZh: '用户与权限管理',
      autorizadores: [
        { es: 'Administrador', zh: '超级管理员' },
      ]
    },
    {
      moduloEs: 'Reportes',
      moduloZh: '统计报表与审计',
      autorizadores: [
        { es: 'Administrador', zh: '超级管理员' },
        { es: 'Gerencia', zh: '总经理室' },
        { es: 'Contabilidad', zh: '财务部' },
        { es: 'Personal Chino', zh: '中方管理层' },
      ]
    },
    {
      moduloEs: 'Catálogo',
      moduloZh: '物料主目录',
      autorizadores: [
        { es: 'Administrador', zh: '超级管理员' },
        { es: 'Almacenero', zh: '仓库主管' },
      ]
    },
  ]

  return (
    <div className="space-y-6">
      <h1>{isZh ? '主数据目录 / Lista Maestra' : 'Lista Maestra / 主列表'}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Autorizaciones */}
        <div className="card">
          <h3 className="mb-4">{isZh ? '模块审批权限矩阵' : 'Matriz de autorizaciones'}</h3>
          <div className="space-y-3">
            {AUTORIZADORES.map(a => (
              <div key={a.moduloEs} className="border border-gray-100 rounded-lg p-3">
                <p className="font-semibold text-sm text-primary mb-2">
                  {isZh ? a.moduloZh : a.moduloEs}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {a.autorizadores.map(r => (
                    <span key={r.es} className="bg-primary-pale text-primary text-xs px-2 py-0.5 rounded-full">
                      {isZh ? r.zh : r.es}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {/* Fuentes de ingreso */}
          <div className="card">
            <h3 className="mb-4">{isZh ? '入库来源与通道' : 'Fuentes de ingreso'}</h3>
            {[
              ['Importación','进口', isZh ? '海关清关直接进口物资' : 'Mercadería importada directamente'],
              ['Compra local','本地采购', isZh ? '本地市场与供应商采购' : 'Compras a proveedores locales'],
              ['Devolución','退货', isZh ? '施工现场或部门退库物料' : 'Ítems devueltos al almacén']
            ].map(([es, zh, desc]) => (
              <div key={es} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{isZh ? `${zh} · ${es}` : `${es} / ${zh}`}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Destinos de salida */}
          <div className="card">
            <h3 className="mb-4">{isZh ? '出库去向与部门' : 'Destinos de salida'}</h3>
            {[
              ['Ventas','销售', isZh ? '直接向外部客户销售出库' : 'Venta directa al cliente'],
              ['Taller Mecánico','维修车间', isZh ? '机修车间维保领用' : 'Uso interno en taller'],
              ['Transporte','运输', isZh ? '车队或运输领用派送' : 'Salida por transporte'],
              ['Bajas','报废', isZh ? '损坏老化报废核销' : 'Ítem dado de baja']
            ].map(([es, zh, desc]) => (
              <div key={es} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-2 h-2 bg-warning rounded-full mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{isZh ? `${zh} · ${es}` : `${es} / ${zh}`}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Categorías */}
      <div className="card">
        <h3 className="mb-4">{isZh ? '物品主类别 / Categorías' : 'Categorías de ítems / 物品类别'}</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ['Maquinarias','机械', isZh ? '重型工程机械设备' : 'Equipos pesados'],
            ['Equipos','设备', isZh ? '发电机、小型工程设备' : 'Equipos menores'],
            ['Repuestos','备件', isZh ? '机械零配件、易损件' : 'Piezas de repuesto'],
            ['Materiales','材料', isZh ? '基建工程原材料' : 'Materiales de uso'],
            ['Insumos','耗材', isZh ? '日常消耗品与润滑油品' : 'Consumibles']
          ].map(([es, zh, desc]) => (
            <div key={es} className="bg-primary-pale rounded-xl p-4 text-center">
              <p className="font-bold text-primary">{isZh ? zh : es}</p>
              <p className="text-lg text-gray-600">{isZh ? es : zh}</p>
              <p className="text-xs text-gray-400 mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}