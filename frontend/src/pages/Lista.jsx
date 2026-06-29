export default function Lista() {
  const AUTORIZADORES = [
    { modulo: 'Salidas (todas)', autorizadores: ['Administrador', 'Gerencia', 'Almacenero'] },
    { modulo: 'Ingresos',       autorizadores: ['Administrador', 'Almacenero'] },
    { modulo: 'Usuarios',       autorizadores: ['Administrador'] },
    { modulo: 'Reportes',       autorizadores: ['Administrador', 'Gerencia', 'Contabilidad', 'Personal Chino'] },
    { modulo: 'Catálogo',       autorizadores: ['Administrador', 'Almacenero'] },
  ]

  return (
    <div className="space-y-6">
      <h1>Lista Maestra / 主列表</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Autorizaciones */}
        <div className="card">
          <h3 className="mb-4">Matriz de autorizaciones</h3>
          <div className="space-y-3">
            {AUTORIZADORES.map(a => (
              <div key={a.modulo} className="border border-gray-100 rounded-lg p-3">
                <p className="font-semibold text-sm text-primary mb-2">{a.modulo}</p>
                <div className="flex flex-wrap gap-1.5">
                  {a.autorizadores.map(r => (
                    <span key={r} className="bg-primary-pale text-primary text-xs px-2 py-0.5 rounded-full">{r}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {/* Fuentes de ingreso */}
          <div className="card">
            <h3 className="mb-4">Fuentes de ingreso</h3>
            {[['Importación','进口','Mercadería importada directamente'],
              ['Compra local','本地采购','Compras a proveedores locales'],
              ['Devolución','退货','Ítems devueltos al almacén']].map(([es, zh, desc]) => (
              <div key={es} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{es} / <span className="text-gray-400">{zh}</span></p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Destinos de salida */}
          <div className="card">
            <h3 className="mb-4">Destinos de salida</h3>
            {[['Ventas','销售','Venta directa al cliente'],
              ['Taller Mecánico','维修车间','Uso interno en taller'],
              ['Transporte','运输','Salida por transporte'],
              ['Bajas','报废','Ítem dado de baja']].map(([es, zh, desc]) => (
              <div key={es} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-2 h-2 bg-warning rounded-full mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{es} / <span className="text-gray-400">{zh}</span></p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Categorías */}
      <div className="card">
        <h3 className="mb-4">Categorías de ítems / 物品类别</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[['Maquinarias','机械','Equipos pesados'],
            ['Equipos','设备','Equipos menores'],
            ['Repuestos','备件','Piezas de repuesto'],
            ['Materiales','材料','Materiales de uso'],
            ['Insumos','耗材','Consumibles']].map(([es, zh, desc]) => (
            <div key={es} className="bg-primary-pale rounded-xl p-4 text-center">
              <p className="font-bold text-primary">{es}</p>
              <p className="text-lg text-gray-600">{zh}</p>
              <p className="text-xs text-gray-400 mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}