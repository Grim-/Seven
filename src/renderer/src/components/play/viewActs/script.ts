import { engine } from '../../../lib/ipc'
import { registerViewAct } from './registry'

registerViewAct('script', (data) => {
  const id = String(data.script ?? '')
  if (id) return engine('python.run', { id })
  return undefined
})
