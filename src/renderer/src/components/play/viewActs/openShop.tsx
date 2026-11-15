import { engine } from '../../../lib/ipc'
import { showPlay } from '../playStore'
import { Shop } from '../Shop'
import { registerViewAct } from './registry'

registerViewAct('open_shop', async (data, { host, title, token }) => {
  const table = String(data.table ?? '')
  const stock = table ? (await engine('lootTables.roll', { id: table })).items.map((i) => i.itemId) : []
  showPlay(String(data.title ?? '') || title, <Shop visitor={token?.visitor ?? null} catalog={host.catalog} stock={stock} buyRate={Number(data.buyRate)} sellRate={Number(data.sellRate)} text="" />, { wide: true })
})
