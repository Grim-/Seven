import { CheckCircle2, FolderOpen, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import type { InstallHelperState, InstallVersion } from '@shared/types'
import { confirmDelete, type MenuItem } from '../ui'
import { engine, main } from '../../lib/ipc'
import { failed } from '../../lib/notify'

export function versionActions(state: InstallHelperState, v: InstallVersion): MenuItem[] {
  const helper = state.id
  const active = state.active === v.id
  const usable = v.check?.ok === true
  const activate = (restart: boolean) => void engine('install.activate', { helper, version: v.id, restart }).catch(failed(`Could not make ${v.label} active`))
  const removeHint = active ? 'This is the active version.' : v.inUse.length ? `In use by ${v.inUse.join(', ')}.` : undefined
  return [
    { label: 'Make active', icon: <CheckCircle2 />, disabled: active || !usable, hint: active ? 'Already active.' : usable ? undefined : 'It has not passed its check.', onSelect: () => activate(false) },
    { label: 'Make active and restart', icon: <RotateCcw />, disabled: active || !usable, hint: active ? 'Already active.' : usable ? 'Restarts what is running on the new version.' : 'It has not passed its check.', onSelect: () => activate(true) },
    { label: 'Check again', icon: <ShieldCheck />, onSelect: () => void engine('install.verify', { helper, version: v.id }).catch(failed(`Could not check ${v.label}`)) },
    { label: 'Show folder', icon: <FolderOpen />, onSelect: () => void main('folder.open', { path: v.folder }).catch(failed('Could not open the folder')) },
    {
      label: v.external ? 'Remove from list' : 'Remove',
      icon: <Trash2 />,
      danger: true,
      disabled: Boolean(removeHint),
      hint: removeHint,
      onSelect: () =>
        confirmDelete(
          `Remove ${v.label}?`,
          v.external ? `${v.folder} stays on disk; Seven just stops listing it.` : `This deletes ${v.folder}.`,
          () => engine('install.remove', { helper, version: v.id }),
          undefined,
          'Remove'
        )
    }
  ]
}
