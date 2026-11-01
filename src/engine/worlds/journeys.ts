import { actionResultText, type ActionResult } from '@shared/actions'
import { placePath, placesIn } from '@shared/maps'
import { PLACE_TYPE_KEY } from '@shared/world'
import { onWhereChange } from '../library/sheets'
import { worlds } from './store'

export function watchJourneys(): void {
  onWhereChange((sheet, where) => {
    for (const w of worlds.list()) {
      if (!worlds.schema(w.id).types[PLACE_TYPE_KEY]) continue
      const places = worlds.entities(w.id, PLACE_TYPE_KEY, false)
      for (const key of placesIn(where, w.id, places)) worlds.addJourney(w.id, sheet, 'moved', `Went to ${placePath(places, key).map((k) => String(places[k]?.Name || k)).join(' › ')}`)
    }
  })
}

export function journalAction(world: string | null, result: ActionResult): void {
  if (!world || !result.character || !worlds.exists(world)) return
  worlds.addJourney(world, result.character.sheet, 'action', actionResultText(result).split('\n').slice(1, -1).join(' '))
}
