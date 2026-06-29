import { PackageOpen } from 'lucide-react'

export function EmptyState({ mensaje = 'Sin datos', icono }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      {icono || <PackageOpen size={48} className="mb-3 opacity-40" />}
      <p className="text-sm">{mensaje}</p>
    </div>
  )
}