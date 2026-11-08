import { registerComponent, type TooltipRow } from '../../core'
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

  private weapon(): Weapon | null {
    const item = this.action?.parent
    return item instanceof Item ? (item.comps.find((c): c is Weapon => c instanceof Weapon) ?? null) : null
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
    if (!weapon || !item || !health) return
    for (let i = 0; i < Number(this.params.times); i++) {
      if (health.isDead) break
      const amount = actionValue(`(${String(weapon.params.damage)}) + (${String(this.params.bonus)})`, { ...event, hit: i }, `${this.seed(event)}:${i}`)
      health.damage(amount, { type: String(weapon.params.damageType), cause: item.id, source: event.user })
      item.fire('OnHit', event, { damage: amount })
    }
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
