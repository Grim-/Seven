import type { InstallHelperState } from '@shared/types'
import { ActionBar, StatusBadge, openMenu } from '../ui'
import { formatRelative } from '../../lib/format'
import { helperActions } from './helperActions'

export function HelperBar({ state, onInstall }: { state: InstallHelperState; onInstall: () => void }) {
  const active = state.versions.find((v) => v.id === state.active) ?? null
  const actions = helperActions(state, onInstall)
  return (
    <div onContextMenu={(e) => openMenu(e, state.title, actions)} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line/50 pb-2.5">
      <span className="font-ui text-[12px] text-faint">Active</span>
      <span className="font-ui text-[13px] text-ink">{active?.label ?? 'None'}</span>
      {state.update && <StatusBadge tone="warn">{`${state.update.tag} is out`}</StatusBadge>}
      <span className="text-[12px] text-faint">{state.checkedAt ? `Checked ${formatRelative(state.checkedAt)}` : 'Never checked for updates'}</span>
      <ActionBar row items={actions} className="ml-auto" />
    </div>
  )
}
