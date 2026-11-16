import { FolderOpen } from 'lucide-react'
import { DEFAULT_PORTABILITY_PREFS } from '@shared/portability'
import { Button, Input, PathRow, SaveState, Segmented, SettingCard, SettingRow, Toggle, useDraft } from '../../components/ui'
import { main } from '../../lib/ipc'
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
  const saveNumber = (key: 'warnJsonMb' | 'warnCardMb' | 'maxUnpackMb', raw: string) => {
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
          className="w-24 font-mono text-[12px]"
        />
      </SettingRow>
      <SettingRow label="Warn on large PNG card exports (MB)" hint="PNG cards embed compressed payloads; large worlds belong in a bundle.">
        <Input
          type="number"
          min={1}
          max={500}
          value={prefs.warnCardMb}
          onChange={(e) => saveNumber('warnCardMb', e.target.value)}
          className="w-24 font-mono text-[12px]"
        />
      </SettingRow>
      <SettingRow label="Maximum unpacked bundle size (MB)" hint="Safety limit when reading imported .sevenpack archives.">
        <Input
          type="number"
          min={10}
          max={4096}
          value={prefs.maxUnpackMb}
          onChange={(e) => saveNumber('maxUnpackMb', e.target.value)}
          className="w-24 font-mono text-[12px]"
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
      <ModelFolders />
      <LinkedFolders />
      <DroppedPictures />
      <ExportImportPrefs />
    </>
  )
}
