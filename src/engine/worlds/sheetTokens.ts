import { noteFailure } from '../util/report'
import type { CharacterSheet } from '@shared/types'
import { splitNpcRef } from '@shared/worldNpcs'
import { recordHealth } from '@shared/game/components'
import { asToken } from '@shared/maps'
import { gameCatalog } from '../../modules/game/characters'
import { actorSheetOwner } from '../actors/sheets'
import { getSheet } from '../library/sheets'
import { agentAccess } from '../agents/access'
import { npcs } from './npcs'
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
  label: 'Characters & NPCs',
  owns: (token) => actorSheetOwner(token) !== null,
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
  placed: (token, save) => {
    if (splitNpcRef(token)) return save
    return token in save.characters ? save : { ...save, characters: { ...save.characters, [token]: { where: '', game: null } } }
  },
  removed: (token, save) => {
    const npc = splitNpcRef(token)
    if (!npc || npc.world !== save.world) return save
    if (npcs.hasTemplate(save.world, npc.id) || save.party?.includes(token)) return save
    const { [npc.id]: _gone, ...restNpcs } = save.npcs
    return { ...save, npcs: restNpcs }
  }
})
