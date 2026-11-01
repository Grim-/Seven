import type { ModuleFactory } from '../../engine/modules/sdk'
import { DASHBOARD_TOOLS } from './tools'

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: (typeof DASHBOARD_TOOLS)[number]): void }): void {
      for (const tool of DASHBOARD_TOOLS) tools.add(tool)
    }
  }

export default factory
