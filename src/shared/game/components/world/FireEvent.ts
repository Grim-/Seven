import { entryLink, registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { WorldPiece } from './WorldPiece'

export class FireEvent extends WorldPiece {
  static readonly type: string = 'world.fireEvent'
  static readonly DESCRIPTION: string = 'Starts a world event, or resolves it straight away by its scores.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    event: { kind: 'worldEvent' as const, default: '', description: 'The world event.' },
    then: { kind: 'choice' as const, choices: ['start', 'resolve'], labels: { start: 'start', resolve: 'resolve by scores' }, default: 'start', description: 'start: it becomes active. resolve: its outcome is scored and applied.' }
  }
  static readonly SENTENCE: string = '{then} the world event {event}'
  static readonly ICON: string = 'Flame'

  handle(event: ActionEvent): void {
    const p = this.params
    this.send(event, 'fire_event', { event: p.event, then: p.then })
    this.report(event, {}, `${p.then === 'resolve' ? 'Resolved' : 'Started'} ${entryLink('world', String(p.event))}.`)
    this.next(event)
  }
}

registerComponent(FireEvent)
