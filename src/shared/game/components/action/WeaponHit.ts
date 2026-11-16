import { HARM, type EffectGroup } from '../../effectGroups'
import { entryLink, registerComponent, type Component, type GameEntity, type TooltipRow } from '../../core'
import { ITEM_TEMPLATES } from '../../templateKinds'
import { Ability } from '../Abilities'
import { ActionPiece, actionValue, type ActionEvent, type UseContext } from '../Action'
import { Item } from '../Inventory'
import { Health } from '../Health'
import { Weapon } from '../item/Weapon'

export class WeaponHit extends ActionPiece {
  static readonly type: string = 'action.weaponHit'
  static readonly DESCRIPTION: string = 'Hits the target with the weapon this ability is inside: its damage and damage type, any number of times. Each hit sends OnHit to the item.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    times: { kind: 'number' as const, default: 1, min: 1, description: 'How many hits, e.g. 3 for a burst.' },
    bonus: { kind: 'formula' as const, default: '0', description: 'Added to each hit\'s damage, e.g. user.str.' }
  }
  static readonly SENTENCE: string = 'Hit the {who} with this weapon {times}×[, adding {bonus} each hit]'
  static readonly GROUP: EffectGroup | null = HARM
  static readonly ICON: string = 'Swords'

  private weapon(): Weapon | null {
    const item = this.action?.parent
    return item instanceof Item ? (item.comps.find((c): c is Weapon => c instanceof Weapon) ?? null) : null
  }

  canApply(host: Component | GameEntity): true | string {
    return host instanceof Ability ? true : 'only in an ability inside a weapon'
  }

  canUse(ctx: UseContext): true | string {
    if (!this.weapon()) return 'it is not inside a weapon'
    if (!ctx.target?.comp(Health) || ctx.target.comp(Health)?.isDead) return 'nothing to hit'
    return true
  }

  handle(event: ActionEvent): void {
    const weapon = this.weapon()
    const item = weapon?.item
    const health = event.target?.comp(Health)
    if (!weapon || !item || !health || !event.target) return
    const from = health.get()
    let hits = 0
    for (let i = 0; i < Number(this.params.times); i++) {
      if (health.isDead) break
      const amount = actionValue(`(${String(weapon.params.damage)}) + (${String(this.params.bonus)})`, { ...event, hit: i }, `${this.seed(event)}:${i}`)
      health.damage(amount, { type: String(weapon.params.damageType), cause: item.id, source: event.user })
      item.fire('OnHit', event, { damage: amount })
      hits++
    }
    const to = health.get()
    const dealt = from - to
    if (!event.nonTriggering && dealt > 0) {
      event.user.emit('OnHit', { target: event.target.uid, damage: dealt, type: String(weapon.params.damageType), action: item.id, chainDepth: (event.chainDepth ?? 0) + 1 })
    }
    this.report(event, { hits, from, to }, `${entryLink(ITEM_TEMPLATES, item.id)} hit ${event.target.named} ${hits === 1 ? 'once' : `${hits} times`} for ${dealt} (${from} → ${to} HP)${health.isDead ? `; ${event.target.named} is down` : ''}.`)
    this.next(event)
  }

  tooltipRows(): TooltipRow[] {
    const weapon = this.weapon()
    const times = Number(this.params.times)
    const bonus = String(this.params.bonus).trim()
    const damage = weapon ? `${String(weapon.params.damage)}${bonus && bonus !== '0' ? ` + ${bonus}` : ''}` : 'the weapon\'s damage'
    return [{ label: 'Hits', value: times > 1 ? `${times} × ${damage}` : damage }]
  }
}

registerComponent(WeaponHit)
