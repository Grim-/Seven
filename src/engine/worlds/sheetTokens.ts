import { noteFailure } from '../util/report'
import type { CharacterSheet } from '@shared/types'
import { recordHealth } from '@shared/game/components'
import { asToken } from '@shared/maps'
import { gameCatalog } from '../../modules/game/characters'
import { getSheet } from '../library/sheets'
import { agentAccess } from '../agents/access'
import { visitorOf } from './presence'
import { registerTokenSource } from './tokenSources'

const sheetOf = (token: string): CharacterSheet | null => {
  try {
    return getSheet(token)
  } catch (err) {
    noteFailure(err, 'worlds', 'Could not read a character token')
    return null
  }
}

registerTokenSource({
  id: 'sheet',
  module: 'world',
  label: 'Characters',
  owns: (token) => sheetOf(token)?.id === token,
  resolve: (tokens) => {
    const agents = agentAccess.list()
    const cat = gameCatalog()
    return tokens.flatMap((token) => {
      const s = sheetOf(token)
      if (!s) return []
      const v = visitorOf(s, agents)
      const gHp = recordHealth(v.game, cat)
      return [asToken(v, token, 'sheet', gHp ? { cur: gHp.cur, max: gHp.max } : undefined)]
    })
  },
  placed: (token, save) => (token in save.characters ? save : { ...save, characters: { ...save.characters, [token]: { where: '', game: null } } })
})
