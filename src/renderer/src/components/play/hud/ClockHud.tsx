import { Hourglass } from 'lucide-react'
import type { ClockView } from '../../../game/explore/WorldClock'
import type { ClockControls } from '../../worlds/PlayStage'
import { Eyebrow, Popover } from '../../ui'
import { cn } from '../../../lib/cn'
import { ShortRestPop, type RestMember } from './ShortRestPop'
import { LongRestPop } from './LongRestPop'

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
  party = [],
  offsetRight = false
}: {
  view: ClockView
  controls: ClockControls | null
  party?: RestMember[]
  offsetRight?: boolean
}) {
  const { calendar } = view
  const waits = [
    { label: '1 round', seconds: view.roundSeconds },
    { label: '10 min', seconds: view.hourSeconds / 6 },
    { label: '1 h', seconds: view.hourSeconds },
    { label: 'Until dawn', seconds: view.toDawn }
  ]

  return (
    <div
      className={`pointer-events-auto absolute top-2.5 z-20 flex items-stretch border border-line/60 bg-black/90 transition-all duration-300 ease-out ${
        offsetRight ? 'right-[360px]' : 'right-3'
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
      <div className={cn('flex items-center gap-0.5 border-l border-line/40 px-1', !controls && 'opacity-35')}>
        <Popover
          title="Wait"
          disabled={!controls}
          triggerClassName="flex h-7 min-w-8 items-center justify-center border border-transparent px-1 text-dim hover:bg-white/5 hover:text-white"
          trigger={<Hourglass className="h-3.5 w-3.5" />}
          className="notch-sm flex flex-col gap-2.5 p-3"
        >
          {(close) => (
            <>
              <Eyebrow>Wait</Eyebrow>
              <div className="flex flex-wrap gap-1.5">
                {waits.map((w) => (
                  <button
                    key={w.label}
                    type="button"
                    onClick={() => {
                      controls?.pass(w.seconds, 'wait')
                      close()
                    }}
                    className="border border-line/60 px-2.5 py-1 font-mono text-[12px] text-dim hover:border-dim hover:text-white"
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </Popover>
        <ShortRestPop controls={controls} party={party} label={view.shortRestLabel} />
        <LongRestPop controls={controls} waitHours={Math.ceil(view.longRestIn / view.hourSeconds)} label={view.longRestLabel} />
      </div>
    </div>
  )
}
