import { cn } from '../../lib/cn'
import type { PlayOutcome } from './playStore'

export function PlayStamp({ outcome, className }: { outcome: PlayOutcome; className?: string }) {
  return (
    <div className={cn('play-stamp', className)} data-tone={outcome.tone}>
      <div className="play-stamp-label">{outcome.label}</div>
      {outcome.detail && <div className="play-stamp-detail">{outcome.detail}</div>}
    </div>
  )
}
