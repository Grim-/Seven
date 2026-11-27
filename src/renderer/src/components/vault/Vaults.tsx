import { useEffect, useState } from 'react'
import { ArrowRightLeft, FolderOpen, FolderPlus, Pencil, Plus, X } from 'lucide-react'
import type { VaultEntry, VaultList } from '@shared/types'
import { Button, Field, Input, Modal, SettingCard } from '../ui'
import { main } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { toast } from '../../store/toasts'
import { useApp } from '../../store/app'
import { cn } from '../../lib/cn'
import { failed } from '../../lib/notify'

export function folderFor(parent: string, name: string, windows: boolean): string {
  const safe = name
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/[. ]+$/, '')
  return `${parent.replace(/[\\/]+$/, '')}${windows ? '\\' : '/'}${safe}`
}

export function NewVaultFields({ name, onName, parent, onParent }: { name: string; onName: (v: string) => void; parent: string | null; onParent: (v: string) => void }) {
  const windows = useApp((s) => s.info?.platform === 'win32')
  const choose = () =>
    void main('dialog.openFolder')
      .then((dir) => dir && onParent(dir))
      .catch(failed('Could not open the folder picker'))
  return (
    <div className="flex flex-col gap-3">
      <Field label="Name">
        <Input autoFocus value={name} onChange={(e) => onName(e.target.value)} placeholder="Work" />
      </Field>
      <Field label="Where" hint={parent && name.trim() ? `Creates ${folderFor(parent, name, windows)}` : 'Pick where its folder goes. It can be on a memory stick.'}>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-ui text-[12px] text-ink" title={parent ?? undefined}>
            {parent ?? 'No place picked'}
          </span>
          <Button size="sm" icon={<FolderOpen />} onClick={choose}>
            Choose…
          </Button>
        </div>
      </Field>
    </div>
  )
}

export function SwitchVaultModal({ vault, onClose }: { vault: { name: string; path: string }; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try {
      await main('vaults.switch', { path: vault.path })
    } catch (err) {
      toast.error('Could not switch', errorText(err))
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      title={`Switch to ${vault.name}?`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<ArrowRightLeft />} disabled={busy} onClick={() => void go()}>
            {busy ? 'Switching…' : 'Switch and restart'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2 text-[13px]">
        <div>Seven closes and opens again with this vault.</div>
        <div className="truncate font-ui text-[12px] text-dim" title={vault.path}>
          {vault.path}
        </div>
        <div className="text-dim">The vault you have open now stays as it is.</div>
      </div>
    </Modal>
  )
}

function Row({ vault, pinned, onList, onSwitch }: { vault: VaultEntry; pinned: boolean; onList: (l: VaultList) => void; onSwitch: () => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  const rename = () => {
    if (editing === null) return
    const name = editing
    setEditing(null)
    if (name.trim() === vault.name) return
    void main('vaults.rename', { path: vault.path, name })
      .then(onList)
      .catch(failed('Could not rename'))
  }
  const remove = () =>
    void main('vaults.remove', { path: vault.path })
      .then((l) => {
        onList(l)
        toast.success('Taken off the list', `${vault.name}: its folder is untouched.`)
      })
      .catch(failed('Could not take it off'))
  return (
    <div className={cn('flex items-center gap-3 border px-3 py-2', vault.current ? 'border-accent/60 bg-accent/5' : 'border-line/50 tone-panel-40')}>
      <div className="min-w-0 flex-1">
        {editing !== null ? (
          <Input
            autoFocus
            value={editing}
            onChange={(e) => setEditing(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') rename()
              if (e.key === 'Escape') setEditing(null)
            }}
            className="h-7 text-[13px]"
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className="truncate text-[13.5px] text-ink">{vault.name}</span>
            {vault.current && <span className="font-label text-[10px] caps-14 text-accent">Open</span>}
            {!vault.exists && <span className="font-label text-[10px] caps-14 text-alert">Folder not found</span>}
          </div>
        )}
        <div className="truncate font-ui text-[11px] text-faint" title={vault.path}>
          {vault.path}
        </div>
      </div>
      {!vault.current && vault.exists && !pinned && (
        <Button size="sm" variant="primary" icon={<ArrowRightLeft />} onClick={onSwitch}>
          Switch
        </Button>
      )}
      <Button size="sm" variant="ghost" icon={<Pencil />} title="Rename" onClick={() => setEditing(vault.name)} />
      {!vault.current && <Button size="sm" variant="ghost" icon={<X />} title="Take off the list (the folder stays)" onClick={remove} />}
    </div>
  )
}

export function VaultsPanel({ className }: { className?: string }) {
  const windows = useApp((s) => s.info?.platform === 'win32')
  const [data, setData] = useState<VaultList | null>(null)
  const [switching, setSwitching] = useState<VaultEntry | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [parent, setParent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void main('vaults.list')
      .then(setData)
      .catch(failed('Could not list vaults'))
  }, [])

  const create = async () => {
    if (!parent || !name.trim()) return
    setBusy(true)
    try {
      setData(await main('vaults.create', { name, path: folderFor(parent, name, windows) }))
      toast.success('Vault made', `${name.trim()} is ready to switch to.`)
      setCreating(false)
      setName('')
      setParent(null)
    } catch (err) {
      toast.error('Could not make the vault', errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const addExisting = async () => {
    try {
      const dir = await main('dialog.openFolder')
      if (!dir) return
      setData(await main('vaults.add', { name: '', path: dir }))
    } catch (err) {
      toast.error('Could not add it', errorText(err))
    }
  }

  const pinned = Boolean(data?.pinnedBy)
  return (
    <SettingCard
      title="Vaults"
      className={className}
      intro="Each vault is a whole Seven of its own in one folder: agents, chats, data, memory, settings and its own passphrase. Work and home, say. Switching restarts Seven."
      actions={
        <>
          <Button size="sm" variant="ghost" icon={<FolderPlus />} onClick={() => void addExisting()}>
            Add existing…
          </Button>
          <Button size="sm" variant="badge" icon={<Plus />} onClick={() => setCreating(true)}>
            New vault…
          </Button>
        </>
      }
    >
      {pinned && <div className="px-3.5 pt-2.5 font-ui text-[11px] text-alert">The data folder is set by {data?.pinnedBy}, so switching is off.</div>}
      <div className="flex flex-col gap-2 p-3">
        {data?.list.map((v) => (
          <Row key={v.path} vault={v} pinned={pinned} onList={setData} onSwitch={() => setSwitching(v)} />
        ))}
      </div>
      {creating && (
        <Modal
          open
          title="New vault"
          onClose={() => setCreating(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button variant="primary" icon={<Plus />} disabled={busy || !parent || !name.trim()} onClick={() => void create()}>
                {busy ? 'Making…' : 'Make vault'}
              </Button>
            </>
          }
        >
          <NewVaultFields name={name} onName={setName} parent={parent} onParent={setParent} />
        </Modal>
      )}
      {switching && <SwitchVaultModal vault={switching} onClose={() => setSwitching(null)} />}
    </SettingCard>
  )
}
