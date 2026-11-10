import { useEffect, useState } from 'react'
import { Copy, KeyRound, RefreshCw, Sparkles, Unlock } from 'lucide-react'
import type { NetworkSettings, NetworkStatus } from '@shared/types'
import { AlertBox, Button, GridRow, GridTable, Input, Modal, NumberField, SaveState, SettingCard, SettingRow, Toggle, useAutosavedState, type GridColumn } from '../ui'
import { engine } from '../../lib/ipc'
import { copyText, failed } from '../../lib/notify'
import { formatRelative } from '../../lib/format'

const COLUMNS: GridColumn[] = [
  { label: 'Device', width: 'minmax(9rem, 1fr)' },
  { label: 'Last seen', width: '7rem', right: true },
  { label: 'Requests', width: '5.5rem', right: true },
  { label: 'Wrong passwords', width: '8rem', right: true },
  { label: 'Model', width: 'minmax(8rem, 1fr)' },
  { label: 'Locked', width: '9rem', right: true }
]

export function NetworkPanel({ network }: { network: NetworkStatus }) {
  const settings = useAutosavedState<NetworkSettings | null>(null, (s) => engine('network.set', { settings: s! }).then(() => undefined), { when: (s) => s !== null })
  const [password, setPassword] = useState('')
  const [justSet, setJustSet] = useState<string | null>(null)
  const [renewing, setRenewing] = useState(false)

  useEffect(() => {
    if (!settings.value) settings.reset(network.settings)
  }, [network.settings])

  const s = settings.value ?? network.settings
  const change = (patch: Partial<NetworkSettings>) => settings.set({ ...s, ...patch })
  const turn = (on: boolean) => void engine('network.set', { on }).catch(failed('Could not change network access'))
  const suggest = () => void engine('network.password.suggest').then(setPassword).catch(failed('Could not make a password'))
  const save = () =>
    void engine('network.password.set', { password })
      .then(() => {
        setJustSet(password)
        setPassword('')
      })
      .catch(failed('Could not set the password'))
  const copyCertificate = () =>
    void engine('network.certificate.get')
      .then((pem) => {
        if (pem) copyText(pem)
      })
      .catch(failed('Could not read the certificate'))
  const renew = () =>
    void engine('network.certificate.renew')
      .then(() => setRenewing(false))
      .catch(failed('Could not make a new certificate'))
  const unlock = (address: string) => void engine('network.unlock', { address }).catch(failed('Could not unlock'))

  return (
    <SettingCard title="Network access">
      <div className="flex flex-col gap-3 p-3.5">
      <p className="text-[12.5px] text-dim">
        Lets other devices on your network use your models through an OpenAI-compatible API over HTTPS. llama-server itself stays on this PC; Seven checks the password on every request and passes it on. A device asking for a different model loads it, but only while Seven is not writing.
      </p>
      <SettingRow label="Network access" hint="Stays on or off when Seven restarts. Windows may ask to allow Seven through the firewall the first time.">
        <Toggle checked={network.on} onChange={turn} label={network.on ? 'On' : 'Off'} />
      </SettingRow>
      {network.error && <AlertBox>{network.error}</AlertBox>}
      {network.listening && (
        <div className="flex flex-col gap-0.5 font-mono text-[12px] text-white">
          {network.addresses.map((a) => (
            <span key={a}>https://{a}:{network.settings.port}/v1</span>
          ))}
        </div>
      )}
      <SettingRow label="Password" hint={`Devices send it as the API key. Seven keeps only a one-way hash, so copy it before you leave this page. At least ${network.passwordMin} characters.`}>
        <span className="font-mono text-[12px] text-dim">{network.hasPassword ? 'Set' : 'Not set'}</span>
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
      </div>
    </SettingCard>
  )
}
