import type { CharacterSheet } from '@shared/types'
import { getSheet } from '../library/sheets'
import { agentAccess } from '../agents/access'
import { visitorOf } from './presence'
import { registerTokenSource } from './tokenSources'

const sheetOf = (token: string): CharacterSheet | null => {
  try {
    return getSheet(token)
  } catch {
    return null
  }
}

registerTokenSource({
  id: 'sheet',
  owns: (token) => sheetOf(token)?.id === token,
  resolve: (tokens) => {
    const agents = agentAccess.list()
    return tokens.flatMap((token) => {
      const s = sheetOf(token)
      if (!s) return []
      const v = visitorOf(s, agents)
      return [{ ...v, token, source: 'sheet', hp: v.dnd ? { cur: v.dnd.hp.cur, max: v.dnd.hp.max } : null }]
    })
  },
  placed: (token, save) => (token in save.characters ? save : { ...save, characters: { ...save.characters, [token]: { where: '', game: null } } })
})
