import { blankStoredFaction, type StoredFaction } from '@shared/game/factions'
import { engine } from '../../lib/ipc'
import type { KindScreenProps } from '../../registries/kinds'
import { StoredScreen } from '../decisions/StoredScreen'
import { StoredFactionEditor } from './StoredFactionEditor'

export function FactionScreen(props: KindScreenProps) {
  return (
    <StoredScreen<StoredFaction>
      {...props}
      what="faction"
      event="factions.changed"
      get={(id) => engine('factions.get', { id }).then((f) => f ?? blankStoredFaction())}
      save={(faction, previousId) => engine('factions.save', { faction, previousId })}
      blank={blankStoredFaction}
      badge={(f) => `Default: ${f.defaultStance.toUpperCase()}`}
      Editor={StoredFactionEditor}
    />
  )
}
