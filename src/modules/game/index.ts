import type { ModuleFactory } from '../../engine/modules/sdk'
import type { ToolDef } from '../../engine/tools/types'
import { registerModuleKind } from '../../engine/library/moduleKinds'
import { gameKinds } from './kinds'

for (const kind of gameKinds()) registerModuleKind('game', kind)

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(_tools: { add(tool: ToolDef): void }): void {
      return
    }
  }

export default factory
