import type { MouseEvent } from 'react'
import { showName } from '@shared/ids'
import { CountStepper, FaceCount } from '../ui'
import { LiveCard } from './LiveCard'

export function DeckCardTile({ name, cardId, count, onCount, onMenu }: { name: string; cardId: string | null; count: number; onCount: (next: number) => void; onMenu: (e: MouseEvent) => void }) {
  return (
    <div className="flex flex-col items-center gap-1.5" title={showName(name)} onContextMenu={onMenu}>
      <div className="relative w-full">
        {cardId ? <LiveCard id={cardId} /> : <div className="flex aspect-[5/7] w-full items-center justify-center border border-dashed border-alert/60 p-2 text-center font-ui text-[11px] text-alert">{showName(name)} (missing card)</div>}
        <FaceCount count={count} />
      </div>
      <CountStepper small value={count} onChange={onCount} />
    </div>
  )
}
