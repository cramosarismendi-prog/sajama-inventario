import { useState, useEffect } from 'react'
import { Search, Package, AlertTriangle, Scan } from 'lucide-react'
import { getItems } from '../services/inventario'
import { Badge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { useScannerQR, parsearQR } from '../hooks/useScannerQR'
import toast from 'react-hot-toast'

export default function Consultas() {
  const [items,   setItems]   = useState([])
  const [query,   setQuery]   = useState('')
  const [result,  setResult]  = useState(null)  // item encontrado | 'not_found'
  const [loading, setLoading] = useState(true)

  useEffect(() => { getItems().then(i => { setItems(i); setLoading(false) }) }, [])

  // ── Búsqueda principal ─────────────────────────────────────────────
  const buscar = (termino) => {
    const q = (termino || query).trim().toLowerCase()
    if (!q) return

    // 1. Código exacto (numérico)
    const porCodigoExacto = items.find(i => String(i.codigo) === q)
    if (porCodigoExacto) { setResult(porCodigoExacto); return }

    // 2. Serie exacta
    const porSerieExacta = items.find(i => i.serie && i.serie.toLowerCase() === q)
    if (porSerieExacta) { setResult(porSerieExacta); return }

    // 3. Descripción (contiene)
    const porDesc = items.filter(i =>
      i.descripcion?.toLowerCase().includes(q) ||
      i.descripcionZh?.toLowerCase().includes(q)
    )
    if (porDesc.length === 1) { setResult(porDesc[0]); return }
    if (porDesc.length > 1)   { setResult(porDesc);    return }  // múltiples resultados

    // 4. Modelo (contiene)
    const porModelo = items.filter(i => i.modelo?.toLowerCase().includes(q))
    if (porModelo.length === 1) { setResult(porModelo[0]); return }
    if (porModelo.length > 1)   { setResult(porModelo);    return }

    // 5. Serie (contiene)
    const porSerie = items.filter(i => i.serie?.toLowerCase().includes(q))
    if (porSerie.length === 1) { setResult(porSerie[0]); return }
    if (porSerie.length > 1)   { setResult(porSerie);    return }

    setResult('not_found')
  }

  // ── Scanner QR integrado ───────────────────────────────────────────
  const { escuchando, activar, desactivar } = useScannerQR((textoQR) => {
    const parsed = parsearQR(textoQR)
    if (!parsed) { toast.error('QR no reconocido'); return }

    // Buscar por serie (primera parte del QR) o descripción
    const porSerie = items.find(i => i.serie && i.serie === parsed.serie)
    if (porSerie) {
      setQuery(parsed.serie)
      setResult(porSerie)
      toast.success('Producto encontrado: ' + porSerie.descripcion)
    } else {
      // Buscar por descripción
      const q = parsed.descripcion.toLowerCase()
      const porDesc = items.find(i => i.descripcion?.toLowerCase().includes(q))
      if (porDesc) {
        setQuery(parsed.descripcion)
        setResult(porDesc)
        toast.success('Producto encontrado: ' + porDesc.descripcion)
      } else {
        setQuery(parsed.serie)
        setResult('not_found')
        toast.error('No encontrado: ' + parsed.descripcion)
      }
    }
    desactivar()
  })

  const handleKeyDown = (e) => { if (e.key === 'Enter') buscar() }

  const limpiar = () => { setQuery(''); setResult(null) }

  if (loading) return <PageLoader />

  // Múltiples resultados
  const esLista = Array.isArray(result)

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <h1>Consulta de Ítem</h1>
        <p className="text-sm text-gray-500 mt-1">
          Busca por código exacto, descripción, modelo o número de serie
        </p>
      </div>

      {/* Barra de búsqueda + scanner */}
      <div className="card space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input className="input pl-9 text-base"
              placeholder="Código, descripción, modelo o N° de serie..."
              value={query}
              onChange={e => { setQuery(e.target.value); setResult(null) }}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button onClick={() => buscar()} className="btn-primary">Buscar</button>
          <button
            onClick={escuchando ? desactivar : activar}
            className={escuchando ? 'btn-danger' : 'btn-secondary'}
            title="Escanear QR">
            <Scan size={16}/>
          </button>
        </div>

        {/* Tips de búsqueda */}
        <div className="flex flex-wrap gap-2 text-xs text-gray-400">
          <span>Buscar por:</span>
          {[
            ['Código', 'Ej: 4'],
            ['Descripción', 'Ej: filtro'],
            ['Modelo', 'Ej: 8PK1068'],
            ['N° Serie', 'Ej: 11212087'],
          ].map(([tipo, ej]) => (
            <span key={tipo} className="bg-gray-100 rounded px-2 py-0.5">
              <b>{tipo}</b> — {ej}
            </span>
          ))}
        </div>

        {/* Banner scanner activo */}
        {escuchando && (
          <div className="bg-primary text-white rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
            <Scan size={15} className="animate-pulse shrink-0"/>
            <span>Scanner activo — escanea el QR del producto</span>
            <button onClick={desactivar} className="ml-auto text-white/70 hover:text-white text-xs underline">
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* No encontrado */}
      {result === 'not_found' && (
        <div className="card border-red-100 bg-red-50 flex items-center gap-3">
          <AlertTriangle size={20} className="text-red-500 shrink-0"/>
          <div>
            <p className="font-semibold text-red-700">No se encontró ningún ítem</p>
            <p className="text-xs text-red-500 mt-0.5">
              Verifica el código, descripción o número de serie e intenta de nuevo.
            </p>
          </div>
          <button onClick={limpiar} className="ml-auto btn-secondary btn-sm">Limpiar</button>
        </div>
      )}

      {/* Múltiples resultados */}
      {esLista && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-gray-700">{result.length} resultados encontrados</p>
            <button onClick={limpiar} className="btn-secondary btn-sm">Limpiar</button>
          </div>
          {result.map(item => (
            <div key={item.id}
              onClick={() => setResult(item)}
              className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-primary-pale hover:border-primary-light cursor-pointer transition-colors">
              <div>
                <p className="font-medium text-sm">{item.descripcion}</p>
                {item.descripcionZh && <p className="text-xs text-gray-400">{item.descripcionZh}</p>}
                <p className="text-xs text-gray-400 mt-0.5">
                  Cód: <b className="text-primary">{item.codigo}</b>
                  {item.serie && <> · S/N: <b>{item.serie}</b></>}
                  {item.modelo && <> · {item.modelo}</>}
                </p>
              </div>
              <Badge tipo={item.stock > 0 ? 'green' : 'red'}>
                {item.stock > 0 ? `${item.stock} ${item.unidad}` : 'Sin stock'}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Resultado único */}
      {result && !esLista && result !== 'not_found' && (
        <div className="card space-y-4">
          <div className="flex items-start gap-4">
            {result.fotoUrl
              ? <img src={result.fotoUrl} alt="foto"
                  className="w-16 h-16 rounded-xl object-cover border border-gray-200 shrink-0"/>
              : <div className="w-16 h-16 bg-primary-pale rounded-xl flex items-center justify-center shrink-0">
                  <Package size={28} className="text-primary"/>
                </div>
            }
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-800">{result.descripcion}</h2>
              {result.descripcionZh && (
                <p className="text-gray-500 text-base">{result.descripcionZh}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Código: <span className="font-mono font-bold text-primary">{result.codigo}</span>
              </p>
            </div>
            <div className="text-right shrink-0">
              {result.stock > 0
                ? <span className="text-3xl font-bold text-green-600">{result.stock}</span>
                : <span className="text-3xl font-bold text-red-500">0</span>}
              <p className="text-xs text-gray-400">{result.unidad} en stock</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Categoría',    result.categoria   || '—'],
              ['Modelo',       result.modelo      || '—'],
              ['N° de serie',  result.serie       || '—'],
              ['Ubicación',    result.ubicacion   || '—'],
              ['Stock mínimo', result.stockMin ? `${result.stockMin} ${result.unidad}` : '—'],
              ['Precio',       result.precio ? `${Number(result.precio).toLocaleString()} Bs` : 'Sin precio'],
            ].map(([k, v]) => (
              <div key={k} className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-0.5">{k}</p>
                <p className="font-medium text-gray-800">{v}</p>
              </div>
            ))}
          </div>

          {result.notas && (
            <div className="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-800">
              <p className="text-xs font-semibold mb-1">Notas:</p>
              <p>{result.notas}</p>
            </div>
          )}

          {result.stock === 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
              <AlertTriangle size={16}/> <b>Sin stock disponible.</b> Se requiere ingreso.
            </div>
          )}
          {result.stockMin && result.stock > 0 && result.stock <= result.stockMin && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2 text-yellow-700 text-sm">
              <AlertTriangle size={16}/> <b>Stock bajo.</b> Actual ({result.stock}) ≤ mínimo ({result.stockMin}).
            </div>
          )}

          <button onClick={limpiar} className="btn-secondary btn-sm w-full">
            Nueva búsqueda
          </button>
        </div>
      )}

      {/* Lista de stock crítico cuando no hay búsqueda */}
      {!result && !query && (
        <div className="card">
          <h3 className="mb-3">⚠️ Ítems con stock crítico</h3>
          <div className="space-y-2">
            {items
              .filter(i => !i.stock || i.stock === 0 || (i.stockMin && i.stock <= i.stockMin))
              .slice(0, 8)
              .map(i => (
                <div key={i.id}
                  onClick={() => { setQuery(String(i.codigo)); setResult(i) }}
                  className="flex items-center justify-between py-2 px-3 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer transition">
                  <div>
                    <span className="text-sm font-medium">{i.descripcion}</span>
                    {i.descripcionZh && <span className="text-xs text-gray-400 ml-2">{i.descripcionZh}</span>}
                  </div>
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
