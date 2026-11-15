import { bringHere } from '../bringHere'
import { registerViewAct, spotBeside } from './registry'

registerViewAct('recruit', async (data, { host, token }) => {
  const sheet = String(data.sheet ?? '')
  if (sheet && (await bringHere(host.world, sheet))) await host.stand(sheet, spotBeside(host, token))
})
