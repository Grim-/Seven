import type { WorldMeta } from '@shared/world'
import { WorldCastStage } from './cast/WorldCastStage'

export function WorldCharacters({ world, initialNpcKey }: { world: WorldMeta; initialNpcKey?: string }) {
  return <WorldCastStage world={world} initialNpcKey={initialNpcKey} />
}
