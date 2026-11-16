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
}

export interface ActionEvent extends UseContext {
  action: Action
  [extra: string]: unknown
}

export function actionValue(formula: string, event: UseContext & { [extra: string]: unknown }, seed: string): number {
  let n = 0
  const read = (who: GameEntity | null, stat: string) => (who ? who.comp(Stats)?.value(stat) : undefined)
  return evaluate(formula, {
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
      for (let i = 0; i < count; i++) total += rollInt(event.user.uid, `${seed}:${n++}`, 1, sides)
      return total
    }
  })
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

  next(event: ActionEvent): void {
    this.branch(event, String(this.params.emit))
  }

  branch(event: ActionEvent, name: string): void {
    if (name) this.action?.emit(name, { ...this.original(event) })
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
