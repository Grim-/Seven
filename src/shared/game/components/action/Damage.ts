import { HARM, type EffectGroup } from '../../effectGroups'
import { entryLink, registerComponent, type TooltipRow } from '../../core'
import { ActionPiece, actionValue, type ActionEvent } from '../Action'
import { Health } from '../Health'

export class Damage extends ActionPiece {
  static readonly type: string = 'action.damage'
  static readonly DESCRIPTION: string = 'Damages the target one or more times.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    amount: { kind: 'formula' as const, default: '1d6', description: 'Damage before resists, e.g. 2d6 + user.str.' },
    times: { kind: 'number' as const, default: 1, min: 1, description: 'How many hits, e.g. 2 for a multi-attack.' },
    damageType: { kind: 'template' as const, templateKind: 'damage_type', default: '', description: 'What the damage counts as.' }
  }
  static readonly SENTENCE: string = 'Deal {amount} {damageType} damage to the {who}[ {times}×]'
  static readonly GROUP: EffectGroup | null = HARM
  static readonly ICON: string = 'Flame'

  tooltipRows(): TooltipRow[] {
    const type = String(this.params.damageType)
    const label = type ? (this.entity?.catalog.damageType(type)?.label ?? type) : ''
    const times = Math.max(1, Math.floor(Number(this.params.times) || 1))
    const base = `${String(this.params.amount)}${label ? ` ${label}` : ''}`
    return [{ label: 'Damage', value: times > 1 ? `${times} × ${base}` : base }]
  }

  handle(event: ActionEvent): void {
    const name = event.target?.named ?? 'No one'
    const type = String(this.params.damageType)
    const label = type ? entryLink(Damage.PARAMS.damageType.templateKind, type) : 'untyped'
    const health = event.target?.comp(Health)
    if (health?.isDead) return this.report(event, {}, `${name} is already down.`)
    if (!health) return this.report(event, {}, `${name} cannot take damage.`)
    const totalTimes = Math.max(1, Math.floor(Number(this.params.times) || 1))
    const from = health.get()
    let hits = 0
    let last = 0
    for (let i = 0; i < totalTimes; i++) {
      if (health.isDead) break
      last = actionValue(String(this.params.amount), { ...event, hit: i }, `${this.seed(event)}:${i}`)
      health.damage(last, { type, cause: event.action.id, source: event.user })
      hits++
    }
    const to = health.get()
    const dealt = from - to
    const hitText = totalTimes > 1 ? `${hits === 1 ? '1 hit for ' : `${hits}× for `}` : ''
    if (!event.nonTriggering && dealt > 0) {
      event.user.emit('OnHit', { target: event.target?.uid ?? null, damage: dealt, type, action: event.action.id, chainDepth: (event.chainDepth ?? 0) + 1 })
    }
    this.report(event, { amount: totalTimes > 1 ? dealt : last, hits, from, to }, `Dealt ${hitText}${dealt} ${label} damage to ${name} (${from} → ${to} HP)${health.isDead ? `; ${name} is down` : ''}.`)
    this.next(event)
  }
}

registerComponent(Damage)
