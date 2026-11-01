import type { ModuleFactory } from '../../engine/modules/sdk'
import { LOOK_TOOLS } from './tools'

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: (typeof LOOK_TOOLS)[number]): void }): void {
      for (const tool of LOOK_TOOLS) tools.add(tool)
    }
  }

export default factory
