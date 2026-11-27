import type { InstallChoice } from '@shared/types'
import { formatBytes } from '../../../lib/format'
import { cn } from '../../../lib/cn'

export function ChoiceRow({ choice, picked, onPick }: { choice: InstallChoice; picked: boolean; onPick: () => void }) {
  const off = choice.unavailable !== null
  return (
    <button
      type="button"
      disabled={off}
      onClick={onPick}
      className={cn('flex w-full flex-col gap-1 border px-3 py-2 text-left', picked ? 'border-accent bg-accent/10' : 'border-line/50 hover:bg-ink/[0.03]', off && 'cursor-not-allowed opacity-50')}
    >
      <span className="flex items-center gap-3">
        <span className="flex-1 text-[13px] text-ink">{choice.label}</span>
        <span className="font-ui text-[11.5px] text-dim">{formatBytes(choice.size)}</span>
      </span>
      {choice.unavailable && <span className="text-[12px] text-alert">{choice.unavailable}</span>}
      {choice.notes.map((n) => (
        <span key={n} className="text-[12px] text-ink/70">
          {n}
        </span>
      ))}
    </button>
  )
}
