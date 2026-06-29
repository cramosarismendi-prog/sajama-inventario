import { AlertTriangle } from 'lucide-react'

export function Confirm({ open, mensaje, onConfirm, onCancel, tipo = 'danger' }) {
  if (!open) return null
  const colores = {
    danger:  'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className={`flex items-start gap-3 mb-4 p-3 rounded-lg border ${colores[tipo]}`}>
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm">{mensaje}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary btn-sm">Cancelar</button>
          <button onClick={onConfirm} className={tipo === 'danger' ? 'btn-danger btn-sm' : 'btn-primary btn-sm'}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}