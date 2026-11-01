import { Maximize2, Minus, Plus } from 'lucide-react'

export function ZoomControls({ onIn, onOut, onFit }: { onIn: () => void; onOut: () => void; onFit: () => void }) {
  const button = 'flex h-7 w-7 items-center justify-center text-accent hover:bg-accent/10'
  return (
    <div className="absolute bottom-2.5 right-2.5 z-10 flex flex-col divide-y divide-line/50 border border-line/60 bg-black/85">
      <button type="button" title="Zoom in" onClick={onIn} className={button}>
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button type="button" title="Zoom out" onClick={onOut} className={button}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button type="button" title="Fit" onClick={onFit} className={button}>
        <Maximize2 className="h-3 w-3" />
      </button>
    </div>
  )
}
