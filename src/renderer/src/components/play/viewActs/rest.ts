import { registerViewAct } from './registry'
import { restLong, restShort } from '../time'

registerViewAct('short_rest', (_data, { host }) => {
  if (host.save) restShort(host.save.id, host.tokens, {})
})
registerViewAct('long_rest', (_data, { host }) => {
  if (host.save) restLong(host.save.id, host.tokens)
})
