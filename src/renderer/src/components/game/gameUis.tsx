import { RULE_SET_KIND, defTypes } from '@shared/game/defs'
import { registerKindUi } from '../../registries/kinds'
import { entryWidget } from '../../registries/widgets'
import { GameDefScreen, NEW_DEF } from './GameDefScreen'
import { GameDefChat, GameDefWidget } from './GameDefChat'
import { RuleSetChat, RuleSetScreen, RuleSetWidget } from './RuleSetScreen'
import { SaveChat, SaveScreen, SaveWidget } from './SaveScreen'
import './creatureTokens'

registerKindUi(RULE_SET_KIND, {
  present: { Screen: RuleSetScreen, Chat: RuleSetChat, Stage: RuleSetChat, Widget: entryWidget(RuleSetWidget) },
  addLabel: 'New rule set',
  add: (kind, select) => () => select({ kind, id: NEW_DEF })
})

registerKindUi('game_save', {
  present: { Screen: SaveScreen, Chat: SaveChat, Stage: SaveChat, Widget: entryWidget(SaveWidget) }
})

for (const type of defTypes())
  registerKindUi(type.type, {
    present: { Screen: GameDefScreen, Chat: GameDefChat, Stage: GameDefChat, Widget: entryWidget(GameDefWidget) },
    addLabel: `New ${type.label.toLowerCase()}`,
    add: (kind, select) => () => select({ kind, id: NEW_DEF })
  })
