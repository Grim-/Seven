import { engine } from '../../lib/ipc'
import { moduleOn } from '../../lib/moduleOn'
import { useAgents } from '../../store/agents'
import { statusSources } from '../chat/status/characterStatus'
import { sheetTarget } from '../../game/sheetTarget'
import { targetSources } from '../../game/targets'

targetSources.add({
  id: 'characters',
  module: 'world',
  name: 'Characters',
  order: 10,
  list: async ({ sheet, agents }) => {
    const agentSheets = useAgents
      .getState()
      .list.filter((a) => agents.includes(a.id))
      .map((a) => a.sheet)
    const ids = [...new Set([sheet, ...agentSheets].filter((id): id is string => !!id))]
    const sheets = await Promise.all(ids.map((id) => engine('sheets.get', { id })))
    const sources = statusSources.on(moduleOn)
    return sheets.map((s) => {
      const health = sources.map((src) => src.read(s).health).find(Boolean)
      return { ...sheetTarget(s.id, s.title, health ? `${health.cur}/${health.max} HP` : '', s.image ?? null), group: s.id === sheet ? 'You' : 'Characters' }
    })
  }
})
