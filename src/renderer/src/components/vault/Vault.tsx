import { useState, type ReactNode } from 'react'
import { Lock, LockOpen, ShieldCheck } from 'lucide-react'
import type { UiRequestState, UnlockProps } from '@shared/types'
import { Button, Input, Modal, SecretField, SettingCard, SettingRow, Toggle } from '../ui'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { useVault } from '../../store/vault'
import { toast } from '../../store/toasts'
import { useAgents } from '../../store/agents'
import { useTools } from '../../store/tools'
import { failed } from '../../lib/notify'

export function PassphraseForm({ onDone, extra }: { onDone?: () => void; extra?: ReactNode }) {
  const unlock = useVault((s) => s.unlock)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    if (!value || busy) return
    setBusy(true)
    setError(null)
    try {
      await unlock(value)
      setValue('')
      onDone?.()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          type="password"
          autoFocus
          autoComplete="off"
          placeholder="Passphrase"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          className="flex-1"
        />
        <Button variant="primary" icon={<LockOpen />} disabled={!value || busy} onClick={() => void submit()}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </Button>
        {extra}
      </div>
      {error && <div className="font-ui text-[11px] text-alert">{error}</div>}
    </div>
  )
}

export function UnlockDialog() {
  const asking = useVault((s) => s.asking)
  const dismiss = useVault((s) => s.dismiss)
  if (!asking) return null
  return (
    <Modal open title="Unlock the vault" onClose={dismiss}>
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-dim">Your chats, data and agent memory are encrypted. Enter your passphrase to open them until Seven closes or you lock it.</p>
        <PassphraseForm />
      </div>
    </Modal>
  )
}

export function LockedState({ what }: { what: string }) {
  const ask = useVault((s) => s.ask)
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 p-6 text-center">
      <Lock className="h-6 w-6 text-accent" />
      <div className="font-label text-[11px] caps-20 text-accent">Vault locked</div>
      <div className="max-w-sm text-[13px] text-dim">{what} are in the vault. Unlock it to see them.</div>
      <Button variant="primary" icon={<LockOpen />} onClick={ask}>
        Unlock
      </Button>
    </div>
  )
}

export function useLocked(): boolean {
  return useVault((s) => s.status.configured && !s.status.unlocked)
}

export function LockButton({ compact }: { compact?: boolean }) {
  const status = useVault((s) => s.status)
  const lock = useVault((s) => s.lock)
  const ask = useVault((s) => s.ask)
  if (!status.configured) return null
  const onClick = () => (status.unlocked ? void lock().catch(failed('Could not lock')) : ask())
  if (compact) {
    return (
      <button
        title={status.unlocked ? 'Lock the vault' : 'Unlock the vault'}
        onClick={onClick}
        className="flex h-full w-9 items-center justify-center text-dim hover:bg-ink/5 hover:text-accent [&>svg]:h-4 [&>svg]:w-4"
      >
        {status.unlocked ? <LockOpen /> : <Lock />}
      </button>
    )
  }
  return (
    <Button variant="badge" size="lg" icon={status.unlocked ? <LockOpen /> : <Lock />} onClick={onClick}>
      {status.unlocked ? 'Lock' : 'Unlock'}
    </Button>
  )
}

export function UnlockCard({ ui }: { ui: UiRequestState }) {
  const props = ui.props as UnlockProps
  const unlocked = useVault((s) => s.status.unlocked)
  const open = ui.status === 'pending'
  const decline = () => void engine('ui.respond', { id: ui.id, value: false }).catch(failed('Answer not delivered'))
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 text-[14px] leading-snug text-ink">
        <Lock className="h-4 w-4 text-accent" />
        {props.reason} The vault is locked.
      </div>
      {open && !unlocked ? (
        <PassphraseForm
          extra={
            <Button variant="secondary" onClick={decline}>
              Not now
            </Button>
          }
        />
      ) : (
        <div className="font-label text-[10.5px] caps-14 text-faint">
          {ui.status === 'answered' ? (ui.answer === true ? 'Unlocked' : 'Left locked') : ui.status === 'pending' ? 'Unlocked' : ui.status}
        </div>
      )}
    </div>
  )
}

