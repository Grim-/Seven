import type { MouseEvent } from 'react'

export function DieButton({ sides, count, onAdd, onRemove }: { sides: number; count: number; onAdd: () => void; onRemove: (e?: MouseEvent) => void }) {
  return (
    <span className="relative">
      <button type="button" title={`Add a d${sides}`} onClick={onAdd} onContextMenu={onRemove} className="group relative grid h-11 w-11 place-items-center font-mono text-[11px] font-bold text-dim hover:text-white">
        <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full text-line group-hover:text-accent">
          <polygon points="20,2 37,11 37,29 20,38 3,29 3,11" fill="rgba(0,0,0,0.6)" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        <span className="relative">d{sides}</span>
      </button>
      {count > 0 && (
        <button type="button" title={`Take a d${sides} away`} onClick={() => onRemove()} className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center bg-accent px-0.5 font-mono text-[10px] font-bold text-black">
          {count}
        </button>
      )}
    </span>
  )
}
