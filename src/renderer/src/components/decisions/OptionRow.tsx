import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function OptionRow({ mark, text, aside, picked, onClick }: { mark: ReactNode; text: string; aside?: ReactNode; picked: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={cn('flex items-center gap-3 border-l-2 px-2.5 py-2 text-left', picked ? 'border-l-accent bg-accent/15' : 'border-l-transparent', onClick && !picked && 'hover:bg-accent/[0.06]')}
    >
      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center border font-ui text-[12px] font-bold', picked ? 'border-accent bg-accent text-on-accent' : 'border-line text-accent')}>{mark}</span>
      <span className="min-w-0 flex-1 text-[13.5px] text-ink">{text}</span>
      {aside}
    </button>
  )
}
