import { useEffect, useState } from 'react'
import { Copy, KeyRound, RefreshCw, Sparkles, Trash2, Unlock } from 'lucide-react'
import type { DeviceLevelId, NetworkSettings, NetworkStatus } from '@shared/types'
import { AlertBox, Button, GridRow, GridTable, Input, Modal, NumberField, SaveState, Segmented, SettingCard, SettingRow, Toggle, useAutosavedState, type GridColumn } from '../ui'
import { REMOTE_LEVELS } from '@shared/remote'
import { main } from '../../lib/ipc'
import { copyText, failed } from '../../lib/notify'
import { formatRelative } from '../../lib/format'
import { PairDevice } from './PairDevice'

const COLUMNS: GridColumn[] = [
  { label: 'Device', width: 'minmax(9rem, 1fr)' },
  { label: 'Last seen', width: '7rem', right: true },
  { label: 'Requests', width: '5.5rem', right: true },
  { label: 'Wrong passwords', width: '8rem', right: true },
  { label: 'Model', width: 'minmax(8rem, 1fr)' },
  { label: 'Locked', width: '9rem', right: true }
]

const DEVICE_COLUMNS: GridColumn[] = [
  { label: 'Device', width: 'minmax(9rem, 1fr)' },
  { label: 'Paired', width: '7rem', right: true },
  { label: 'Last seen', width: '7rem', right: true },
  { label: 'Address', width: 'minmax(7rem, 1fr)' },
  { label: 'Allowed to', width: '13rem' },
  { label: 'Connected', width: '10rem', right: true }
]

