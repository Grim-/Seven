import '@shared/dndChecks'
import { gateCheckSources } from '@shared/checkSources'
import { moduleOn } from '../../../../lib/moduleOn'
import { healthWriters, statusSources } from '../../../chat/status/characterStatus'
import { saveSheet } from '../../../../lib/saveSheet'

gateCheckSources(moduleOn)

statusSources.add({
  id: 'dnd',
  module: 'dnd',
  name: 'Hit points and conditions',
  order: 10,
  read: (sheet) =>
    sheet.dnd
      ? {
          health: { cur: sheet.dnd.hp.cur, max: sheet.dnd.hp.max, temp: sheet.dnd.hp.temp },
          effects: [...sheet.dnd.conditions, ...(sheet.dnd.exhaustion > 0 ? [`Exhaustion ${sheet.dnd.exhaustion}`] : [])]
        }
      : {}
})

healthWriters.add({
  id: 'dnd',
  module: 'dnd',
  name: 'Hit points',
  order: 10,
  change: (sheet, delta) => {
    const d = sheet.dnd
    if (!d) return null
    const to = Math.max(0, Math.min(d.hp.max, d.hp.cur + delta))
    return saveSheet({ ...sheet, dnd: { ...d, hp: { ...d.hp, cur: to } } }).then(() => ({ from: d.hp.cur, to }))
  }
})
