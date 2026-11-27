import { defTypes } from '@shared/game/defs'
import { registerKindUi } from '../../registries/kinds'
import { entryWidget } from '../../registries/widgets'
import { GameDefScreen, NEW_DEF } from './GameDefScreen'
import { GameDefChat, GameDefWidget } from './GameDefChat'
import { SaveChat, SaveScreen, SaveWidget } from './SaveScreen'
import './character/facet'
import '../play/gameplayCard'
import './character/health'
import './character/status'
import './creatureTargets'

registerKindUi('game_save', {
  present: { Screen: SaveScreen, Chat: SaveChat, Stage: SaveChat, Widget: entryWidget(SaveWidget) }
})

for (const type of defTypes())
  registerKindUi(type.kind ?? type.type, {
    present: { Screen: GameDefScreen, Chat: GameDefChat, Stage: GameDefChat, Widget: entryWidget(GameDefWidget) },
    addLabel: `New ${type.label.toLowerCase()}`,
    add: (kind, select) => () => select({ kind, id: NEW_DEF })
  })
