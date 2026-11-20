import { useState } from 'react'
import { Flame } from 'lucide-react'
import type { ClockControls } from '../../worlds/PlayStage'
import { CountStepper, Eyebrow, Popover } from '../../ui'

export interface RestMember {
  sheet: string
  name: string
  hitDice: { total: string; used: number } | null
}

const HUD_BUTTON = 'flex h-7 min-w-8 items-center justify-center border border-transparent px-1 text-dim hover:bg-white/5 hover:text-white'
const count = (total: string): number => Number(/^\s*(\d+)/.exec(total)?.[1] ?? 0)

export function ShortRestPop({ controls, party, label }: { controls: ClockControls | null; party: RestMember[]; label: string }) {
  const [spend, setSpend] = useState<Record<string, number>>({})
  return (
    <Popover title={`Short rest · ${label}`} disabled={!controls} triggerClassName={HUD_BUTTON} trigger={<Flame className="h-3.5 w-3.5" />} className="notch-sm flex w-[17rem] flex-col gap-2.5 p-3">
      {(close) => (
        <>
          <Eyebrow>Short rest · {label}</Eyebrow>
          {party.map((m) => {
            const left = m.hitDice ? count(m.hitDice.total) - m.hitDice.used : 0
            return (
              <div key={m.sheet} className="flex items-center gap-2 font-mono text-[11px]">
                <span className="min-w-0 flex-1 truncate text-white">{m.name}</span>
                {m.hitDice && (
                  <>
                    <span className="text-dim">{m.hitDice.total.replace(/^\s*\d+/, '')}</span>
                    <span className="text-cyan">{left}</span>
                    <CountStepper small value={spend[m.sheet] ?? 0} min={0} max={left} onChange={(n) => setSpend({ ...spend, [m.sheet]: n })} />
                  </>
                )}
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => {
              controls?.shortRest(spend)
              setSpend({})
              close()
            }}
            className="notch-sm flex h-7 items-center justify-center gap-1.5 border border-accent bg-gradient-to-b from-accent/20 to-accent/5 font-mono text-[11px] font-semibold uppercase tracking-wider text-accent hover:text-white"
          >
            <Flame className="h-3.5 w-3.5" />
            Rest
          </button>
        </>
      )}
    </Popover>
  )
}
