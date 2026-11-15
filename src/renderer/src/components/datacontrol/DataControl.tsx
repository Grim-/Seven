import { useEffect, useState } from 'react'
import { ArchiveRestore, Download, FolderOutput, Trash2 } from 'lucide-react'
import { Button, Input, Modal, Select, SettingCard, SettingRow, Toggle } from '../ui'
import { exportToFolder, type ExportTarget } from '../../lib/exporting'
import { engine, main } from '../../lib/ipc'
import { errorText, formatBytes } from '../../lib/format'
import { toast } from '../../store/toasts'
import { useVault } from '../../store/vault'
import { useApp } from '../../store/app'
import { NewVaultFields, SwitchVaultModal, folderFor } from '../vault/Vaults'
import { noteFailure } from '../../store/problems'

function FolderExport() {
  const [kinds, setKinds] = useState<{ kind: string; label: string }[]>([])
  const [what, setWhat] = useState('kind:page')
  const [tag, setTag] = useState('')
  const [target, setTarget] = useState<ExportTarget>('obsidian')
  useEffect(() => {
    void engine('library.kinds')
      .then((list) => setKinds(list.map((k) => ({ kind: k.kind, label: k.label }))))
      .catch(noteFailure('library', 'Could not load the kinds'))
  }, [])
  const byTag = what === 'tag'
  const run = () => exportToFolder(byTag ? { tag: tag.trim() } : { kind: what.slice(5) }, target)
  return (
    <SettingRow wide label="Export to a folder" hint="Normal files you can use anywhere: one per entry, pictures and files alongside. Obsidian gets [[links]] and frontmatter; plain markdown gets relative links. Inside Seven nothing changes.">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={what} options={[...kinds.map((k) => ({ value: `kind:${k.kind}`, label: `All: ${k.label}` })), { value: 'tag', label: 'Everything tagged…' }]} onChange={setWhat} className="w-56" />
        {byTag && <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="tag" className="w-36" />}
        <Select
          value={target}
          options={[
            { value: 'obsidian', label: 'For Obsidian' },
            { value: 'markdown', label: 'Plain markdown' }
          ]}
          onChange={(v) => setTarget(v as ExportTarget)}
          className="w-44"
        />
        <Button icon={<FolderOutput />} disabled={byTag && !tag.trim()} onClick={run}>
          Export…
        </Button>
      </div>
    </SettingRow>
  )
}

export function DataControlPanel({ className }: { className?: string }) {
  const vault = useVault((s) => s.status)
  const [busy, setBusy] = useState<string | null>(null)
  const [restore, setRestore] = useState<{ path: string; createdAt: number; encrypted: boolean } | null>(null)
  const [clearing, setClearing] = useState(false)
  const [keep, setKeep] = useState(true)
  const windows = useApp((s) => s.info?.platform === 'win32')
  const [name, setName] = useState('')
  const [parent, setParent] = useState<string | null>(null)
  const [restored, setRestored] = useState<{ name: string; path: string } | null>(null)

  const backup = async () => {
    setBusy('backup')
    try {
      const result = await main('data.backup')
      if (result) toast.success('Backup saved', `${result.files} files, ${formatBytes(result.bytes)}: ${result.path}`)
    } catch (err) {
      toast.error('Backup failed', errorText(err))
    } finally {
      setBusy(null)
    }
  }

  const pick = async () => {
    try {
      const found = await main('data.pickBackup')
      if (found) {
        setRestore(found)
        setName(`Restored ${new Date(found.createdAt).toISOString().slice(0, 10)}`)
        setParent(null)
      }
    } catch (err) {
      toast.error('Could not read that file', errorText(err))
    }
  }

  const runRestore = async () => {
    if (!restore || !parent || !name.trim()) return
    const target = folderFor(parent, name, windows)
    setBusy('restore')
    try {
      await main('vaults.restore', { source: restore.path, name, path: target })
      setRestore(null)
      setRestored({ name: name.trim(), path: target })
    } catch (err) {
      toast.error('Restore failed', errorText(err))
    } finally {
      setBusy(null)
    }
  }

  const clear = async () => {
    setBusy('clear')
    try {
      await main('data.clearAll', { keepSettings: keep })
    } catch (err) {
      toast.error('Clear failed', errorText(err))
      setBusy(null)
    }
  }

  return (
    <SettingCard title="Backup and restore" className={className}>
      <SettingRow
        label="Back up"
        hint={
          vault.configured
            ? 'One file with everything in Seven. It stays encrypted with your vault passphrase, so restoring it needs that passphrase.'
            : 'One file with everything in Seven. Your vault is not set up, so this backup is not encrypted.'
        }
      >
        <div>
          <Button variant="primary" icon={<Download />} disabled={busy !== null} onClick={() => void backup()}>
            {busy === 'backup' ? 'Saving…' : 'Save a backup…'}
          </Button>
        </div>
      </SettingRow>
      <FolderExport />
      <SettingRow label="Restore" hint="Makes a new vault from a backup, in a folder you pick. The vault you have open now is not touched.">
        <div>
          <Button icon={<ArchiveRestore />} disabled={busy !== null} onClick={() => void pick()}>
            Restore from a backup…
          </Button>
        </div>
      </SettingRow>
      <SettingRow label="Clear everything" hint="Deletes every chat, entry, file, memory and agent, then restarts. This can't be undone; save a backup first if you might want it back. To clear one kind, use Kinds.">
        <div>
          <Button variant="danger" icon={<Trash2 />} disabled={busy !== null} onClick={() => setClearing(true)}>
            Clear everything…
          </Button>
        </div>
      </SettingRow>
      {restore && (
        <Modal
          open
          title="Restore this backup"
          onClose={() => setRestore(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRestore(null)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={busy !== null || !parent || !name.trim()} onClick={() => void runRestore()}>
                {busy === 'restore' ? 'Restoring…' : 'Restore as a new vault'}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-[13px]">
            <div className="flex flex-col gap-1">
              <div>Made {new Date(restore.createdAt).toLocaleString()}.</div>
              <div className="text-dim">{restore.encrypted ? 'It is encrypted: unlock it with the passphrase it was made with.' : 'It is not encrypted.'}</div>
            </div>
            <NewVaultFields name={name} onName={setName} parent={parent} onParent={setParent} />
          </div>
        </Modal>
      )}
      {restored && <SwitchVaultModal vault={restored} onClose={() => setRestored(null)} />}
      {clearing && (
        <Modal
          open
          title="Clear everything?"
          onClose={() => setClearing(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setClearing(false)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={busy !== null} onClick={() => void clear()}>
                {busy === 'clear' ? 'Clearing…' : 'Delete it all and restart'}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-[13px]">
            <div>Every chat, entry, file, memory, agent and the vault are deleted. This can't be undone.</div>
            <Toggle checked={keep} onChange={setKeep} label="Keep my settings and model list" />
          </div>
        </Modal>
      )}
    </SettingCard>
  )
}
