import { engine, main } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { toast } from '../../store/toasts'
import { askConfirm } from '../ui'

const FILTERS = [{ name: 'Tool module', extensions: ['zip'] }]

async function install(file: string, replace: boolean, open: (id: string) => void): Promise<void> {
  try {
    const result = await engine('tools.installZip', { path: file, replace })
    if (result.needsReplace) {
      const r = result.needsReplace
      askConfirm(`Replace ${r.name}?`, `v${r.from} is installed. The zip has v${r.to}. It stays off until you switch it on again.`, 'Replace', () => void install(file, true, open))
      return
    }
    const id = result.installed
    if (id) toast.success('Module installed', `${id} is not switched on yet.`, { label: 'Open', onSelect: () => open(id) })
  } catch (err) {
    toast.error('Could not install the module', errorText(err))
  }
}

export async function installZip(open: (id: string) => void): Promise<void> {
  const file = await main('dialog.openFile', { filters: FILTERS })
  if (file) await install(file, false, open)
}
