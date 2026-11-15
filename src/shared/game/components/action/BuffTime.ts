import { CONDITIONS, type EffectGroup } from '../../effectGroups'
import { registerComponent } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { BUFF_MATCH_PARAMS, buffLinks, matchedBuffs } from './buffMatch'

export class BuffTime extends ActionPiece {
  static readonly type: string = 'action.buffTime'
  static readonly DESCRIPTION: string = 'Lengthens or shortens the target\'s matching buffs. Buffs that last until removed are left alone.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    ...BUFF_MATCH_PARAMS,
    seconds: { kind: 'formula' as const, default: '6', description: 'Seconds to add; a negative number takes time off.' }
  }
  static readonly SENTENCE: string = 'Change the time left on[ {buff}][ buffs tagged {tag}] on the {who} by {seconds} s'
  static readonly GROUP: EffectGroup | null = CONDITIONS
  static readonly ICON: string = 'Hourglass'

  handle(event: ActionEvent): void {
    const { buffs, found, words } = matchedBuffs(event.target, this.params)
    const name = event.target?.named ?? 'No one'
    const timed = found.filter((b) => b.remaining !== Infinity)
    const seconds = this.value(String(this.params.seconds), event)
    if (!buffs || !timed.length) return this.report(event, { seconds: 0 }, `${name} has no ${words} with time left to change.`)
    for (const b of timed) {
      b.remaining += seconds
      if (b.remaining <= 0) buffs.removeBuff(b)
    }
    const s = Math.round(seconds)
    this.report(event, { seconds: s }, `${buffLinks(timed)} on ${name}: ${s >= 0 ? `${s} s longer` : `${-s} s shorter`}.`)
    this.next(event)
  }
}

registerComponent(BuffTime)
