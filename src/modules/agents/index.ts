import type { ModuleFactory } from '../../engine/modules/sdk'
import { AGENT_TOOLS } from './tools'

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: (typeof AGENT_TOOLS)[number]): void }): void {
      for (const tool of AGENT_TOOLS) tools.add(tool)
    }
  }

export default factory
