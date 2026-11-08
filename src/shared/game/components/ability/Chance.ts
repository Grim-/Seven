import { registerComponent, roll } from '../../core'
import { AbilityPiece, type AbilityEvent } from '../Abilities'

export class Chance extends AbilityPiece {
  static readonly type: string = 'ability.chance'
  static readonly DESCRIPTION: string = 'Rolls a chance; on success sends its event on to the next pieces, otherwise sends `onFail`.'
  static readonly PARAMS = {
    ...AbilityPiece.PARAMS_BASE,
    percent: { kind: 'formula' as const, default: '50', description: 'Chance of success out of 100, e.g. 50 + user.dex.' },
    onFail: { kind: 'text' as const, default: '', description: 'Event sent on failure. Empty sends nothing.' }
  }

  handle(event: AbilityEvent): void {
    const ability = event.action
    const hit = roll(event.user.uid, `${ability.id}:${ability.uses}:${this.uid}`) * 100 < this.value(String(this.params.percent), event)
    if (hit) return this.next(event)
    const fail = String(this.params.onFail)
    if (fail) ability.emit(fail, { ...event })
  }
}

registerComponent(Chance)
