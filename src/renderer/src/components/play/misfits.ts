import { engine } from '../../lib/ipc'
import { toast } from '../../store/toasts'

export async function noteMisfits(sheet: string, name: string): Promise<void> {
  const list = await engine('game.misfits', { sheet })
  if (list.length) toast.info(`${name} brings things these rules don't have`, `${list.join(', ')}. They are kept, and work again under rules that have them.`)
}
