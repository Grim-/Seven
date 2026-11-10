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
    <svg width="60" height="30" viewBox="0 0 72 38" role="img" aria-label={day ? 'Day' : 'Night'}>
      <path d="M8 32 A28 28 0 0 1 64 32" fill="none" stroke="var(--color-line)" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="2" y1="32" x2="70" y2="32" stroke="var(--color-faint)" strokeWidth="1" />
      <circle cx={x} cy={y} r="5" fill={day ? 'var(--color-accent)' : 'var(--color-cyan)'} opacity={day ? 1 : 0.8} />
    </svg>
  )
}

const two = (n: number) => String(n).padStart(2, '0')

export function ClockHud({
  view,
  controls,
  offsetRight = false
}: {
  view: ClockView
  controls: ClockControls | null
  offsetRight?: boolean
}) {
  const { calendar } = view
  const isPaused = view.paused

  const button = (on: boolean) =>
    cn(
      'flex h-7 min-w-8 items-center justify-center border px-1 font-mono text-[11px] font-bold transition-colors',
      on
        ? 'border-accent bg-accent text-black'
        : 'border-transparent text-dim hover:text-white hover:bg-white/5'
    )

  return (
    <div
      className={`pointer-events-auto absolute top-2.5 z-20 flex items-stretch transition-all duration-300 ease-out ${
        offsetRight ? 'right-[360px]' : 'right-3'
      } ${
        isPaused
          ? 'border border-accent/80 bg-black/95 opacity-100 shadow-[0_4px_20px_rgba(245,158,11,0.3)] backdrop-blur'
          : 'border border-line/30 bg-black/30 opacity-40 backdrop-blur-sm hover:border-line/80 hover:bg-black/90 hover:opacity-100 hover:shadow-[0_4px_20px_rgba(0,0,0,0.8)]'
      }`}
    >
      <div className="flex items-center gap-2 py-0.5 pl-2 pr-2.5" title={view.label}>
        <SkyArc dayPart={view.dayPart} />
        <div className="flex flex-col leading-tight">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-dim">
            Day {calendar.day}
          </span>
          <span className="font-mono text-[16px] font-bold text-white">
            {two(calendar.hour)}:{two(calendar.minute)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 border-l border-line/40 px-1">
        <button
          type="button"
          title={isPaused ? 'Resume' : 'Pause'}
          aria-label={isPaused ? 'Resume' : 'Pause'}
          disabled={!controls}
          onClick={() => controls?.setPaused(!isPaused)}
          className={button(isPaused)}
        >
          <Pause className="h-3 w-3" />
        </button>
        {view.speeds.map((s) => (
          <button
            key={s}
            type="button"
            title={`${s}× speed`}
            disabled={!controls}
            onClick={() => controls?.setSpeed(s)}
            className={button(!isPaused && view.speed === s)}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  )
}
