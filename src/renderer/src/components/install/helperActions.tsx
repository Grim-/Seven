import { Download, FolderOpen, FolderPlus, RefreshCw } from 'lucide-react'
import { installRunning, type InstallHelperState } from '@shared/types'
import { pickFolder, type MenuItem } from '../ui'
import { engine, main } from '../../lib/ipc'
import { failed } from '../../lib/notify'

export function helperActions(state: InstallHelperState, openWizard: () => void): MenuItem[] {
  const helper = state.id
  const busy = installRunning(state.job)
  return [
    { label: 'Install a version', icon: <Download />, disabled: busy, hint: busy ? 'An install is running.' : undefined, onSelect: openWizard },
    { label: 'Check for updates', icon: <RefreshCw />, onSelect: () => void engine('install.check', { helper }).catch(failed('Could not check for updates')) },
    { label: 'Add one you have', icon: <FolderPlus />, hint: `Pick a folder that has ${state.program}.`, onSelect: () => pickFolder((folder) => void engine('install.addExisting', { helper, folder }).catch(failed('Could not add that folder'))) },
    { label: 'Open install folder', icon: <FolderOpen />, onSelect: () => void main('folder.open', { path: state.root }).catch(failed('Could not open the folder')) }
  ]
}
