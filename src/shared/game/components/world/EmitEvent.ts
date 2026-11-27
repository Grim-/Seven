import { registerComponent, type ComponentDef } from '../../core'
import type { ActionEvent } from '../Action'
import { WorldPiece } from './WorldPiece'

export class EmitEvent extends WorldPiece {
  static readonly type: string = 'world.emitEvent'
  static readonly DESCRIPTION: string = 'Sends a named event down every link leaving this map thing. Reactions on the linked things listen for it.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    event: { kind: 'text' as const, default: '', description: 'The event name, e.g. FireTrap.' }
  }
  static readonly SENTENCE: string = 'Send {event} down its links'
  static readonly ICON: string = 'Cable'
  static readonly AIMS: boolean = false

  handle(event: ActionEvent): void {
    const name = String(this.params.event ?? '').trim()
    if (name) event.view?.({ kind: 'link_emit', data: { event: name, path: Array.isArray(event.linkPath) ? event.linkPath : [] }, entity: event.user?.uid ?? null })
    this.report(event, {}, name ? `Sent ${name}.` : 'No event to send.')
    this.next(event)
  }
}

registerComponent(EmitEvent)

export function emittedEvents(defs: ComponentDef[]): string[] {
  const out = new Set<string>()
  const walk = (list: ComponentDef[]) => {
    for (const def of list) {
      if (def.type === EmitEvent.type && typeof def.event === 'string' && def.event.trim()) out.add(def.event.trim())
      if (Array.isArray(def.comps)) walk(def.comps as ComponentDef[])
    }
  }
  walk(defs)
  return [...out]
}
