import { checkDefence, checkTargets } from '@shared/actions'
import type { CharacterSheet } from '@shared/types'
import { actorLink } from '@shared/worldNpcs'
import { engine } from '../lib/ipc'
import { changeHealth } from './health'
import type { PlayTarget } from './targets'

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))
const sheetOf = (id: string): Promise<CharacterSheet> => engine('sheets.get', { id })

export function sheetTarget(id: string, name: string, note = '', image: string | null = null): PlayTarget {
  return {
    id: `sheet:${id}`,
    name,
    image,
    group: 'Characters',
    note,
    link: actorLink(id),
    ref: { sheet: id },
    health: (delta) => changeHealth(id, delta),
    give: (item, count, gold) =>
      engine('game.giveItem', { sheet: id, item, count, gold })
        .then(({ given, gold: coins }) => [given ? `${given}x ${item}` : '', coins ? `${coins} gold` : ''].filter(Boolean).join(', ') || 'nothing fit')
        .catch(message),
    take: (item, count) =>
      engine('game.takeItem', { sheet: id, item, count })
        .then((taken) => (taken ? `${taken}x ${item}` : `no ${item} to take`))
        .catch(message),
    defence: async (check) => checkDefence(await sheetOf(id), check),
    checks: async () => checkTargets(await sheetOf(id))
  }
}
