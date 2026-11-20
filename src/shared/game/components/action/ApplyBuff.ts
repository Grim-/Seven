import { CONDITIONS, type EffectGroup } from '../../effectGroups'
import { entryLink, registerComponent, type TooltipRow } from '../../core'
import { ActionPiece, type ActionEvent, type UseContext } from '../Action'
import { Buffs } from '../Buffs'
import { Concentrating, Concentration } from '../buff/Concentration'

export class ApplyBuff extends ActionPiece {
  static readonly type: string = 'action.applyBuff'
  static readonly DESCRIPTION: string = 'Puts a buff on the target, from its template.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    buff: { kind: 'template' as const, templateKind: 'game_buff', default: '', description: 'Which buff.' }
  }
  static readonly SENTENCE: string = 'Apply {buff} to the {who}'
  static readonly GROUP: EffectGroup | null = CONDITIONS
  static readonly ICON: string = 'Sparkles'

  tooltipRows(): TooltipRow[] {
    const id = String(this.params.buff)
    const def = id ? this.entity?.catalog.template(ApplyBuff.PARAMS.buff.templateKind, id) : null
    return id ? [{ label: 'Applies', value: String(def?.label || id) }] : []
  }

  handle(event: ActionEvent): void {
    const name = event.target?.named ?? 'No one'
    const buffs = event.target?.comp(Buffs)
    const def = event.user.catalog.template(ApplyBuff.PARAMS.buff.templateKind, String(this.params.buff))
    if (!def) return this.report(event, {}, 'There is no such buff to apply.')
    const label = entryLink(ApplyBuff.PARAMS.buff.templateKind, String(this.params.buff))
    if (!buffs) return this.report(event, { buff: String(this.params.buff) }, `${name} cannot gain ${label}.`)
    const applied = buffs.apply(def, event.user)
    if (!applied) return this.report(event, { buff: String(this.params.buff) }, `${label} did not take on ${name}.`)
    const needs = applied.comp(Concentration)
    if (needs) Concentrating.start(event.user, applied.id, String(needs.params.saveStat))
    this.report(event, { buff: String(this.params.buff) }, `${name} is now affected by ${label}.`)
    this.next(event)
  }

  score(ctx: UseContext): number {
    const buffs = ctx.target?.comp(Buffs)
    const id = String(this.params.buff)
    const def = id ? ctx.user.catalog.template(ApplyBuff.PARAMS.buff.templateKind, id) : null
    if (!buffs || !def) return 0
    const maxStacks = Math.max(1, Number(def.maxStacks ?? 1))
    const current = buffs.held.filter((b) => b.id === id).reduce((s, b) => Math.max(s, b.stacks), 0)
    return current >= maxStacks ? 0 : Math.max(1, Number(def.potency ?? 1))
  }
}

registerComponent(ApplyBuff)
