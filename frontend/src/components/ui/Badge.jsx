export function Badge({ tipo = 'blue', children }) {
  const estilos = {
    green:  'bg-green-100 text-green-800',
    red:    'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-800',
    blue:   'bg-blue-100 text-blue-700',
    gray:   'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estilos[tipo] || estilos.blue}`}>
      {children}
    </span>
  )
}