import type { DieFace } from '@shared/game/rules'
import { cn } from '../../../lib/cn'
import { Die } from '../Die'

export interface TallyLine {
  label: string
  value: string
}

export function RollTally({ title, faces, rolling, lines, total, needs, verdict }: { title?: string; faces: DieFace[] | null; rolling: boolean; lines: TallyLine[]; total: string; needs?: string; verdict: boolean | null }) {
  const shown = faces ?? [{ sides: 20, face: 0 }]
  return (
    <div className={cn('flex flex-col gap-2 border bg-white/[0.02] p-3', verdict === null || rolling ? 'border-accent/30' : verdict ? 'border-ok/50' : 'border-alert/40')}>
      {title && <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim">{title}</span>}
      <div className="flex items-center gap-4">
        <div className="flex flex-wrap gap-1.5">
          {shown.map((f, i) => (
            <Die key={i} value={faces ? f.face : null} sides={f.sides} rolling={rolling} />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-[13px]">
          {lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-3">
              <span className="truncate text-dim">{l.label}</span>
              <span className="font-mono text-white/90">{l.value}</span>
            </div>
          ))}
          <div className="my-0.5 h-px bg-accent/30" />
          <div className="flex justify-between gap-3 text-[14px] font-semibold text-white">
            <span>Total</span>
            <span className="font-mono">{total}</span>
          </div>
          {needs && (
            <div className="flex justify-between gap-3 text-[12.5px] text-dim">
              <span>Needs</span>
              <span>{needs}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
