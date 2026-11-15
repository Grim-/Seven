import { Unlock } from 'lucide-react'
import type { NetworkStatus } from '@shared/types'
import { Button, GridRow, GridTable, SettingCard, type GridColumn } from '../../ui'
import { main } from '../../../lib/ipc'
import { failed } from '../../../lib/notify'
import { formatRelative } from '../../../lib/format'

const COLUMNS: GridColumn[] = [
  { label: 'Address', width: 'minmax(9rem, 1fr)' },
  { label: 'Last seen', width: '7rem', right: true },
  { label: 'Requests', width: '5.5rem', right: true },
  { label: 'Wrong passwords', width: '8rem', right: true },
  { label: 'Model', width: 'minmax(8rem, 1fr)' },
  { label: 'Locked', width: '9rem', right: true }
]

export function ApiClients({ network }: { network: NetworkStatus }) {
  const unlock = (address: string) => void main('network.unlock', { address }).catch(failed('Could not unlock'))
  return (
    <SettingCard title="Programs using the model API" count={network.clients.length}>
      <GridTable columns={COLUMNS} empty={network.clients.length ? false : 'No program has connected since Seven started.'}>
        {network.clients.map((c) => (
          <GridRow key={c.address}>
            <span className="font-mono text-[12px] text-white">{c.address}</span>
            <span className="text-right font-mono text-[11px] text-faint">{formatRelative(c.lastAt)}</span>
            <span className="text-right font-mono text-[12px] text-white/85">{c.requests}</span>
            <span className="text-right font-mono text-[12px] text-white/85">{c.failures}</span>
            <span className="truncate text-[12px] text-white/85">{c.model ?? '—'}</span>
            <span className="flex justify-end">
              {c.lockedUntil ? (
                <Button size="sm" variant="ghost" icon={<Unlock />} onClick={() => unlock(c.address)}>
                  Unlock
                </Button>
              ) : (
                <span className="font-mono text-[11px] text-faint">No</span>
              )}
            </span>
          </GridRow>
        ))}
      </GridTable>
    </SettingCard>
  )
}
