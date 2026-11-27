import { worldEvents } from '../../worlds/events'
import { registerWorldAct } from '../acts'

registerWorldAct('fire_event', (data, { world }) => {
  const [eventWorld, , id] = String(data.event ?? '').split('/')
  const target = eventWorld || world
  if (!id || !target) return null
  if (data.then === 'resolve') worldEvents.resolve(id, { worldId: target })
  else worldEvents.setStatus(id, 'active', target)
  return null
})
