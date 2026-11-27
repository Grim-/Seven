import { blankStoredFaction, splitFactionRef, type StoredFaction } from '@shared/game/factions'
import { engine } from '../../lib/ipc'
import type { KindScreenProps } from '../../registries/kinds'
import { StoredScreen } from '../decisions/StoredScreen'
import { StoredFactionEditor } from './StoredFactionEditor'

export function FactionScreen(props: KindScreenProps) {
  const ref = props.id ? splitFactionRef(props.id) : null
  const worldId = ref?.world ?? null
  return (
    <StoredScreen<StoredFaction>
      {...props}
      what="faction"
      event="factions.changed"
      get={(id) => {
        const parts = splitFactionRef(id)
        return engine('factions.get', { id: parts?.id ?? id, world: parts?.world ?? worldId }).then(
          (f) => f ?? blankStoredFaction(parts?.world ?? worldId ?? undefined)
        )
      }}
      save={(faction, previousId) =>
        engine('factions.save', {
          faction,
          world: faction.worldId ?? worldId,
          previousId
        })
      }
      blank={() => blankStoredFaction(worldId ?? undefined)}
      badge={(f) => `Default: ${f.defaultStance.toUpperCase()}`}
      Editor={(editorProps) => <StoredFactionEditor worldId={worldId} {...editorProps} />}
    />
  )
}
