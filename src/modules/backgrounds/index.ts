import type { ModuleFactory } from '../../engine/modules/sdk'
import type { ToolDef } from '../../engine/tools/types'

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(_tools: { add(tool: ToolDef): void }): void {}
  }

export default factory
