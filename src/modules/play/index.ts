import type { ModuleFactory } from '../../engine/modules/sdk'
import { registerModuleKind } from '../../engine/library/moduleKinds'
import { saveKind } from '../game/kinds'
import '../game/dmAgent'

registerModuleKind('play', saveKind)

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(): void {
      // Play is a view + save-kind + preset module that builds on the shared `game` and `world` modules.
    }
  }

export default factory
