import { HELP, type EffectGroup } from '../../effectGroups'
import { registerComponent, type TooltipRow } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { Health } from '../Health'
import { registerLegacyTriggerAction } from '../../triggerActions'

export class Heal extends ActionPiece {
  static readonly type: string = 'action.heal'
  static readonly DESCRIPTION: string = 'Heals the target once.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    amount: { kind: 'formula' as const, default: '1d8', description: 'Health restored, e.g. 1d8 + user.wis.' }
  }
  static readonly SENTENCE: string = 'Heal the {who} for {amount}'
  static readonly GROUP: EffectGroup | null = HELP
  static readonly ICON: string = 'HeartPulse'

  tooltipRows(): TooltipRow[] {
    return [{ label: 'Heals', value: String(this.params.amount) }]
  }

  handle(event: ActionEvent): void {
    const name = event.target?.named ?? 'No one'
    const health = event.target?.comp(Health)
    if (health?.isDead) return this.report(event, {}, `${name} is down and cannot be healed.`)
    if (!health) return this.report(event, {}, `${name} cannot be healed.`)
    const amount = this.value(String(this.params.amount), event)
    const from = health.get()
    health.heal(amount, event.action.id)
    const to = health.get()
    this.report(event, { amount, from, to }, `Healed ${name} for ${to - from} (${from} → ${to} HP).`)
    this.next(event)
  }
}

registerComponent(Heal)
const n = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
registerLegacyTriggerAction('modify_health', (p) => (n(p.amount, 0) >= 0 ? [{ type: Heal.type, amount: String(n(p.amount, 0)) }] : [{ type: 'action.damage', amount: String(-n(p.amount, 0)), damageType: String(p.damageType ?? '') }]))
registerLegacyTriggerAction('rest_party', (p) => [{ type: Heal.type, amount: String(n(p.healAmount, 50)) }])
