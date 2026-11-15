import { CONDITIONS, type EffectGroup } from '../../effectGroups'
import { registerComponent, type GameEntity } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { Buffs } from '../Buffs'
import { BUFF_MATCH_PARAMS, buffLinks, matchedBuffs } from './buffMatch'

const WAYS: Record<string, (event: ActionEvent) => [GameEntity | null, GameEntity | null]> = {
  steal: (event) => [event.target, event.user],
  give: (event) => [event.user, event.target]
}

export class MoveBuff extends ActionPiece {
  static readonly type: string = 'action.moveBuff'
  static readonly DESCRIPTION: string = 'Moves matching buffs, with their stacks and time left: steal takes them from the target onto the caster, give puts the caster\'s onto the target.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    ...BUFF_MATCH_PARAMS,
    way: { kind: 'choice' as const, choices: Object.keys(WAYS), default: 'steal', description: 'steal: from the target to the caster. give: from the caster to the target.' },
    count: { kind: 'number' as const, default: 0, min: 0, description: 'How many buffs to move. 0 moves all that match.' }
  }
  static readonly SENTENCE: string = '{way}[ {count} of][ {buff}][ buffs tagged {tag}]'
  static readonly GROUP: EffectGroup | null = CONDITIONS
  static readonly ICON: string = 'ArrowLeftRight'
  static readonly AIMS: boolean = false

  handle(event: ActionEvent): void {
    const [from, to] = (WAYS[String(this.params.way)] ?? WAYS.steal)(event)
    const { buffs, found, words } = matchedBuffs(from, this.params)
    const into = to?.comp(Buffs)
    const count = Number(this.params.count)
    const moving = count > 0 ? found.slice(0, count) : found
    const fromName = from?.named ?? 'No one'
    const toName = to?.named ?? 'no one'
    if (!buffs || !into || !moving.length) return this.report(event, { moved: 0 }, `${fromName} has no ${words} to move to ${toName}.`)
    const moved = moving.filter((b) => {
      const record = buffs.take(b)
      return record ? into.receive(record) !== null : false
    })
    this.report(event, { moved: moved.length }, `${buffLinks(moved)} moved from ${fromName} to ${toName}.`)
    this.next(event)
  }
}

registerComponent(MoveBuff)
