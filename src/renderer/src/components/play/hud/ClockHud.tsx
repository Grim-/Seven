import { Pause } from 'lucide-react'
import type { ClockView } from '../../../game/explore/WorldClock'
import type { ClockControls } from '../../worlds/PlayStage'
import { cn } from '../../../lib/cn'

function SkyArc({ dayPart }: { dayPart: number }) {
  const day = dayPart >= 0.25 && dayPart < 0.75
  const t = day ? (dayPart - 0.25) / 0.5 : (((dayPart - 0.75 + 1) % 1) / 0.5)
  const angle = Math.PI * (1 - t)
  const x = 36 + 28 * Math.cos(angle)
  const y = 32 - 28 * Math.sin(angle)
  return (
    <svg width="72" height="36" viewBox="0 0 72 38" role="img" aria-label={day ? 'Day' : 'Night'}>
      <path d="M8 32 A28 28 0 0 1 64 32" fill="none" stroke="var(--color-line)" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="2" y1="32" x2="70" y2="32" stroke="var(--color-faint)" strokeWidth="1" />
      <circle cx={x} cy={y} r="5" fill={day ? 'var(--color-accent)' : 'var(--color-cyan)'} opacity={day ? 1 : 0.8} />
    </svg>
  )
}

const two = (n: number) => String(n).padStart(2, '0')

export function ClockHud({ view, controls }: { view: ClockView; controls: ClockControls | null }) {
  const { calendar } = view
  const button = (on: boolean) => cn('flex h-8 min-w-9 items-center justify-center border px-1.5 font-mono text-[12px] font-bold', on ? 'border-accent bg-accent text-black' : 'border-transparent text-dim hover:text-white')
  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-stretch border border-line/60 bg-black/90">
      <div className="flex items-center gap-2.5 py-1 pl-2 pr-3" title={view.label}>
        <SkyArc dayPart={view.dayPart} />
        <div className="flex flex-col leading-tight">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim">Day {calendar.day}</span>
          <span className="font-mono text-[19px] font-bold text-white">
            {two(calendar.hour)}:{two(calendar.minute)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 border-l border-line/50 px-1.5">
        <button type="button" title={view.paused ? 'Paused' : 'Pause'} aria-label="Pause" disabled={!controls} onClick={() => controls?.setPaused(!view.paused)} className={button(view.paused)}>
          <Pause className="h-3.5 w-3.5" />
        </button>
        {view.speeds.map((s) => (
          <button key={s} type="button" title={`${s}× speed`} disabled={!controls} onClick={() => controls?.setSpeed(s)} className={button(!view.paused && view.speed === s)}>
            {s}×
          </button>
        ))}
      </div>
    </div>
  )
}
