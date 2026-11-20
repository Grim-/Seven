import { entryLink, registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { registerLegacyTriggerAction } from '../../triggerActions'
import { WorldPiece } from './WorldPiece'

export class ChangeMap extends WorldPiece {
  static readonly type: string = 'world.changeMap'
  static readonly DESCRIPTION: string = 'Moves whoever it acts on to another map, now or as a button they press.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    map: { kind: 'entry' as const, entryKind: 'map', default: '', description: 'The map to go to.' },
    place: { kind: 'text' as const, default: '', description: 'The place on that map to arrive at. Empty arrives in the middle.' },
    button: { kind: 'flag' as const, default: false, description: 'Offer it as a button instead of going straight away.' },
    seconds: { kind: 'duration' as const, default: 0, min: 0, description: 'How long the journey takes. 0 uses the clock\'s exit travel time.' }
  }
  static readonly SENTENCE: string = 'Send the {who} to {map}[ at {place}][, taking {seconds}]'
  static readonly ICON: string = 'DoorOpen'

  handle(event: ActionEvent): void {
    const p = this.params
    this.send(event, 'change_map', { map: p.map, place: p.place, button: p.button, seconds: p.seconds })
    this.report(event, {}, `Goes to ${entryLink('map', String(p.map))}${p.place ? ` at ${String(p.place)}` : ''}.`)
    this.next(event)
  }
}

registerComponent(ChangeMap)
registerLegacyTriggerAction('change_map', (p) => [{ type: ChangeMap.type, map: String(p.map ?? ''), place: String(p.place ?? '') }])
