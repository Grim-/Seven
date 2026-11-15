import { toast } from '../../../store/toasts'
import { registerViewAct } from './registry'

registerViewAct('cue', (data, { title }) => {
  const message = String(data.message ?? '')
  if (message) toast.info(title, message)
})
