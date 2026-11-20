import { Component, registerComponent, rollInt, type GameEntity } from '../../core'
import { BuffPiece } from '../Buffs'
import { Stats } from '../Stats'

export class Concentration extends BuffPiece {
  static readonly type: string = 'buff.concentration'
  static readonly DESCRIPTION: string = 'The buff needs its caster\'s concentration. A caster holds one at a time; casting another, or failing a save after taking damage (DC 10 or half the damage, whichever is higher), ends it.'
  static readonly PARAMS = {
    saveStat: { kind: 'template' as const, templateKind: 'stat', default: 'con', description: 'The caster\'s stat for the save after taking damage.' }
  }
  static readonly SENTENCE: string = 'Needs the caster\'s concentration[, saving with {saveStat}]'
  static readonly ICON: string = 'Diamond'
}

export class Concentrating extends Component {
  static readonly type: string = 'concentrating'
  static readonly DESCRIPTION: string = 'The buff this caster is concentrating on.'
  static readonly PARAMS = {}
  buff = ''
  stat = ''
  private rolls = 0

  static start(caster: GameEntity, buff: string, stat: string): void {
    const existing = caster.comp(Concentrating)
    const held = existing ?? new Concentrating({})
    held.buff = buff
    held.stat = stat
    if (!existing) caster.add(held)
  }

  onApplied(): void {
    super.onApplied()
    const entity = this.entity
    if (entity) this.bind(entity, 'OnHurt', (payload) => this.check(entity, Number(payload.amount) || 0))
  }

  private check(entity: GameEntity, amount: number): void {
    if (!this.buff) return
    const score = this.stat ? (entity.comp(Stats)?.value(this.stat) ?? 10) : 10
    const roll = rollInt(entity.uid, `${this.uid}:${entity.at ?? 0}:${this.rolls++}`, 1, 20) + Math.floor((score - 10) / 2)
    if (roll < Math.max(10, Math.floor(amount / 2))) this.buff = ''
  }

  protected saveState(): Record<string, unknown> {
    return { buff: this.buff, stat: this.stat }
  }

  protected loadState(state: Record<string, unknown>): void {
    this.buff = typeof state.buff === 'string' ? state.buff : ''
    this.stat = typeof state.stat === 'string' ? state.stat : ''
  }
}

registerComponent(Concentration)
registerComponent(Concentrating)
