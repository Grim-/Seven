import { Moon } from 'lucide-react'
import type { ClockControls } from '../../worlds/PlayStage'
import { Eyebrow, Popover } from '../../ui'

const HUD_BUTTON = 'flex h-7 min-w-8 items-center justify-center border border-transparent px-1 text-dim hover:bg-ink/5 hover:text-ink'

export function LongRestPop({ controls, waitHours, label }: { controls: ClockControls | null; waitHours: number; label: string }) {
  return (
    <Popover title={`Long rest · ${label}`} disabled={!controls} triggerClassName={HUD_BUTTON} trigger={<Moon className="h-3.5 w-3.5" />} className="notch-sm flex w-[15rem] flex-col gap-2.5 p-3">
      {(close) => (
        <>
          <Eyebrow>Long rest · {label}</Eyebrow>
          {waitHours > 0 && (
            <span className="font-ui text-[11px] text-dim">
              Ready in <span className="text-ink">{waitHours} h</span>
            </span>
          )}
          <button
            type="button"
            disabled={waitHours > 0}
            onClick={() => {
              controls?.longRest()
              close()
            }}
            className="notch-sm flex h-7 items-center justify-center gap-1.5 border border-accent bg-gradient-to-b from-accent/20 to-accent/5 font-label text-[11px] font-semibold caps-5 text-accent hover:text-ink disabled:border-line/40 disabled:bg-none disabled:text-faint"
          >
            <Moon className="h-3.5 w-3.5" />
            Rest
          </button>
        </>
      )}
    </Popover>
  )
}
