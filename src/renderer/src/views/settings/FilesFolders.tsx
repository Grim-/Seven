import { FolderOpen } from 'lucide-react'
import { Button, PathRow, SaveState, Segmented, SettingCard, SettingRow, useDraft } from '../../components/ui'
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
    </>
  )
}
