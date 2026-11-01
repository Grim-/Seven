import type { ModuleFactory } from '../../engine/modules/sdk'
import type { ToolDef } from '../../engine/tools/types'
import { MIND_TOOLS } from './tools'

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: ToolDef): void }): void {
      for (const tool of MIND_TOOLS) tools.add(tool)
    }
  }

export default factory
