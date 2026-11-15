import { HARM, type EffectGroup } from '../../effectGroups'
import { entryLink, registerComponent, type TooltipRow } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { Health } from '../Health'

export class Damage extends ActionPiece {
  static readonly type: string = 'action.damage'
  static readonly DESCRIPTION: string = 'Damages the target once.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    amount: { kind: 'formula' as const, default: '1d6', description: 'Damage before resists, e.g. 2d6 + user.str.' },
    damageType: { kind: 'template' as const, templateKind: 'damage_type', default: '', description: 'What the damage counts as.' }
  }
  static readonly SENTENCE: string = 'Deal {amount} {damageType} damage to the {who}'
  static readonly GROUP: EffectGroup | null = HARM
  static readonly ICON: string = 'Flame'

  tooltipRows(): TooltipRow[] {
    const type = String(this.params.damageType)
    const label = type ? (this.entity?.catalog.damageType(type)?.label ?? type) : ''
    return [{ label: 'Damage', value: `${String(this.params.amount)}${label ? ` ${label}` : ''}` }]
  }

  handle(event: ActionEvent): void {
    const name = event.target?.named ?? 'No one'
    const type = String(this.params.damageType)
    const label = type ? entryLink(Damage.PARAMS.damageType.templateKind, type) : 'untyped'
    const health = event.target?.comp(Health)
    if (health?.isDead) return this.report(event, {}, `${name} is already down.`)
    if (!health) return this.report(event, {}, `${name} cannot take damage.`)
    const amount = this.value(String(this.params.amount), event)
    const from = health.get()
    health.damage(amount, { type, cause: event.action.id, source: event.user })
    const to = health.get()
    this.report(event, { amount, from, to }, `Dealt ${from - to} ${label} damage to ${name} (${from} → ${to} HP)${health.isDead ? `; ${name} is down` : ''}.`)
    this.next(event)
  }
}

registerComponent(Damage)
