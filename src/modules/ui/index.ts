import type { ModuleFactory } from '../../engine/modules/sdk'
import { UI_TOOLS } from './tools'

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: (typeof UI_TOOLS)[number]): void }): void {
      for (const tool of UI_TOOLS) tools.add(tool)
    }
  }

export default factory
