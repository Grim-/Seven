import { refName } from '@shared/story'
import { openEntry } from '../../../../lib/library'

export function RefChip({ kind, ref: id, label, count }: { kind: string; ref: string; label?: string; count?: number }) {
  return (
    <button onClick={() => openEntry(kind, id)} title={`Open ${refName(id)}`} className="flex items-baseline gap-1.5 border border-line/50 px-2 py-0.5 text-[12px] text-dim hover:border-accent/60 hover:text-white">
      {label && <span className="font-mono text-[10px] uppercase text-faint">{label}</span>}
      {refName(id)}
      {count !== undefined && <span className="font-mono text-[10.5px] text-faint">{count}</span>}
    </button>
  )
}
