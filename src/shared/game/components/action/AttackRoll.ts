import { chanceOf } from '../../../actions'
import { LUCK, type EffectGroup } from '../../effectGroups'
import { registerComponent, rollInt, type CheckDef, type TooltipRow } from '../../core'
import { contest, rollCheck, rollLine } from '../../rules'
import { ActionPiece, chainScore, expectedActionValue, type ActionEvent, type EffectBranch, type UseContext } from '../Action'
import { Stats } from '../Stats'

/** Rolls an attack using rules/check against the target's configured defense stat. */
export class AttackRoll extends ActionPiece {
  static readonly type: string = 'action.attackRoll'
  static readonly DESCRIPTION: string = 'Rolls an attack roll against a target stat (e.g. Armour), sending its event on hit and onFail on miss.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    dice: { kind: 'formula' as const, default: '1d20', description: 'Die rolled for the attack, e.g. 1d20.' },
    bonus: { kind: 'formula' as const, default: 'floor((user.str - 10) / 2)', description: 'Bonus added to the die roll.' },
    defenseStat: { kind: 'template' as const, templateKind: 'stat', default: 'armour', description: 'Target stat the attack roll must meet or beat.' },
    critOn: { kind: 'number' as const, default: 20, min: 2, description: 'Natural die roll that scores a critical hit.' },
    onFail: { kind: 'text' as const, default: '', description: 'Event sent on miss. Empty sends nothing.' }
  }
  static readonly SENTENCE: string = 'Roll {dice} + {bonus} vs {who} {defenseStat}'
  static readonly GROUP: EffectGroup | null = LUCK
  static readonly ICON: string = 'Crosshair'
  static readonly BRANCHES: EffectBranch[] = [
    { param: 'emit', label: 'Hit', tone: 'pass', always: true },
    { param: 'onFail', label: 'Miss', tone: 'fail', always: true }
  ]

  private checkDef(): CheckDef {
    return {
      id: 'attack',
      label: 'Attack',
      group: 'combat',
      dice: String(this.params.dice || '1d20'),
      bonus: String(this.params.bonus || '0')
    }
  }

  tooltipRows(): TooltipRow[] {
    const statId = String(this.params.defenseStat || 'armour')
    const statLabel = this.entity?.catalog.stat(statId)?.label ?? statId
    return [{ label: 'Attack', value: `${String(this.params.dice)} + ${String(this.params.bonus)} vs ${statLabel}` }]
  }

  handle(event: ActionEvent): void {
    const target = event.target
    const targetName = target?.named ?? 'the target'
    const defenseStat = String(this.params.defenseStat || 'armour')
    const defenseLabel = event.user.catalog.stat(defenseStat)?.label ?? defenseStat
    const targetDefense = target?.comp(Stats)?.value(defenseStat) ?? (event.user.catalog.stat(defenseStat)?.default ?? 0)

    const out = event.user.rollFlags('outgoing')
    const inc = target ? target.rollFlags('incoming') : { advantage: false, disadvantage: false }
    const advantage = out.advantage || inc.advantage
    const disadvantage = out.disadvantage || inc.disadvantage
    const net = advantage && !disadvantage ? 1 : disadvantage && !advantage ? -1 : 0

    const def = this.checkDef()
    let n = 0
    const die = (sides: number) => rollInt(event.user.uid, `${this.seed(event)}:${n++}`, 1, sides)
    const first = rollCheck(event.user, def, die)
    const picked =
      net === 0
        ? first
        : (() => {
            const second = rollCheck(event.user, def, die)
            return (net > 0 ? second.total > first.total : second.total < first.total) ? second : first
          })()

    const nat = picked.faces[0]?.face ?? picked.roll
    const critOn = Math.max(2, Number(this.params.critOn) || 20)
    const isCrit = nat >= critOn
    const isFumble = picked.faces.length > 0 && nat <= 1
    const hit = !isFumble && (isCrit || contest(picked, { dc: targetDefense }).passed)

    const modeTag = net > 0 ? ' (adv)' : net < 0 ? ' (dis)' : ''
    const summary = isCrit
      ? `CRITICAL HIT${modeTag}: ${rollLine(event.user.named, picked)} vs ${defenseLabel} ${targetDefense} on ${targetName}.`
      : hit
        ? `Hit${modeTag}: ${rollLine(event.user.named, picked)} vs ${defenseLabel} ${targetDefense} on ${targetName}.`
        : `Missed${modeTag}: ${rollLine(event.user.named, picked)} vs ${defenseLabel} ${targetDefense} on ${targetName}.`

    this.report(event, { roll: picked.roll, bonus: picked.bonus, total: picked.total, targetDefense, crit: isCrit ? 1 : 0, hit: hit ? 1 : 0 }, summary)
    if (hit) return this.next(event, { crit: isCrit })
    this.branch(event, String(this.params.onFail))
  }

  score(ctx: UseContext): number {
    const down = chainScore(this.action, String(this.params.emit), ctx)
    if (!this.action || down <= 0) return 0
    const defenseStat = String(this.params.defenseStat || 'armour')
    const def = ctx.target?.comp(Stats)?.value(defenseStat) ?? (ctx.user.catalog.stat(defenseStat)?.default ?? 0)
    const bonus = expectedActionValue(String(this.params.bonus || '0'), { ...ctx, action: this.action })
    return down * chanceOf(bonus, def)
  }
}

registerComponent(AttackRoll)
