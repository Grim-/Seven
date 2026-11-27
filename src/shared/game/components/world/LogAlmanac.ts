import { registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { WorldPiece } from './WorldPiece'

export class LogAlmanac extends WorldPiece {
  static readonly type: string = 'world.logAlmanac'
  static readonly DESCRIPTION: string = 'Records a milestone entry in the active save’s Almanac.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    title: { kind: 'text' as const, default: '', description: 'Entry headline.' },
    summary: { kind: 'text' as const, default: '', description: 'What happened.' }
  }
  static readonly SENTENCE: string = 'Record in Almanac: {title} — {summary}'
  static readonly ICON: string = 'BookOpen'
  static readonly AIMS: boolean = false

  handle(event: ActionEvent): void {
    const p = this.params
    this.send(event, 'log_almanac', { title: p.title, summary: p.summary })
    this.report(event, {}, `Logged in Almanac: ${String(p.title)}.`)
    this.next(event)
  }
}

registerComponent(LogAlmanac)
