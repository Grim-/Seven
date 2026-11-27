import { useState } from 'react'
import { RefreshCw, Trash2 } from 'lucide-react'
import type { DeviceLevelId, NetworkStatus } from '@shared/types'
import { REMOTE_LEVELS } from '@shared/remote'
import { Button, GridRow, GridTable, Modal, Segmented, SettingCard, type GridColumn } from '../../ui'
import { main } from '../../../lib/ipc'
import { failed } from '../../../lib/notify'
import { formatRelative } from '../../../lib/format'

const COLUMNS: GridColumn[] = [
  { label: 'Device', width: 'minmax(9rem, 1fr)' },
  { label: 'Paired', width: '7rem', right: true },
  { label: 'Last seen', width: '7rem', right: true },
  { label: 'Address', width: 'minmax(7rem, 1fr)' },
  { label: 'Allowed to', width: '13rem' },
  { label: 'Connected', width: '10rem', right: true }
]

export function PairedDevices({ network }: { network: NetworkStatus }) {
  const [unpairing, setUnpairing] = useState(false)
  const revoke = (deviceId: string) => void main('network.revoke', { deviceId }).catch(failed('Could not revoke the device'))
  const setLevel = (deviceId: string, level: DeviceLevelId) => void main('network.deviceLevel', { deviceId, level }).catch(failed('Could not change the device level'))
  const unpairAll = () =>
    void main('network.unpairAll')
      .then(() => setUnpairing(false))
      .catch(failed('Could not unpair the devices'))
  return (
    <SettingCard
      title="Paired devices"
      count={network.devices.length}
      actions={
        network.devices.length > 0 && (
          <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={() => setUnpairing(true)}>
            Unpair all
          </Button>
        )
      }
    >
      <GridTable columns={COLUMNS} empty={network.devices.length ? false : 'No device is paired. Pair one with the button above.'}>
        {network.devices.map((d) => (
          <GridRow key={d.id}>
            <span className="truncate text-[12px] text-ink">{d.name}</span>
            <span className="text-right font-ui text-[11px] text-faint">{formatRelative(d.pairedAt)}</span>
            <span className="text-right font-ui text-[11px] text-faint">{formatRelative(d.lastSeen)}</span>
            <span className="truncate font-ui text-[12px] text-ink/85">{d.address ?? '—'}</span>
            <Segmented value={d.level} options={REMOTE_LEVELS.map((l) => ({ value: l.id, label: l.label, hint: l.description }))} onChange={(level) => setLevel(d.id, level)} />
            <span className="flex items-center justify-end gap-1.5">
              {d.connected && <span className="font-ui text-[11px] text-ok">Now</span>}
              <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => revoke(d.id)}>
                Revoke
              </Button>
            </span>
          </GridRow>
        ))}
      </GridTable>
      <Modal
        open={unpairing}
        title="Unpair all devices"
        onClose={() => setUnpairing(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setUnpairing(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={unpairAll}>
              Unpair all
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink/85">Gives Seven a new identity. Every paired device is disconnected at once and loses access until you pair it again.</p>
      </Modal>
    </SettingCard>
  )
}
