import type { ModuleFactory } from '../../engine/modules/sdk'
import { WRITE_TOOLS } from './tools'

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: (typeof WRITE_TOOLS)[number]): void }): void {
      for (const tool of WRITE_TOOLS) tools.add(tool)
    }
  }

export default factory
