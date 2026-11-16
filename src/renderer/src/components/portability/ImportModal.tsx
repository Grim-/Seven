import { useEffect, useMemo, useState } from 'react'
import { Archive, Copy, Eye, EyeOff, FileCode2, Image as ImageIcon, KeyRound, Loader2, Lock, PackageOpen, ShieldAlert, Unlock } from 'lucide-react'
import { showName } from '@shared/ids'
import type { PortableConflictResolution, PortableImportResolution, PortablePeekItem } from '@shared/portability'
import { AlertBox, Button, Input, ListRow, Modal, Segmented, Select, StatusBadge, Textarea, Toggle } from '../ui'
import { AssetMedia } from '../pictures/AssetMedia'
import { engine, main } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { failed } from '../../lib/notify'
import { importToLibrary } from '../../lib/importFiles'
import { openEntry, showInData, useLibrary } from '../../lib/library'
import { placePictures } from '../../lib/dropFiles'
import { useObjectUrl } from '../../lib/useObjectUrl'
import { toast } from '../../store/toasts'
import { useVault } from '../../store/vault'
import { nextPortableArrival, updatePortableArrival, type PortableArrival } from './portabilityStore'

function sourceFileName(arrival: PortableArrival): string {
  const src = arrival.peek.source
  if ('path' in src) {
    const parts = src.path.split(/[\\/]/)
    return parts[parts.length - 1] || src.path
  }
  if ('text' in src && src.name) return src.name
  return 'Seven export'
}

function containerBadge(container: PortableArrival['peek']['container']): string {
  if (container === 'card') return 'Card PNG'
  if (container === 'bundle') return 'Bundle (.sevenpack)'
  if (container === 'raw-json') return 'Raw JSON'
  if (container === 'text') return 'Text'
  return 'JSON package'
}

function itemOptions(item: PortablePeekItem): { value: PortableConflictResolution; label: string }[] {
  const opts: { value: PortableConflictResolution; label: string }[] = [{ value: 'copy', label: 'Copy' }]
  if (item.exists) opts.push({ value: 'replace', label: 'Replace' })
  opts.push({ value: 'skip', label: 'Skip' })
  return opts
}

function buildInitialResolutions(items: PortablePeekItem[]): Record<number, PortableConflictResolution> {
  const map: Record<number, PortableConflictResolution> = {}
  for (const item of items) {
    map[item.index] = !item.importable || item.missingModule ? 'skip' : item.resolution
  }
  return map
}

