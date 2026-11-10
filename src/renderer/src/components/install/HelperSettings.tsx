import type { InstallHelperState } from '@shared/types'
import { Panel, SaveState, useAutosavedState } from '../ui'
import { ParamFields } from '../game/ParamFields'
import { engine } from '../../lib/ipc'

export function HelperSettings({ state }: { state: InstallHelperState }) {
  const values = useAutosavedState<Record<string, unknown>>(state.settings, (v) => engine('install.settings', { helper: state.id, values: v }))
  return (
    <Panel title={`${state.title} settings`} actions={<SaveState status={values.status} error={values.error} />} collapsible defaultOpen={false}>
      <ParamFields schema={state.schema} values={values.value} onChange={values.set} />
    </Panel>
  )
}