export function NetworkPanel({ network }: { network: NetworkStatus }) {
  const settings = useAutosavedState<NetworkSettings | null>(null, (s) => main('network.set', { settings: s! }).then(() => undefined), { when: (s) => s !== null })
  const [password, setPassword] = useState('')
  const [justSet, setJustSet] = useState<string | null>(null)
  const [renewing, setRenewing] = useState(false)
  const [unpairing, setUnpairing] = useState(false)

  useEffect(() => {
    if (!settings.value) settings.reset(network.settings)
  }, [network.settings])

  const s = settings.value ?? network.settings
  const change = (patch: Partial<NetworkSettings>) => settings.set({ ...s, ...patch })
  const turn = (on: boolean) => void main('network.set', { on }).catch(failed('Could not change network access'))
  const suggest = () => void main('network.password.suggest').then(setPassword).catch(failed('Could not make a password'))
  const save = () =>
    void main('network.password.set', { password })
      .then(() => {
        setJustSet(password)
        setPassword('')
      })
      .catch(failed('Could not set the password'))
  const copyCertificate = () =>
    void main('network.certificate.get')
      .then((pem) => {
        if (pem) copyText(pem)
      })
      .catch(failed('Could not read the certificate'))
  const renew = () =>
    void main('network.certificate.renew')
      .then(() => setRenewing(false))
      .catch(failed('Could not make a new certificate'))
  const unlock = (address: string) => void main('network.unlock', { address }).catch(failed('Could not unlock'))
  const revoke = (deviceId: string) => void main('network.revoke', { deviceId }).catch(failed('Could not revoke the device'))
  const setLevel = (deviceId: string, level: DeviceLevelId) => void main('network.deviceLevel', { deviceId, level }).catch(failed('Could not change the device level'))
  const unpairAll = () =>
    void main('network.unpairAll')
      .then(() => setUnpairing(false))
      .catch(failed('Could not unpair the devices'))

  return (
    <SettingCard title="Network access">
      <div className="flex flex-col gap-3 p-3.5">
      <p className="text-[12.5px] text-dim">
        Lets phones paired with the Seven app use Seven over your network. With a password set, other programs can also use your models through an OpenAI-compatible API over HTTPS: llama-server itself stays on this PC; Seven checks the password on every request and passes it on. A program asking for a different model loads it, but only while Seven is not writing.
      </p>
      <SettingRow label="Network access" hint="Stays on or off when Seven restarts. Windows may ask to allow Seven through the firewall the first time.">
        <Toggle checked={network.on} onChange={turn} label={network.on ? 'On' : 'Off'} />
      </SettingRow>
      {network.error && <AlertBox>{network.error}</AlertBox>}
      {network.listening && network.hasPassword && (
        <div className="flex flex-col gap-0.5 font-mono text-[12px] text-white">
          {network.addresses.map((a) => (
            <span key={a}>https://{a}:{network.settings.port}/v1</span>
          ))}
        </div>
      )}
      <SettingRow label="Model API password" hint={`Only for the OpenAI-compatible model API; paired phones don't use it. Programs send it as the API key. Seven keeps only a one-way hash, so copy it before you leave this page. At least ${network.passwordMin} characters.`}>
        <span className="font-mono text-[12px] text-dim">{network.hasPassword ? 'Set, model API on' : 'Not set, model API off'}</span>
      </SettingRow>
      <div className="flex items-center gap-1.5">
        <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Type a password or press Suggest" spellCheck={false} className="h-8 flex-1 font-mono text-[12px]" />
        <Button size="sm" variant="ghost" icon={<Sparkles />} onClick={suggest}>
          Suggest
        </Button>
        <Button size="sm" variant="primary" icon={<KeyRound />} disabled={!password} onClick={save}>
          {network.hasPassword ? 'Change password' : 'Set password'}
        </Button>
      </div>
      {justSet && (
        <div className="flex items-center gap-2 border border-line/50 bg-black/40 px-2 py-1.5">
          <span className="flex-1 break-all font-mono text-[12px] text-white">{justSet}</span>
          <Button size="sm" variant="ghost" icon={<Copy />} onClick={() => void copyText(justSet)}>
            Copy
          </Button>
        </div>
      )}
      <SettingRow label="Port">
        <NumberField value={s.port} min={1} max={65535} step={1} onChange={(v) => v !== undefined && change({ port: v })} className="h-7 w-28 text-[12px]" />
      </SettingRow>
      <SettingRow label="Only my local network" hint="Refuses any device whose address is not a private network address (10.x, 172.16-31.x, 192.168.x, link-local).">
        <Toggle checked={s.privateOnly} onChange={(v) => change({ privateOnly: v })} label={s.privateOnly ? 'On' : 'Off'} />
      </SettingRow>
      <SettingRow label="Wrong passwords before lockout" hint="A device that gets the password wrong this many times in a row is locked out.">
        <NumberField value={s.maxFailures} min={1} max={1000} step={1} onChange={(v) => v !== undefined && change({ maxFailures: v })} className="h-7 w-28 text-[12px]" />
      </SettingRow>
      <SettingRow label="Lockout minutes" hint="How long a locked-out device must wait. You can unlock it below sooner.">
        <NumberField value={s.lockMinutes} min={0} max={525600} step={1} onChange={(v) => v !== undefined && change({ lockMinutes: v })} className="h-7 w-28 text-[12px]" />
      </SettingRow>
      <SettingRow label="Largest request (MB)" hint="Bigger requests are refused, so a device can't fill this PC's memory. Pictures sent to a vision model count toward it.">
        <NumberField value={s.maxRequestMb} min={1} max={4096} step={1} onChange={(v) => v !== undefined && change({ maxRequestMb: v })} className="h-7 w-28 text-[12px]" />
      </SettingRow>
      <SettingRow label="Device check (seconds)" hint="How often Seven checks that a connected device is still reachable.">
        <NumberField value={s.pingSeconds} min={5} max={3600} step={1} onChange={(v) => v !== undefined && change({ pingSeconds: v })} className="h-7 w-28 text-[12px]" />
      </SettingRow>
      <SettingRow label="Idle timeout (minutes)" hint="A device that sends nothing for this long is disconnected. 0 means never.">
        <NumberField value={s.idleMinutes} min={0} max={525600} step={1} onChange={(v) => v !== undefined && change({ idleMinutes: v })} className="h-7 w-28 text-[12px]" />
      </SettingRow>
      <SettingRow label="Largest bridge message (MB)" hint="Bigger messages from a device are refused. Files and pictures will use their own routes, so this stays small.">
        <NumberField value={s.maxMessageMb} min={1} max={256} step={1} onChange={(v) => v !== undefined && change({ maxMessageMb: v })} className="h-7 w-28 text-[12px]" />
      </SettingRow>
      <SettingRow label="Most devices at once" hint="More devices than this are refused until one disconnects.">
        <NumberField value={s.maxClients} min={1} max={100} step={1} onChange={(v) => v !== undefined && change({ maxClients: v })} className="h-7 w-28 text-[12px]" />
      </SettingRow>
      <SettingRow label="Slow device buffer (MB)" hint="When a device falls this far behind, Seven keeps only the latest progress updates for it.">
        <NumberField value={s.bufferSoftMb} min={1} max={256} step={1} onChange={(v) => v !== undefined && change({ bufferSoftMb: v })} className="h-7 w-28 text-[12px]" />
      </SettingRow>
      <SettingRow label="Slow device cut-off (MB)" hint="A device this far behind is disconnected. It reconnects and catches up by itself.">
        <NumberField value={s.bufferHardMb} min={1} max={1024} step={1} onChange={(v) => v !== undefined && change({ bufferHardMb: v })} className="h-7 w-28 text-[12px]" />
      </SettingRow>
      <SettingRow label="Reconnect wait (seconds)" hint="How long a device waits before its first reconnect try. Each later try waits twice as long.">
        <NumberField value={s.reconnectMinSeconds} min={1} max={600} step={1} onChange={(v) => v !== undefined && change({ reconnectMinSeconds: v })} className="h-7 w-28 text-[12px]" />
      </SettingRow>
      <SettingRow label="Longest reconnect wait (seconds)" hint="Reconnect tries never wait longer than this.">
        <NumberField value={s.reconnectMaxSeconds} min={1} max={3600} step={1} onChange={(v) => v !== undefined && change({ reconnectMaxSeconds: v })} className="h-7 w-28 text-[12px]" />
      </SettingRow>
      <SettingRow label="Pairing code lifetime (seconds)" hint="A pairing code older than this stops working.">
        <NumberField value={s.pairCodeSeconds} min={10} max={3600} step={1} onChange={(v) => v !== undefined && change({ pairCodeSeconds: v })} className="h-7 w-28 text-[12px]" />
      </SettingRow>
      <SettingRow label="Pairing code uses" hint="How many devices one code can pair before it stops working.">
        <NumberField value={s.pairCodeUses} min={1} max={10} step={1} onChange={(v) => v !== undefined && change({ pairCodeUses: v })} className="h-7 w-28 text-[12px]" />
      </SettingRow>
      <SettingRow label="Largest file from a device (MB)" hint="A device cannot send a single file bigger than this.">
        <NumberField value={s.maxUploadMb} min={1} max={65536} step={1} onChange={(v) => v !== undefined && change({ maxUploadMb: v })} className="h-7 w-28 text-[12px]" />
      </SettingRow>
      <SettingRow label="Keep sent files (minutes)" hint="Files sent from a device are deleted once Seven has used them; any left over are deleted after this long.">
        <NumberField value={s.uploadKeepMinutes} min={1} max={525600} step={1} onChange={(v) => v !== undefined && change({ uploadKeepMinutes: v })} className="h-7 w-28 text-[12px]" />
      </SettingRow>
      <SettingRow label="Sent files folder" hint="Files sent from a device land in a seven-files folder inside this folder. Empty means Seven's own data folder.">
        <Input value={s.uploadFolder} onChange={(e) => change({ uploadFolder: e.target.value })} placeholder="Seven's data folder" spellCheck={false} className="h-7 w-72 font-mono text-[12px]" />
      </SettingRow>
      <SettingRow label="Announce on the network" hint="Seven tells your local network where it is (mDNS), so paired devices find it without typing an address, even after this PC's address changes. The announcement carries no secrets; trust still comes from pairing.">
        <Toggle checked={s.announce} onChange={(v) => change({ announce: v })} label={s.announce ? 'On' : 'Off'} />
      </SettingRow>
      <SettingRow label="Announcement name" hint="How this PC shows up on a device.">
        <Input value={s.announceName} onChange={(e) => change({ announceName: e.target.value })} placeholder="This PC's name" spellCheck={false} className="h-7 w-72 font-mono text-[12px]" />
      </SettingRow>
      <SettingRow label="Announcement type" hint="The DNS-SD service type devices look for. Leave it alone unless it clashes with something else on your network.">
        <Input value={s.announceType} onChange={(e) => change({ announceType: e.target.value })} spellCheck={false} className="h-7 w-28 font-mono text-[12px]" />
      </SettingRow>
      <SaveState status={settings.status} error={settings.error} />
      <SettingRow label="Certificate" hint="Seven made this certificate itself. A device must trust it before it connects: copy it to that device and install it, or check this fingerprint when the device asks.">
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" icon={<Copy />} disabled={!network.fingerprint} onClick={copyCertificate}>
            Copy certificate
          </Button>
          <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={() => setRenewing(true)}>
            Make new
          </Button>
        </div>
      </SettingRow>
      {network.fingerprint && <span className="break-all font-mono text-[11px] text-dim">SHA-256 {network.fingerprint}</span>}
      <Modal
        open={renewing}
        title="Make a new certificate"
        onClose={() => setRenewing(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenewing(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={renew}>
              Make new
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-white/85">Every device that trusts the old certificate stops connecting until you give it the new one.</p>
      </Modal>
      <div className="border border-line/40 bg-bg">
        <GridTable columns={COLUMNS} empty={network.clients.length ? false : 'No device has connected since Seven started.'}>
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
      </div>
      <SettingRow label="Paired devices" hint="Devices that can use the whole of Seven remotely. Pairing a device needs network access to be on.">
        <PairDevice network={network} />
      </SettingRow>
      <div className="border border-line/40 bg-bg">
        <GridTable columns={DEVICE_COLUMNS} empty={network.devices.length ? false : 'No device is paired.'}>
          {network.devices.map((d) => (
            <GridRow key={d.id}>
              <span className="truncate text-[12px] text-white">{d.name}</span>
              <span className="text-right font-mono text-[11px] text-faint">{formatRelative(d.pairedAt)}</span>
              <span className="text-right font-mono text-[11px] text-faint">{formatRelative(d.lastSeen)}</span>
              <span className="truncate font-mono text-[12px] text-white/85">{d.address ?? '—'}</span>
              <Segmented value={d.level} options={REMOTE_LEVELS.map((l) => ({ value: l.id, label: l.label, hint: l.description }))} onChange={(level) => setLevel(d.id, level)} />
              <span className="flex items-center justify-end gap-1.5">
                {d.connected && <span className="font-mono text-[11px] text-white/85">Now</span>}
                <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => revoke(d.id)}>
                  Revoke
                </Button>
              </span>
            </GridRow>
          ))}
        </GridTable>
      </div>
      {network.devices.length > 0 && (
        <SettingRow label="Start fresh" hint="Gives Seven a new identity. Every paired device is disconnected and has to be paired again.">
          <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={() => setUnpairing(true)}>
            Unpair all devices
          </Button>
        </SettingRow>
      )}
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
        <p className="text-[13px] text-white/85">Every paired device is disconnected at once and loses access until you pair it again.</p>
      </Modal>
      </div>
    </SettingCard>
  )
}