export function ImportModal({ arrival }: { arrival: PortableArrival }) {
  const { peek, dropped, ask, targetKind } = arrival
  const vault = useVault((s) => s.status)
  const unlockVault = useVault((s) => s.unlock)
  const { sections } = useLibrary('', 0)
  const importableSections = useMemo(() => (sections ?? []).filter((s) => s.importable), [sections])

  const previewUrl = useObjectUrl(dropped?.file ?? null)
  const [resolutions, setResolutions] = useState<Record<number, PortableConflictResolution>>(() => buildInitialResolutions(peek.items))
  const [keepPicture, setKeepPicture] = useState(true)
  const [password, setPassword] = useState('')
  const [unlockedPassword, setUnlockedPassword] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [vaultPassphrase, setVaultPassphrase] = useState('')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [chosenTargetKind, setChosenTargetKind] = useState<string>(targetKind ?? '')
  const [busy, setBusy] = useState(false)
  const [shownText, setShownText] = useState<string | null>(null)

  useEffect(() => {
    setResolutions(buildInitialResolutions(peek.items))
  }, [peek.items])

  const savedDate = new Date(peek.savedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  const fromFilesAsset = 'asset' in peek.source
  const canKeepPicture = peek.hasPicture && !fromFilesAsset
  const hasRawJsonFallback = Boolean(peek.error && !peek.locked && (peek.container === 'json' || peek.container === 'raw-json') && importableSections.length > 0)

  const conflicts = useMemo(() => peek.items.filter((i) => i.importable && !i.missingModule && i.exists), [peek.items])
  const selectedImportCount = useMemo(
    () => peek.items.filter((i) => i.importable && !i.missingModule && resolutions[i.index] !== 'skip').length,
    [peek.items, resolutions]
  )

  const rePeek = async (opts: { nextPassword?: string; nextTargetKind?: string | null }) => {
    setBusy(true)
    setUnlockError(null)
    try {
      const [next] = await engine('portability.peek', {
        sources: [peek.source],
        targetKind: opts.nextTargetKind !== undefined ? opts.nextTargetKind : chosenTargetKind || null,
        password: opts.nextPassword ?? unlockedPassword ?? undefined
      })
      if (!next) return
      if (next.locked && next.protection === 'password') {
        setUnlockError('Incorrect password or unreadable payload.')
        return
      }
      if (next.locked && next.protection === 'vault') {
        setUnlockError(next.wrongVaultKey ? 'This export was locked with a different vault key.' : 'Your vault is still locked.')
        updatePortableArrival(arrival.id, { peek: next })
        return
      }
      if (opts.nextPassword) setUnlockedPassword(opts.nextPassword)
      updatePortableArrival(arrival.id, {
        peek: next,
        targetKind: opts.nextTargetKind !== undefined ? opts.nextTargetKind : arrival.targetKind
      })
    } catch (err) {
      setUnlockError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const handlePasswordUnlock = async () => {
    if (!password) return
    await rePeek({ nextPassword: password })
  }

  const handleVaultUnlock = async () => {
    if (!vaultPassphrase) return
    setBusy(true)
    setUnlockError(null)
    try {
      await unlockVault(vaultPassphrase)
      setVaultPassphrase('')
      await rePeek({})
    } catch (err) {
      setUnlockError(errorText(err))
      setBusy(false)
    }
  }

  const handleTargetKindPick = async (kind: string) => {
    setChosenTargetKind(kind)
    if (!kind) return
    await rePeek({ nextTargetKind: kind })
  }

  const applyAllConflicts = (mode: PortableConflictResolution) => {
    setResolutions((prev) => {
      const next = { ...prev }
      for (const item of conflicts) next[item.index] = mode
      return next
    })
  }

  const keepPictureOnly = async () => {
    if (dropped) {
      placePictures([dropped], ask)
      nextPortableArrival()
      return
    }
    setBusy(true)
    try {
      const res = await engine('portability.import', {
        source: peek.source,
        keepPictureOnly: true
      })
      if (res.pictureAssetId) {
        const assetId = res.pictureAssetId
        toast.success('Saved the picture', sourceFileName(arrival), { label: 'Open', onSelect: () => showInData({ kind: 'file', id: assetId }) })
      }
      nextPortableArrival()
    } catch (err) {
      failed('Could not keep the picture')(err)
    } finally {
      setBusy(false)
    }
  }

  const saveDroppedFileInstead = async () => {
    if (!dropped) return
    setBusy(true)
    try {
      const res = await importToLibrary([dropped.path])
      if (res.files.length) {
        toast.success(`Saved ${res.files.length} file`, res.files[0].name, { label: 'Open', onSelect: () => showInData({ kind: 'file', id: res.files[0].id }) })
      }
      nextPortableArrival()
    } catch (err) {
      failed('Could not save to Files')(err)
    } finally {
      setBusy(false)
    }
  }

  const runImport = async () => {
    if (peek.locked) return
    setBusy(true)
    try {
      const resolutionList: PortableImportResolution[] = peek.items.map((item) => ({
        index: item.index,
        mode: !item.importable || item.missingModule ? 'skip' : (resolutions[item.index] ?? item.resolution)
      }))
      const result = await engine('portability.import', {
        source: peek.source,
        targetKind: chosenTargetKind || null,
        password: unlockedPassword ?? undefined,
        resolutions: resolutionList,
        keepPicture: canKeepPicture && !dropped ? keepPicture : false,
        keepPictureOnly: false
      })
      if (dropped && canKeepPicture && keepPicture) {
        placePictures([dropped], ask)
      }
      if (result.text !== null && !result.imported.length) {
        setShownText(result.text)
        setBusy(false)
        return
      }
      if (result.imported.length === 1) {
        const one = result.imported[0]
        const verb = one.mode === 'replace' ? 'Replaced' : 'Imported'
        toast.success(`${verb} ${showName(one.title)}`, `${peek.about?.label ?? one.kind}${result.skipped.length ? ` · ${result.skipped.length} skipped` : ''}`, {
          label: 'Open',
          onSelect: () => openEntry(one.kind, one.id)
        })
      } else if (result.imported.length > 1) {
        const first = result.imported[0]
        toast.success(
          `Imported ${result.imported.length} entries`,
          `${result.imported.slice(0, 3).map((e) => showName(e.title)).join(', ')}${result.imported.length > 3 ? ` +${result.imported.length - 3}` : ''}${result.skipped.length ? ` · ${result.skipped.length} skipped` : ''}`,
          { label: 'Open first', onSelect: () => openEntry(first.kind, first.id) }
        )
      } else {
        toast.info('Nothing imported', result.skipped.length ? `${result.skipped.length} items skipped.` : undefined)
      }
      nextPortableArrival()
    } catch (err) {
      failed('Could not import')(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      width={680}
      title={peek.hasPicture ? 'This picture carries something' : 'Import portable export'}
      onClose={nextPortableArrival}
      footer={
        <>
          {canKeepPicture && (
            <Button variant="ghost" disabled={busy} onClick={() => void keepPictureOnly()}>
              Keep the picture only
            </Button>
          )}
          {dropped && !peek.hasPicture && peek.error && (
            <Button variant="ghost" disabled={busy} onClick={() => void saveDroppedFileInstead()}>
              Save to Files instead
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={nextPortableArrival}>
            Cancel
          </Button>
          {shownText !== null ? (
            <Button
              variant="primary"
              icon={<Copy />}
              onClick={() => void main('clipboard.write', { text: shownText }).then(() => toast.success('Copied'), failed('Could not copy'))}
            >
              Copy text
            </Button>
          ) : peek.locked || peek.error ? null : peek.items.length === 0 && peek.text !== null ? (
            <Button variant="primary" disabled={busy} onClick={() => void runImport()}>
              Show the data
            </Button>
          ) : (
            <Button variant="primary" icon={busy ? <Loader2 className="animate-spin" /> : <PackageOpen />} disabled={busy || selectedImportCount === 0} onClick={() => void runImport()}>
              {selectedImportCount === 0 ? 'Nothing selected' : `Import ${selectedImportCount} ${selectedImportCount === 1 ? 'item' : 'items'}`}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex gap-3 border border-line/60 bg-black/40 p-3">
          <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden border border-line/60 bg-black">
            {peek.hasPicture && dropped ? (
              previewUrl ? <img src={previewUrl} alt={sourceFileName(arrival)} draggable={false} className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-dim" />
            ) : peek.hasPicture && 'asset' in peek.source ? (
              <AssetMedia id={peek.source.asset} className="h-full w-full" />
            ) : peek.container === 'bundle' ? (
              <Archive className="h-7 w-7 text-accent" />
            ) : (
              <FileCode2 className="h-7 w-7 text-teal" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={peek.error ? 'error' : peek.locked ? 'warn' : 'ok'}>{containerBadge(peek.container)}</StatusBadge>
              <span className="truncate font-mono text-[11px] text-dim">{sourceFileName(arrival)}</span>
            </div>
            <div className="truncate text-[14.5px] font-semibold text-white">
              {peek.about ? `${peek.about.label}: ${showName(peek.about.title)}` : peek.protection === 'password' ? 'Password-protected export' : peek.protection === 'vault' ? 'Locked with a vault key' : 'Export package'}
            </div>
            <div className="text-[12px] text-dim">
              {peek.protection === 'password' ? 'password encrypted' : peek.protection === 'vault' ? 'locked with vault key' : 'unencrypted'}
              {' · '}v{peek.version} · saved {savedDate}
              {peek.fileCount > 0 ? ` · ${peek.fileCount} attachment${peek.fileCount === 1 ? '' : 's'}` : ''}
            </div>
          </div>
        </div>

        {peek.error && <AlertBox>{peek.error}</AlertBox>}

        {hasRawJsonFallback && (
          <div className="flex flex-col gap-2 border border-line/60 bg-black/40 p-3">
            <div className="font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] text-accent-soft">Pick a kind for raw JSON</div>
            <Select
              value={chosenTargetKind}
              onChange={(v) => void handleTargetKindPick(v)}
              options={[{ value: '', label: 'Select target kind…' }, ...importableSections.map((s) => ({ value: s.kind, label: s.plural }))]}
            />
          </div>
        )}

        {peek.locked && peek.protection === 'password' && (
          <form
            className="flex flex-col gap-2.5 border border-line/60 bg-black/40 p-3"
            onSubmit={(e) => {
              e.preventDefault()
              void handlePasswordUnlock()
            }}
          >
            <div className="flex items-center gap-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] text-accent-soft">
              <KeyRound className="h-3.5 w-3.5" />
              Enter password to inspect and import
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  autoFocus
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Export password"
                  className="pr-9"
                />
                <button
                  type="button"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="submit" variant="primary" icon={busy ? <Loader2 className="animate-spin" /> : <Unlock />} disabled={busy || !password}>
                Unlock
              </Button>
            </div>
            {unlockError && <AlertBox>{unlockError}</AlertBox>}
          </form>
        )}

        {peek.locked && peek.protection === 'vault' && (
          <div className="flex flex-col gap-2.5 border border-line/60 bg-black/40 p-3">
            {peek.wrongVaultKey ? (
              <AlertBox className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>This export was sealed with a different Seven vault key and cannot be decrypted here.</span>
              </AlertBox>
            ) : !vault.configured ? (
              <AlertBox>This export requires your local Seven vault key, but no vault is configured on this device.</AlertBox>
            ) : (
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void handleVaultUnlock()
                }}
              >
                <div className="flex items-center gap-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] text-accent-soft">
                  <Lock className="h-3.5 w-3.5" />
                  Unlock your vault to inspect and import
                </div>
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    type="password"
                    value={vaultPassphrase}
                    onChange={(e) => setVaultPassphrase(e.target.value)}
                    placeholder="Vault passphrase"
                  />
                  <Button type="submit" variant="primary" disabled={busy || !vaultPassphrase}>
                    Unlock vault
                  </Button>
                </div>
                {unlockError && <AlertBox>{unlockError}</AlertBox>}
              </form>
            )}
          </div>
        )}

        {!peek.locked && !peek.error && peek.items.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] text-accent-soft">
                Contents ({peek.items.length} {peek.items.length === 1 ? 'item' : 'items'})
              </span>
              {conflicts.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-dim">Conflicts ({conflicts.length}):</span>
                  <Button size="sm" variant="ghost" onClick={() => applyAllConflicts('copy')}>
                    Copy all
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => applyAllConflicts('replace')}>
                    Replace all
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => applyAllConflicts('skip')}>
                    Skip all
                  </Button>
                </div>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto border border-line/60 bg-black/30 divide-y divide-line/30">
              {peek.items.map((item) => {
                const blocked = !item.importable || item.missingModule
                const currentMode = resolutions[item.index] ?? item.resolution
                const subtitleParts = [item.label]
                if (item.isDependency) subtitleParts.push('linked dependency')
                if (item.exists && !blocked) subtitleParts.push('already exists in library')
                if (blocked) subtitleParts.push(item.missingModule ? 'module unavailable' : 'read-only kind')

                return (
                  <ListRow
                    key={`${item.index}:${item.kind ?? 'unknown'}:${item.id}`}
                    active={!blocked && currentMode !== 'skip'}
                    onClick={() => {}}
                    title={showName(item.title)}
                    subtitle={subtitleParts.join(' · ')}
                  >
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {blocked ? (
                        <StatusBadge tone="warn">{item.missingModule ? 'Missing module' : 'Cannot import'}</StatusBadge>
                      ) : (
                        <Segmented
                          value={currentMode}
                          options={itemOptions(item)}
                          onChange={(nextMode) => setResolutions((prev) => ({ ...prev, [item.index]: nextMode }))}
                        />
                      )}
                    </div>
                  </ListRow>
                )
              })}
            </div>
          </div>
        )}

        {canKeepPicture && !peek.locked && shownText === null && (
          <div className="pt-1">
            <Toggle checked={keepPicture} onChange={setKeepPicture} label="Keep the picture in Files too" />
          </div>
        )}

        {shownText !== null && <Textarea value={shownText} readOnly rows={8} mono className="mt-1" />}
      </div>
    </Modal>
  )
}
