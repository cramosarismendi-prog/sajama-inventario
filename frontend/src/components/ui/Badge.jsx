export function Badge({ tipo = 'blue', children }) {
  const estilos = {
    green:   'bg-green-100 text-green-800',
    red:     'bg-red-100 text-red-700',
    yellow:  'bg-yellow-100 text-amber-800',
    orange:  'bg-orange-100 text-orange-800',
    blue:    'bg-[#EDF1EF] text-[#1E2E28] border border-[#DCE3DF]',
    neutral: 'bg-[#EDF1EF] text-[#1E2E28] border border-[#DCE3DF]',
    brand:   'bg-[#16241F] text-[#E4D825]',
    gray:    'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estilos[tipo] || estilos.neutral}`}>
      {children}
    </span>
  )
}