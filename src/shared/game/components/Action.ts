import { Component, evaluate, rollInt, type GameEntity } from '../core'
import type { Point } from '@shared/shapes'
import type { EffectResult, ViewEvent } from '@shared/effects'
import { Stats } from './Stats'
import type { EffectGroup } from '../effectGroups'

export interface EffectBranch {
  param: string
  label: string
  tone: 'pass' | 'fail'
  always?: boolean
}

export interface EffectLane {
  event: string
  label: string
}

export const MAX_CHAIN_DEPTH = 4

export interface UseContext {
  user: GameEntity
  target: GameEntity | null
  at: Point | null
  distance: number
  chainDepth?: number
  nonTriggering?: boolean
  collect?: (result: EffectResult) => void
  runStored?: (id: string, event: ActionEvent) => boolean
  view?: (event: ViewEvent) => void
  grantMovement?: (feet: number) => void
}

export interface ActionEvent extends UseContext {
  action: Action
  crit?: boolean
  [extra: string]: unknown
}

export function actionValue(formula: string, event: UseContext & { [extra: string]: unknown }, seed: string): number {
  let n = 0
  const resolved = event.user.catalog.formula(formula.trim()) ?? formula
  const read = (who: GameEntity | null, stat: string) => (who ? who.comp(Stats)?.value(stat) : undefined)
  const mult = event.crit === true ? 2 : 1
  return evaluate(resolved, {
    value: (name) => {
      if (name === 'distance') return event.distance
      const [who, stat] = name.split('.')
      if (who === 'user') return read(event.user, stat)
      if (who === 'target') return read(event.target, stat)
      const v = event[name]
      return typeof v === 'number' ? v : undefined
    },
    dice: (count, sides) => {
      let total = 0
      const rolls = Math.max(0, count * mult)
      for (let i = 0; i < rolls; i++) total += rollInt(event.user.uid, `${seed}:${n++}`, 1, sides)
      return total
    }
  })
}

/** Deterministic expected midpoint of a formula using average dice values for AI/tactical scoring. */
export function expectedActionValue(formula: string, ctx: UseContext & { [extra: string]: unknown }): number {
  const resolved = ctx.user.catalog.formula(formula.trim()) ?? formula
  const read = (who: GameEntity | null, stat: string) => (who ? who.comp(Stats)?.value(stat) : undefined)
  try {
    return evaluate(resolved, {
      value: (name) => {
        if (name === 'distance') return ctx.distance
        const [who, stat] = name.split('.')
        if (who === 'user') return read(ctx.user, stat)
        if (who === 'target') return read(ctx.target, stat)
        const v = ctx[name]
        return typeof v === 'number' ? v : undefined
      },
      dice: (count, sides) => count * ((sides + 1) / 2)
    })
  } catch {
    return 0
  }
}

/** Returns true if any piece inside an Action belongs to the given EffectGroup (e.g. HARM). */
export function actionHasGroup(action: Action, group: EffectGroup): boolean {
  return action.pieces().some((p) => (p.constructor as typeof ActionPiece).GROUP === group)
}

/** Sums the tactical score of pieces listening to a given event lane inside an Action. */
export function chainScore(action: Action | null, signal: string, ctx: UseContext): number {
  if (!action || !signal) return 0
  return action
    .pieces()
    .filter((p) => String(p.params.on) === signal)
    .reduce((sum, p) => {
      const pick = (p.constructor as typeof ActionPiece).AIMS ? WHO[String(p.params.who)] : undefined
      const targeted: UseContext = pick ? { ...ctx, target: pick({ ...ctx, action }) } : ctx
      return sum + p.score(targeted)
    }, 0)
}

export abstract class Action extends Component {
  static readonly LANES: EffectLane[] = []
  static readonly TRIES: boolean = true
  uses = 0

  get id(): string {
    return String(this.params.id)
  }

  fire(signal: string, ctx: UseContext, extra: Record<string, unknown> = {}): void {
    this.uses++
    this.emit(signal, { ...extra, ...ctx, action: this })
  }

  pieces(): ActionPiece[] {
    return this.comps.filter((c): c is ActionPiece => c instanceof ActionPiece)
  }

  protected saveState(): Record<string, unknown> {
    return { uses: this.uses }
  }

  protected loadState(state: Record<string, unknown>): void {
    this.uses = Number(state.uses) || 0
  }
}

const WHO: Record<string, (event: ActionEvent) => GameEntity | null> = {
  target: (event) => event.target,
  caster: (event) => event.user
}

const originals = new WeakMap<ActionEvent, ActionEvent>()

export abstract class ActionPiece extends Component {
  static readonly PARAMS_BASE = {
    on: { kind: 'text' as const, default: 'OnUse', description: 'Event this piece runs on.' },
    emit: { kind: 'text' as const, default: '', description: 'Event it sends to the next pieces. Empty sends nothing.' },
    who: { kind: 'choice' as const, choices: Object.keys(WHO), default: 'target', description: 'Who it acts on: the target, or the caster.' }
  }
  static readonly AIMS: boolean = true
  static readonly SENTENCE: string = ''
  static readonly GROUP: EffectGroup | null = null
  static readonly ICON: string = 'Sparkles'
  static readonly BRANCHES: EffectBranch[] = [{ param: 'emit', label: 'If it works', tone: 'pass' }]

  canApply(host: Component | GameEntity): true | string {
    if ((host.constructor as { type?: string }).type === 'world_effects') {
      return 'only for characters, abilities, and items'
    }
    return host instanceof Action ? true : 'this piece belongs inside an ability, item or reaction'
  }

  get action(): Action | null {
    return this.parent instanceof Action ? this.parent : null
  }

  onApplied(): void {
    super.onApplied()
    const action = this.action
    if (action) this.bind(action, String(this.params.on), (payload) => this.handle(this.aim(payload as ActionEvent)))
  }

  private aim(event: ActionEvent): ActionEvent {
    const pick = (this.constructor as typeof ActionPiece).AIMS ? WHO[String(this.params.who)] : undefined
    if (!pick) return event
    const aimed = { ...event, target: pick(event) }
    originals.set(aimed, event)
    return aimed
  }

  original(event: ActionEvent): ActionEvent {
    return originals.get(event) ?? event
  }

  abstract handle(event: ActionEvent): void

  next(event: ActionEvent, extra: Partial<ActionEvent> = {}): void {
    this.branch(event, String(this.params.emit), extra)
  }

  branch(event: ActionEvent, name: string, extra: Partial<ActionEvent> = {}): void {
    if (name) this.action?.emit(name, { ...this.original(event), ...extra })
  }

  seed(event: ActionEvent): string {
    return `${event.action.id}:${event.action.uses}:${this.uid}`
  }

  value(formula: string, event: ActionEvent): number {
    return actionValue(formula, event, this.seed(event))
  }

  report(event: ActionEvent, values: EffectResult['values'], line: string): void {
    event.collect?.({ effect: this.type, target: event.target?.uid ?? null, values, line })
  }

  canUse(_ctx: UseContext): true | string {
    return true
  }

  score(_ctx: UseContext): number {
    return 0
  }
}
