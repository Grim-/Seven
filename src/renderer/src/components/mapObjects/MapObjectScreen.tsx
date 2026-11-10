import { blankStoredMapObject, type StoredMapObject } from '@shared/game/mapObjects'
import { engine } from '../../lib/ipc'
import type { KindScreenProps } from '../../registries/kinds'
import { StoredScreen } from '../decisions/StoredScreen'
import { StoredMapObjectEditor } from './StoredMapObjectEditor'

export function MapObjectScreen(props: KindScreenProps) {
  return (
    <StoredScreen<StoredMapObject>
      {...props}
      what="map_object"
      event="mapObjects.changed"
      get={(id) => engine('mapObjects.get', { id }).then((o) => o ?? blankStoredMapObject())}
      save={(object, previousId) => engine('mapObjects.save', { object, previousId })}
      blank={blankStoredMapObject}
      badge={(o) => `${o.collision} · ${o.size.w}×${o.size.h}px`}
      Editor={StoredMapObjectEditor}
    />
  )
}
