import { entryLink, registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { registerLegacyTriggerAction } from '../../triggerActions'
import { WorldPiece } from './WorldPiece'

export class Recruit extends WorldPiece {
  static readonly type: string = 'world.recruit'
  static readonly DESCRIPTION: string = 'Brings a character into the party.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    sheet: { kind: 'entry' as const, entryKind: 'sheet', default: '', description: 'Who joins.' }
  }
  static readonly SENTENCE: string = 'Bring {sheet} into the party beside the {who}'
  static readonly ICON: string = 'Users'

  handle(event: ActionEvent): void {
    const p = this.params
    this.send(event, 'recruit', { sheet: p.sheet })
    this.report(event, {}, `${entryLink('sheet', String(p.sheet))} joins the party.`)
    this.next(event)
  }
}

registerComponent(Recruit)
registerLegacyTriggerAction('recruit_party', (p) => [{ type: Recruit.type, sheet: String(p.sheet ?? '') }])
