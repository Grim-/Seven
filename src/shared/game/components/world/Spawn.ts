import { entryLink, registerComponent } from '../../core'
import { splitNpcRef } from '../../../worldNpcs'
import type { ActionEvent } from '../Action'
import { registerLegacyTriggerAction } from '../../triggerActions'
import { WorldPiece } from './WorldPiece'
import { CREATURE_KIND, CREATURE_TEMPLATES, GAME_BESTIARY } from '../../templateKinds'

export class Spawn extends WorldPiece {
  static readonly type: string = 'world.spawn'
  static readonly DESCRIPTION: string = 'Puts a creature or World NPC archetype on the map, beside whoever it acts on.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    creature: { kind: 'template' as const, templateKind: CREATURE_TEMPLATES, default: '', description: 'Which creature or @world:<world>/npc/<id> archetype.' },
    faction: { kind: 'entry' as const, entryKind: 'faction', default: '', description: 'Whose side it is on. Empty uses its own.' }
  }
  static readonly SENTENCE: string = 'Spawn {creature}[ for {faction}] beside the {who}'
  static readonly ICON: string = 'UserPlus'

  handle(event: ActionEvent): void {
    const p = this.params
    const raw = String(p.creature ?? '').trim()
    const isNpc = splitNpcRef(raw) !== null || /^@?npc:/i.test(raw)
    this.send(event, 'spawn_creature', { source: isNpc ? 'world-npc' : GAME_BESTIARY, creature: raw, faction: p.faction })
    const link = splitNpcRef(raw) ? `@world:${splitNpcRef(raw)!.world}/npc/${splitNpcRef(raw)!.id}` : entryLink(CREATURE_KIND, raw)
    this.report(event, {}, `Spawns ${link}.`)
    this.next(event)
  }
}

registerComponent(Spawn)
registerLegacyTriggerAction('spawn_creature', (p) => [{ type: Spawn.type, creature: String(p.creatureTemplate ?? ''), faction: String(p.factionId ?? '') }])
