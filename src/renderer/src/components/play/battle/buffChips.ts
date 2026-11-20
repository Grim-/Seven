import { Buffs } from '@shared/game/components'
import { GameEntity, type Catalog, type EntityRecord } from '@shared/game/core'
import { showName } from '@shared/ids'

const left = (seconds: number, roundSeconds: number): string => {
  if (seconds <= 60 && roundSeconds > 0) return `${Math.ceil(seconds / roundSeconds)} rnd`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h ${Math.ceil((seconds % 3600) / 60)}m`
}

export function buffChips(record: EntityRecord | null | undefined, catalog: Catalog | null, roundSeconds: number): string[] {
  if (!record || !catalog) return []
  const held = GameEntity.fromRecord(record, catalog).comp(Buffs)?.held ?? []
  return held.map((b) => (b.remaining === Infinity ? showName(b.id) : `${showName(b.id)} ${left(b.remaining, roundSeconds)}`))
}
