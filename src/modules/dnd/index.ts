import type { ModuleFactory } from '../../engine/modules/sdk'
import type { ToolDef } from '../../engine/tools/types'
import { registerModuleKind } from '../../engine/library/moduleKinds'
import { compendiumKinds } from './kinds'
import './blueprints'

for (const kind of compendiumKinds()) registerModuleKind('dnd', kind)

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(_tools: { add(tool: ToolDef): void }): void {
      return
    }
  }

export default factory