function KeyRow({ moduleId, moduleName, name, label, description, set }: { moduleId: string; moduleName: string; name: string; label: string; description?: string; set: boolean }) {
  const save = (next: string | null) =>
    engine('tools.settings', { id: moduleId, values: { [name]: next } })
      .then(() => toast.success(next ? 'Key saved' : 'Key removed', `${moduleName}: ${label}`))
      .catch(failed('Could not save the key'))
  return (
    <div className="flex items-center gap-2 border-b border-line/30 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] text-ink/90">
          {moduleName} · {label}
        </div>
        <div className="truncate text-[11px] text-faint">{set ? 'Saved in the vault' : (description ?? 'Not set')}</div>
      </div>
      <SecretField set={set} onSave={save} />
    </div>
  )
}

function KeysField() {
  const modules = useTools((s) => s.list)
  const keys = modules.flatMap((m) => m.settings.filter((st) => st.secret).map((st) => ({ moduleId: m.id, moduleName: m.name, name: st.name, label: st.label, description: st.description, set: Boolean(m.values[st.name]) })))
  return (
    <SettingRow wide label="Keys" hint="API keys and tokens add-ons ask for. Encrypted in the vault, never shown again. Add-ons ask for them as secret settings.">
      {keys.length ? (
        <div className="flex w-full flex-col">
          {keys.map((k) => (
            <KeyRow key={`${k.moduleId}.${k.name}`} {...k} />
          ))}
        </div>
      ) : (
        <div className="text-[12px] text-faint">No add-on needs a key.</div>
      )}
    </SettingRow>
  )
}

export function VaultPanel({ className }: { className?: string }) {
  const status = useVault((s) => s.status)
  const setup = useVault((s) => s.setup)
  const lock = useVault((s) => s.lock)
  const ask = useVault((s) => s.ask)
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mismatch = second.length > 0 && first !== second
  const ready = first.length >= 8 && first === second && understood && !busy
  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      await setup(first)
      setFirst('')
      setSecond('')
      toast.info('Vault set up', 'Everything personal in Seven is now encrypted.')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <SettingCard
      title="Vault"
      className={className}
      intro={
        status.configured ? (
          <>
            Chats, data, boards, attached files, memory and module data are encrypted on disk. It is <span className="text-ink">{status.unlocked ? 'unlocked' : 'locked'}</span> and locks again when Seven closes.
          </>
        ) : (
          'Encrypt everything personal in Seven (chats, data, boards, attached files, memory, module data) with a passphrase. Seven can still save new things while locked; reading them needs the passphrase. Settings, agents and model lists stay readable.'
        )
      }
      actions={
        status.configured &&
        (status.unlocked ? (
          <Button size="sm" icon={<Lock />} onClick={() => void lock()}>
            Lock now
          </Button>
        ) : (
          <Button size="sm" variant="primary" icon={<LockOpen />} onClick={ask}>
            Unlock
          </Button>
        ))
      }
    >
      {!status.configured && (
        <>
          <SettingRow label="Passphrase" hint="At least 8 characters.">
            <Input type="password" autoComplete="new-password" value={first} onChange={(e) => setFirst(e.target.value)} className="w-64" />
          </SettingRow>
          <SettingRow label="Again" error={mismatch ? 'These do not match.' : null}>
            <Input type="password" autoComplete="new-password" value={second} onChange={(e) => setSecond(e.target.value)} className="w-64" />
          </SettingRow>
          <SettingRow label="No recovery" error={error}>
            <Toggle checked={understood} onChange={setUnderstood} label="I understand: if I forget this passphrase, the data is gone." />
          </SettingRow>
          <SettingRow label="Set up">
            <Button variant="primary" icon={<ShieldCheck />} disabled={!ready} onClick={() => void create()}>
              {busy ? 'Encrypting…' : 'Set up vault'}
            </Button>
          </SettingRow>
        </>
      )}
      {status.configured && status.unlocked && <KeysField />}
    </SettingCard>
  )
}

export function VaultVeil({ agentId }: { agentId: string | null }) {
  const locked = useLocked()
  const known = useAgents((s) => (agentId ? s.list.some((a) => a.id === agentId) : true))
  const ask = useVault((s) => s.ask)
  if (!locked || !agentId || known) return null
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-scrim/40 backdrop-blur-[calc(var(--panel-blur)*3)]">
      <Lock className="h-6 w-6 text-accent" />
      <div className="font-label text-[11px] caps-18 text-ink">This chat's agent is in the vault</div>
      <Button variant="primary" icon={<LockOpen />} onClick={ask}>
        Unlock
      </Button>
    </div>
  )
}
