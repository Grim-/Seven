import type { ModuleFactory } from '../../engine/modules/sdk'
import type { ToolDef } from '../../engine/tools/types'
import { registerModuleKind } from '../../engine/library/moduleKinds'
import { decisionKind } from './kind'
import { decisionTools } from './tools'

registerModuleKind('decisions', decisionKind)

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: ToolDef): void }): void {
      for (const tool of decisionTools) tools.add(tool)
    }
  }

export default factory
