import { useState } from 'react'
import type { InstallHelperState, InstallVersion } from '@shared/types'
import { ActionBar, Fact, FactGrid, GridRow, GridTable, LogBox, SettingCard, StatusBadge, openMenu, type Tone } from '../ui'
import { formatRelative } from '../../lib/format'
import { versionActions } from './versionActions'

function status(state: InstallHelperState, v: InstallVersion): { label: string; tone: Tone } {
  if (state.active === v.id) return { label: 'Active', tone: 'ok' }
  if (v.inUse.length) return { label: 'In use', tone: 'busy' }
  if (!v.check) return { label: 'Not checked', tone: 'warn' }
  return v.check.ok ? { label: 'Ready', tone: 'idle' } : { label: 'Broken', tone: 'error' }
}

const COLUMNS = [
  { label: 'Version', width: 'minmax(9rem,1.4fr)' },
  { label: 'Build', width: 'minmax(6rem,1fr)' },
  { label: 'Installed', width: '7rem' },
  { label: 'Where', width: '6rem' },
  { label: 'State', width: '7rem', right: true }
]

export function VersionList({ state }: { state: InstallHelperState }) {
  const [picked, setPicked] = useState<string | null>(state.active)
  const selected = state.versions.find((v) => v.id === picked) ?? null
  return (
    <SettingCard title="Versions" count={state.versions.length}>
      <GridTable columns={COLUMNS} empty={state.versions.length ? false : 'No versions yet.'}>
        {state.versions.map((v) => {
          const s = status(state, v)
          return (
            <GridRow key={v.id} selected={v.id === picked} onClick={() => setPicked(v.id)} onContextMenu={(e) => openMenu(e, v.label, versionActions(state, v))}>
              <span className="truncate font-mono text-[12.5px] text-white" title={v.folder}>
                {v.tag ?? v.id}
              </span>
              <span className="truncate text-[12.5px]">{v.label}</span>
              <span className="text-[12px] text-dim">{v.installedAt ? formatRelative(v.installedAt) : '—'}</span>
              <span className="text-[12px] text-dim">{v.external ? 'Yours' : 'Seven'}</span>
              <span className="text-right">
                <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
              </span>
            </GridRow>
          )
        })}
      </GridTable>
      {selected && (
        <div className="flex flex-col gap-3 p-3.5">
          <FactGrid>
            <Fact label="Folder" wide>
              <span className="font-mono text-[12px]">{selected.folder}</span>
            </Fact>
            <Fact label="Checksum">{selected.checksum === null ? 'Not published' : selected.checksum ? 'Matched' : 'Did not match'}</Fact>
            <Fact label="Checked">{selected.check ? formatRelative(selected.check.at) : 'Never'}</Fact>
            <Fact label="In use by">{selected.inUse.length ? selected.inUse.join(', ') : 'Nothing'}</Fact>
            {selected.check?.error && <Fact label="Problem" wide>{selected.check.error}</Fact>}
          </FactGrid>
          {selected.check && <LogBox lines={[...selected.check.version.split(/\r?\n/), '', ...selected.check.devices.split(/\r?\n/)]} />}
          <ActionBar items={versionActions(state, selected)} />
        </div>
      )}
    </SettingCard>
  )
}
