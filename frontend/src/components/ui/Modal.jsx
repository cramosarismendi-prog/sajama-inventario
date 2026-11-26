import { X } from 'lucide-react'
import { useEffect } from 'react'

export function Modal({ open, onClose, title, children, size = 'md', closeOnBackdrop = false, closeOnEsc = false, showCloseButton = true }) {
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
      <div className={`bg-white rounded-2xl shadow-2xl border border-[#E2E7E4] overflow-hidden w-full max-w-[96vw] ${sizes[size]} max-h-[92vh] flex flex-col my-auto`}>
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 bg-[#16241F] border-b border-white/10 shrink-0">
          <h3 className="text-base sm:text-lg font-semibold text-white truncate pr-2">{title}</h3>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors shrink-0"
              title="Cerrar ventana"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="overflow-y-auto flex-1 p-3 sm:p-6 bg-white">{children}</div>
      </div>
    </div>
  )
}