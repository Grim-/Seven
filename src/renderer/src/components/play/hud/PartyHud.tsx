import type { Catalog } from '@shared/game/core'
import type { MapToken } from '../../maps/TokenLayer'
import { GamePortrait } from '../../../game/ui'

export function PartyHud({
  tokens,
  player,
  catalog,
  onPick
}: {
  tokens: MapToken[]
  player: string | null
  catalog?: Catalog | null
  onPick: (sheet: string) => void
}) {
  const playing = tokens
    .filter((t) => t.visitor.game || t.visitor.sheet === player)
    .sort((a, b) => Number(b.visitor.sheet === player) - Number(a.visitor.sheet === player))

  if (!playing.length) return null

  return (
    <div className="pointer-events-auto flex w-64 flex-col border border-line/60 bg-black/90">
      {playing.map((t) => (
        <GamePortrait
          key={t.visitor.sheet}
          visitor={t.visitor}
          catalog={catalog}
          active={t.visitor.sheet === player}
          onClick={() => onPick(t.visitor.sheet)}
        />
      ))}
    </div>
  )
}
