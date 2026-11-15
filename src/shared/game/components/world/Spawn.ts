import { entryLink, registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { registerLegacyTriggerAction } from '../../triggerActions'
import { WorldPiece } from './WorldPiece'
import { CREATURE_TEMPLATES, GAME_BESTIARY } from '../../templateKinds'

export class Spawn extends WorldPiece {
  static readonly type: string = 'world.spawn'
  static readonly DESCRIPTION: string = 'Puts a creature from the bestiary on the map, beside whoever it acts on.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    creature: { kind: 'template' as const, templateKind: CREATURE_TEMPLATES, default: '', description: 'Which creature.' },
    faction: { kind: 'entry' as const, entryKind: 'faction', default: '', description: 'Whose side it is on. Empty uses its own.' }
  }
  static readonly SENTENCE: string = 'Spawn {creature}[ for {faction}] beside the {who}'
  static readonly ICON: string = 'UserPlus'

  handle(event: ActionEvent): void {
    const p = this.params
    this.send(event, 'spawn_creature', { source: GAME_BESTIARY, creature: p.creature, faction: p.faction })
    this.report(event, {}, `Spawns ${entryLink(CREATURE_TEMPLATES, String(p.creature))}.`)
    this.next(event)
  }
}

registerComponent(Spawn)
registerLegacyTriggerAction('spawn_creature', (p) => [{ type: Spawn.type, creature: String(p.creatureTemplate ?? ''), faction: String(p.factionId ?? '') }])
