import type { CharacterSheet } from '@shared/types'
import { engine } from './ipc'

export function saveSheet(s: CharacterSheet) {
  return engine('sheets.save', { id: s.id, title: s.title, fields: s.fields, values: s.values, dnd: s.dnd, game: s.game, gameRules: s.gameRules, faction: s.faction, story: s.story })
}
