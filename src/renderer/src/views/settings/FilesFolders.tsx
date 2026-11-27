import { useEffect, useState } from 'react'
import { FolderOpen, RotateCcw } from 'lucide-react'
import { DEFAULT_PORTABILITY_PREFS } from '@shared/portability'
import type { SaveFolderRow } from '@shared/saveFolders'
import { Button, Input, PathRow, SaveState, Segmented, SettingCard, SettingRow, Toggle, useDraft } from '../../components/ui'
import { engine, main } from '../../lib/ipc'
import { useApp } from '../../store/app'
import { failed } from '../../lib/notify'
import { FolderInput } from '../../components/files/FolderInput'
import { ToolFolders } from '../../components/tools/ToolFolders'
import { ModelFolders } from '../ModelFolders'
import { LinkedFolders } from '../../components/settings/LinkedFolders'

function DroppedPictures() {
  const prefs = useApp((s) => s.settings?.droppedPictures ?? null)
  const updateSettings = useApp((s) => s.updateSettings)
  const folder = useDraft(prefs?.folder ?? '', (f) => updateSettings({ droppedPictures: { ask: false, folder: f.trim() } }))
  if (!prefs) return null
  return (
    <SettingCard title="Dropped pictures">
      <SettingRow label="When a picture is dropped" hint="Pictures dropped on the window. Hold Shift while dropping to always ask.">
        <Segmented
          value={prefs.ask ? 'ask' : 'folder'}
          options={[
            { value: 'ask', label: 'Ask every time' },
            { value: 'folder', label: 'Put them in a folder' }
          ]}
          onChange={(v) => void updateSettings({ droppedPictures: { ...prefs, ask: v === 'ask' } })}
        />
      </SettingRow>
      {!prefs.ask && (
        <SettingRow label="Folder" hint="Made if it doesn't exist. Leave it empty for the top level." aside={<SaveState status={folder.status} error={folder.error} />}>
          <div className="w-72">
            <FolderInput value={folder.draft} onChange={folder.change} />
          </div>
        </SettingRow>
      )}
    </SettingCard>
  )
}

function ExportImportPrefs() {
  const prefs = useApp((s) => s.settings?.portability ?? DEFAULT_PORTABILITY_PREFS)
  const updateSettings = useApp((s) => s.updateSettings)
  const saveNumber = (key: 'warnJsonMb' | 'warnCardMb' | 'maxUnpackMb' | 'maxPictureSide', raw: string) => {
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return
    void updateSettings({ portability: { ...prefs, [key]: n } })
  }
  return (
    <SettingCard title="Export & import" intro="Size thresholds used for warnings when packing large entries, and the limit enforced when unpacking bundles.">
      <SettingRow label="Warn on large JSON exports (MB)" hint="Shows a warning and recommends Bundle (.sevenpack) above this size.">
        <Input
          type="number"
          min={1}
          max={500}
          value={prefs.warnJsonMb}
          onChange={(e) => saveNumber('warnJsonMb', e.target.value)}
          className="w-24 font-ui text-[12px]"
        />
      </SettingRow>
      <SettingRow label="Warn on large PNG card exports (MB)" hint="PNG cards embed compressed payloads; large worlds belong in a bundle.">
        <Input
          type="number"
          min={1}
          max={500}
          value={prefs.warnCardMb}
          onChange={(e) => saveNumber('warnCardMb', e.target.value)}
          className="w-24 font-ui text-[12px]"
        />
      </SettingRow>
      <SettingRow label="Maximum unpacked size (MB)" hint="The most an import can unpack: a .sevenpack, a card, or a .json with the files beside it.">
        <Input
          type="number"
          min={10}
          max={4096}
          value={prefs.maxUnpackMb}
          onChange={(e) => saveNumber('maxUnpackMb', e.target.value)}
          className="w-24 font-ui text-[12px]"
        />
      </SettingRow>
      <SettingRow label="Largest theme picture (px)" hint="Theme pictures wider or taller than this are left out when the theme is saved or imported.">
        <Input
          type="number"
          min={256}
          max={32768}
          value={prefs.maxPictureSide}
          onChange={(e) => saveNumber('maxPictureSide', e.target.value)}
          className="w-24 font-ui text-[12px]"
        />
      </SettingRow>
      <SettingRow label="Include linked dependencies by default" hint="Automatically pack referenced themes, game classes, traits, abilities, and maps.">
        <Toggle
          checked={prefs.includeDependenciesByDefault}
          onChange={(v) => void updateSettings({ portability: { ...prefs, includeDependenciesByDefault: v } })}
        />
      </SettingRow>
    </SettingCard>
  )
}

function PlaceSetting({ row, onReset }: { row: SaveFolderRow; onReset: () => void }) {
  const [ask, setAsk] = useState(row.ask)
  const draft = useDraft(row.folder ?? '', (folder) => engine('saveFolders.set', { target: row.target, place: { folder, ask } }))
  const changeAsk = (next: boolean) => {
    setAsk(next)
    void engine('saveFolders.set', { target: row.target, place: { folder: draft.draft === '' && row.folder === null ? null : draft.draft, ask: next } }).catch(failed('Could not save'))
  }
  const reset = () => void engine('saveFolders.set', { target: row.target, place: null }).then(onReset, failed('Could not reset'))
  return (
    <SettingRow label={row.label} hint={`Default: ${row.home || 'top level'}`} aside={<SaveState status={draft.status} error={draft.error} />}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-72">
          <FolderInput value={draft.draft} onChange={draft.change} placeholder={row.home ?? 'top level'} />
        </div>
        {row.asks && <Toggle checked={ask} onChange={changeAsk} label="Ask" />}
        <Button size="sm" variant="ghost" icon={<RotateCcw />} disabled={row.folder === null && ask === row.asks} onClick={reset}>
          Reset
        </Button>
      </div>
    </SettingRow>
  )
}

function Places() {
  const [rows, setRows] = useState<SaveFolderRow[]>([])
  const [version, setVersion] = useState(0)
  useEffect(() => {
    void engine('saveFolders.list')
      .then(setRows)
      .catch(failed('Could not load where things go'))
  }, [version])
  if (!rows.length) return null
  return (
    <SettingCard title="Where things go" intro="Where new entries, imports and files made by tools land when you don't pick a folder. Ask shows the folder choice when you create one yourself.">
      {rows.map((row) => (
        <PlaceSetting key={`${row.target}:${version}`} row={row} onReset={() => setVersion((v) => v + 1)} />
      ))}
    </SettingCard>
  )
}

export function FilesFolders() {
  const info = useApp((s) => s.info)
  return (
    <>
      <SettingCard title="Where Seven keeps things" intro="The data folder holds agents, chats, data, memory and settings (back it up to keep everything). Tool modules and skills load from their own folders, which can live anywhere.">
        <PathRow label="Data" path={info?.dataDir ?? '…'}>
          <Button size="sm" variant="ghost" icon={<FolderOpen />} disabled={!info} onClick={() => info && void main('folder.open', { path: info.dataDir }).catch(failed('Could not open'))}>
            Open
          </Button>
        </PathRow>
        <ToolFolders />
      </SettingCard>
      <Places />
      <ModelFolders />
      <LinkedFolders />
      <DroppedPictures />
      <ExportImportPrefs />
    </>
  )
}
