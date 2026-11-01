import type { ModuleFactory } from '../../engine/modules/sdk'
import type { ToolDef } from '../../engine/tools/types'
import { DATA_TOOLS } from './tools'
import { FILE_TOOLS } from './files'

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: ToolDef): void }): void {
      for (const tool of [...DATA_TOOLS, ...FILE_TOOLS]) tools.add(tool)
    }
  }

export default factory
