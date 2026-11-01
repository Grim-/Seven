import type { ModuleFactory } from '../../engine/modules/sdk'
import { READ_TOOLS } from './tools'

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: (typeof READ_TOOLS)[number]): void }): void {
      for (const tool of READ_TOOLS) tools.add(tool)
    }
  }

export default factory
