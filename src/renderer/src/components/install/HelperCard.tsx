import type { InstallHelperState } from '@shared/types'
import { ActionBar, Fact, FactGrid, Panel, openMenu } from '../ui'
import { formatRelative } from '../../lib/format'
import { helperActions } from './helperActions'

export function HelperCard({ state, onInstall }: { state: InstallHelperState; onInstall: () => void }) {
  const active = state.versions.find((v) => v.id === state.active) ?? null
  const actions = helperActions(state, onInstall)
  return (
    <div onContextMenu={(e) => openMenu(e, state.title, actions)}>
      <Panel title={state.title} meta={active?.label ?? 'None active'} bodyClassName="flex flex-col gap-3 p-3">
        <p className="text-[12.5px] leading-relaxed text-ink/80">{state.about}</p>
        <FactGrid>
          <Fact label="Active">{active ? active.label : 'None. Install a version or add one you have.'}</Fact>
          <Fact label="Versions">{state.versions.length}</Fact>
          <Fact label="Source">{state.source}</Fact>
          <Fact label="Last checked">{state.checkedAt ? formatRelative(state.checkedAt) : 'Never'}</Fact>
          <Fact label="Newest release">{state.releases[0]?.tag ?? '—'}</Fact>
          {state.update && <Fact label="Update">{`${state.update.tag} is out`}</Fact>}
          <Fact label="Install folder" wide>
            <span className="font-ui text-[12px]">{state.root}</span>
          </Fact>
        </FactGrid>
        <ActionBar items={actions} />
      </Panel>
    </div>
  )
}
