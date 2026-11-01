import type { ModuleFactory } from '../../engine/modules/sdk'
import type { ToolDef } from '../../engine/tools/types'
import { TODO_TOOLS } from './tools'

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: ToolDef): void }): void {
      for (const tool of TODO_TOOLS) tools.add(tool)
    }
  }

export default factory
