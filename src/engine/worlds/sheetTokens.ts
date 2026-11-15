import { noteFailure } from '../util/report'
import type { CharacterSheet } from '@shared/types'
import { asToken } from '@shared/maps'
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
    return tokens.flatMap((token) => {
      const s = sheetOf(token)
      if (!s) return []
      const v = visitorOf(s, agents)
      return [asToken(v, token, 'sheet')]
    })
  },
  placed: (token, save) => (token in save.characters ? save : { ...save, characters: { ...save.characters, [token]: { where: '', game: null } } })
})
