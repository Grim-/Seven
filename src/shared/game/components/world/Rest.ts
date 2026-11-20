import { registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { WorldPiece } from './WorldPiece'

export class ShortRest extends WorldPiece {
  static readonly type: string = 'world.shortRest'
  static readonly DESCRIPTION: string = 'The party takes a short rest: the clock moves on by the clock\'s short rest, and short-rest pools refill.'
  static readonly PARAMS = { ...WorldPiece.PARAMS_BASE }
  static readonly SENTENCE: string = 'Take a short rest'
  static readonly ICON: string = 'Flame'

  handle(event: ActionEvent): void {
    this.send(event, 'short_rest', {})
    this.report(event, {}, 'Short rest.')
    this.next(event)
  }
}

export class LongRest extends WorldPiece {
  static readonly type: string = 'world.longRest'
  static readonly DESCRIPTION: string = 'The party takes a long rest: the clock moves on by the clock\'s long rest, health, slots and long-rest pools refill. Once per day.'
  static readonly PARAMS = { ...WorldPiece.PARAMS_BASE }
  static readonly SENTENCE: string = 'Take a long rest'
  static readonly ICON: string = 'Moon'

  handle(event: ActionEvent): void {
    this.send(event, 'long_rest', {})
    this.report(event, {}, 'Long rest.')
    this.next(event)
  }
}

registerComponent(ShortRest)
registerComponent(LongRest)
