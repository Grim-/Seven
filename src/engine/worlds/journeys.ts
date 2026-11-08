import { actionResultText, type ActionResult } from '@shared/actions'
import { placePath, placesIn } from '@shared/maps'
import { PLACE_TYPE_KEY } from '@shared/world'
import { onWhereChange } from '../library/sheets'
import { saves } from './saves'
import { worlds } from './store'

export function watchJourneys(): void {
  onWhereChange((sheet, where) => {
    const save = saves.holding(sheet)
    if (!save || saves.currentId(save.world) !== save.id || !worlds.exists(save.world) || !worlds.schema(save.world).types[PLACE_TYPE_KEY]) return
    const places = worlds.entities(save.world, PLACE_TYPE_KEY, false)
    for (const key of placesIn(where, save.world, places)) worlds.addJourney(save.world, sheet, 'moved', `Went to ${placePath(places, key).map((k) => String(places[k]?.Name || k)).join(' › ')}`)
  })
}

export function journalAction(world: string | null, result: ActionResult): void {
  if (!world || !result.character || !worlds.exists(world)) return
  worlds.addJourney(world, result.character.sheet, 'action', actionResultText(result).split('\n').slice(1, -1).join(' '))
}
