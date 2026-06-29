import { useState, useEffect } from 'react'
import { Search, Package, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react'
import { getItems } from '../services/inventario'
import { Badge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'

export default function Consultas() {
  const [items,  setItems]  = useState([])
  const [query,  setQuery]  = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { getItems().then(i => { setItems(i); setLoading(false) }) }, [])

  const handleSearch = () => {
    const q = query.trim().toLowerCase()
    if (!q) return
    const found = items.find(i =>
      i.codigo?.toString() === q ||
      i.descripcion?.toLowerCase().includes(q) ||
      i.modelo?.toLowerCase().includes(q)
    )
    setResult(found || 'not_found')
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1>Consulta de Ítem</h1>
        <p className="text-sm text-gray-500 mt-1">Busca por código, descripción o número de modelo</p>
      </div>

      <div className="card">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-10 text-base" placeholder="Ej: 39 · Correa · 8PK1068"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          </div>
          <button onClick={handleSearch} className="btn-primary">Buscar</button>
        </div>
      </div>

      {result === 'not_found' && (
        <div className="card border-red-100 bg-red-50 text-red-700 flex items-center gap-3">
          <AlertTriangle size={20} />
          <p className="text-sm">No se encontró ningún ítem con ese criterio de búsqueda.</p>
        </div>
      )}

      {result && result !== 'not_found' && (
        <div className="card space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-primary-pale rounded-xl flex items-center justify-center shrink-0">
              <Package size={24} className="text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800">{result.descripcion}</h2>
              <p className="text-gray-500 text-sm">Código: <b className="text-primary font-mono">{result.codigo}</b></p>
            </div>
            <div className="text-right">
              {result.stock > 0
                ? <span className="text-3xl font-bold text-green-600">{result.stock}</span>
                : <span className="text-3xl font-bold text-red-500">0</span>}
              <p className="text-xs text-gray-400">{result.unidad} en stock</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Categoría',   result.categoria  || '—'],
              ['Modelo',      result.modelo     || '—'],
              ['Nº de serie', result.serie      || '—'],
              ['Stock mínimo',result.stockMin ? `${result.stockMin} ${result.unidad}` : '—'],
              ['Precio',      result.precio ? `${Number(result.precio).toLocaleString()} Bs` : 'Sin precio'],
              ['Notas',       result.notas      || '—'],
            ].map(([k, v]) => (
              <div key={k} className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-0.5">{k}</p>
                <p className="font-medium text-gray-800">{v}</p>
              </div>
            ))}
          </div>

          {result.stock === 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
              <AlertTriangle size={16} /> <b>Sin stock disponible.</b> Se requiere ingreso.
            </div>
          )}
          {result.stockMin && result.stock > 0 && result.stock <= result.stockMin && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2 text-yellow-700 text-sm">
              <AlertTriangle size={16} /> <b>Stock bajo.</b> Stock actual ({result.stock}) ≤ mínimo ({result.stockMin}).
            </div>
          )}
        </div>
      )}

      {/* Lista rápida de stock crítico */}
      {!result && (
        <div className="card">
          <h3 className="mb-3">⚠️ Ítems con stock crítico</h3>
          <div className="space-y-2">
            {items.filter(i => !i.stock || i.stock === 0 || (i.stockMin && i.stock <= i.stockMin))
              .slice(0, 8)
              .map(i => (
                <div key={i.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 rounded px-2 transition"
                  onClick={() => { setQuery(i.codigo?.toString()); setResult(i) }}>
                  <span className="text-sm font-medium">{i.descripcion}</span>
                  <Badge tipo={i.stock === 0 ? 'red' : 'yellow'}>
                    {i.stock === 0 ? 'Sin stock' : `Stock bajo: ${i.stock}`}
                  </Badge>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}