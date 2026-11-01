import type { ModuleFactory } from '../../engine/modules/sdk'
import type { ToolDef } from '../../engine/tools/types'
import { STORY_TOOLS } from './tools'
import { sceneTool } from './scene'

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: ToolDef): void }): void {
      for (const tool of STORY_TOOLS) tools.add(tool)
      tools.add(sceneTool)
    }
  }

export default factory
