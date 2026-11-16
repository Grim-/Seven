import type { ModuleFactory } from '../../engine/modules/sdk'
import type { ToolDef } from '../../engine/tools/types'
import { registerModuleKind } from '../../engine/library/moduleKinds'
import { gameKinds } from './kinds'
import { gameTools } from './tools'
import './tokens'
import './blueprints'
import './cardVariation'

for (const kind of gameKinds()) registerModuleKind('game', kind)

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: ToolDef): void }): void {
      for (const tool of gameTools) tools.add(tool)
    }
  }

export default factory
