import type { ModuleFactory } from '../../engine/modules/sdk'
import { shellTools } from './tools'

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: ReturnType<typeof shellTools>[number]): void }): void {
      for (const tool of shellTools(() => this.settings.showMedia !== false)) tools.add(tool)
    }
  }

export default factory
