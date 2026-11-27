import { hasSwap, type CardSwap } from '@shared/cardDecks'
import { showName } from '@shared/ids'

export function CardSwapLine({ swap }: { swap: CardSwap }) {
  if (!hasSwap(swap)) return null
  return (
    <span className="flex flex-wrap gap-1 font-ui text-[10.5px]">
      {swap.gain.map((c, i) => (
        <span key={`g${i}`} className="border border-ok/50 px-1 text-ok">
          + {showName(c)}
        </span>
      ))}
      {swap.lose.map((c, i) => (
        <span key={`l${i}`} className="border border-alert/50 px-1 text-alert">
          − {showName(c)}
        </span>
      ))}
    </span>
  )
}
