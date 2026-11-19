import { useState, useRef, useEffect } from 'react'
import { Modal } from './Modal'
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, X, Move } from 'lucide-react'

export function ModalVerFotoZoom({ open, onClose, fotoUrl, titulo, subtitulo }) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const imageContainerRef = useRef(null)

  // Resetear estado al abrir/cerrar modal o cambiar de foto
  useEffect(() => {
    if (open) {
      setScale(1)
      setPosition({ x: 0, y: 0 })
      setIsDragging(false)
    }
  }, [open, fotoUrl])

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 5))
  }

  const handleZoomOut = () => {
    setScale((prev) => {
      const nextScale = Math.max(prev - 0.5, 1)
      if (nextScale === 1) setPosition({ x: 0, y: 0 })
      return nextScale
    })
  }

  const handleReset = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY < 0 ? 0.25 : -0.25
    setScale((prev) => {
      const nextScale = Math.min(Math.max(prev + delta, 1), 5)
      if (nextScale === 1) setPosition({ x: 0, y: 0 })
      return nextScale
    })
  }

  const handleMouseDown = (e) => {
    if (scale <= 1) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = (e) => {
    if (!isDragging || scale <= 1) return
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleDoubleClick = () => {
    if (scale > 1) {
      handleReset()
    } else {
      setScale(2.5)
    }
  }

  if (!open || !fotoUrl) return null

  return (
    <Modal open={open} onClose={onClose} title={titulo || 'Visualizador de Imagen'} size="lg">
      <div className="space-y-3">
        {subtitulo && <p className="text-xs text-gray-500 font-medium -mt-2">{subtitulo}</p>}

        {/* Barra de Herramientas de Zoom */}
        <div className="flex items-center justify-between bg-gray-100/80 p-2 rounded-xl border border-gray-200 text-xs select-none">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= 5}
              className="p-1.5 rounded-lg bg-white shadow-xs hover:bg-gray-50 text-gray-700 disabled:opacity-40 transition-all"
              title="Acercar (+)"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= 1}
              className="p-1.5 rounded-lg bg-white shadow-xs hover:bg-gray-50 text-gray-700 disabled:opacity-40 transition-all"
              title="Alejar (-)"
            >
              <ZoomOut size={16} />
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={scale === 1 && position.x === 0 && position.y === 0}
              className="p-1.5 rounded-lg bg-white shadow-xs hover:bg-gray-50 text-gray-700 disabled:opacity-40 transition-all flex items-center gap-1"
              title="Restablecer (100%)"
            >
              <RotateCcw size={14} />
              <span className="font-mono text-[11px] font-semibold">{Math.round(scale * 100)}%</span>
            </button>
          </div>

          <div className="text-[11px] text-gray-500 flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 text-gray-400">
              <Move size={12} /> Arrastra para mover | Rueda del mouse para zoom
            </span>
          </div>
        </div>

        {/* Contenedor de la Imagen con Zoom y Arrastre */}
        <div
          ref={imageContainerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          className={`relative w-full h-[65vh] max-h-[500px] bg-black/95 rounded-2xl overflow-hidden flex items-center justify-center select-none ${
            scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
          }`}
        >
          <img
            src={fotoUrl}
            alt={titulo || 'Foto ampliada'}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            }}
            className="max-w-full max-h-full object-contain pointer-events-none"
          />

          {scale > 1 && (
            <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-1 rounded-md border border-white/10">
              Zoom: {Math.round(scale * 100)}%
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
