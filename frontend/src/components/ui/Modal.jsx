import { X } from 'lucide-react'
import { useEffect } from 'react'

export function Modal({ open, onClose, title, children, size = 'md', closeOnBackdrop = false, closeOnEsc = false }) {
  useEffect(() => {
    if (!closeOnEsc) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, closeOnEsc])

  if (!open) return null
  const sizes = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
          onClose?.()
        }
      }}
    >
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-[96vw] ${sizes[size]} max-h-[92vh] flex flex-col my-auto`}>
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-base sm:text-lg font-semibold text-primary truncate pr-2">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
            title="Cerrar ventana"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-3 sm:p-6">{children}</div>
      </div>
    </div>
  )
}