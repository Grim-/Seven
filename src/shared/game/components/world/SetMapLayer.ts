import { registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { WorldPiece } from './WorldPiece'

export class SetMapLayer extends WorldPiece {
  static readonly type: string = 'world.setMapLayer'
  static readonly DESCRIPTION: string = 'Shows, hides, opens, or blocks a map layer in the active save.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    layer: { kind: 'mapLayer' as const, default: '', description: 'Which map layer.' },
    mode: {
      kind: 'choice' as const,
      choices: ['show', 'hide', 'open', 'block'],
      labels: { show: 'show', hide: 'hide', open: 'open (passable)', block: 'block (solid)' },
      default: 'open',
      description: 'How the layer changes in this save.'
    }
  }
  static readonly SENTENCE: string = 'Set layer {layer} to {mode}'
  static readonly ICON: string = 'Layers'
  static readonly AIMS: boolean = false

  handle(event: ActionEvent): void {
    const p = this.params
    this.send(event, 'set_map_layer', { layer: p.layer, mode: p.mode })
    this.report(event, {}, `Layer ${String(p.layer)} set to ${String(p.mode)}.`)
    this.next(event)
  }
}

registerComponent(SetMapLayer)
