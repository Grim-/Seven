import { entryLink, registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { registerLegacyTriggerAction } from '../../triggerActions'
import { WorldPiece } from './WorldPiece'
import { CREATURE_TEMPLATES, GAME_BESTIARY } from '../../templateKinds'

export class StartCombat extends WorldPiece {
  static readonly type: string = 'world.startCombat'
  static readonly DESCRIPTION: string = 'Puts a creature beside whoever it acts on and starts a turn-based fight between them.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    creature: { kind: 'template' as const, templateKind: CREATURE_TEMPLATES, default: '', description: 'The creature to fight.' }
  }
  static readonly SENTENCE: string = 'Start a fight between the {who} and {creature}'
  static readonly ICON: string = 'Swords'

  handle(event: ActionEvent): void {
    const p = this.params
    this.send(event, 'start_combat', { source: GAME_BESTIARY, creature: p.creature })
    this.report(event, {}, `A fight starts with ${entryLink(CREATURE_TEMPLATES, String(p.creature))}.`)
    this.next(event)
  }
}

registerComponent(StartCombat)
registerLegacyTriggerAction('start_combat', () => [{ type: StartCombat.type, creature: '' }])
