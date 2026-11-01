import { FolderPlus, RefreshCw, X } from 'lucide-react'
import { Button, PathRow, SettingCard } from '../components/ui'
import { useApp } from '../store/app'
import { useModels } from '../store/models'
import { main } from '../lib/ipc'
import { toast } from '../store/toasts'
import { errorText } from '../lib/format'

export function useModelFolderActions() {
  const settings = useApp((s) => s.settings)
  const updateSettings = useApp((s) => s.updateSettings)
  const scan = useModels((s) => s.scan)
  const folders = settings?.modelFolders ?? []

  const rescan = async (list = folders) => {
    try {
      await scan(list)
    } catch (err) {
      toast.error('Scan failed', errorText(err))
    }
  }

  const addFolder = async () => {
    const folder = await main('dialog.openFolder')
    if (!folder) return
    const next = await updateSettings({ modelFolders: [...folders, folder] })
    await rescan(next.modelFolders)
  }

  const removeFolder = async (folder: string) => {
    const next = await updateSettings({ modelFolders: folders.filter((f) => f !== folder) })
    await rescan(next.modelFolders)
  }

  return { folders, addFolder, removeFolder, rescan }
}

export function ModelFolders({ className }: { className?: string }) {
  const { folders, addFolder, removeFolder, rescan } = useModelFolderActions()
  const models = useModels((s) => s.list)
  return (
    <SettingCard
      className={className}
      title="Model folders"
      count={folders.length}
      intro={folders.length ? undefined : 'No folders yet. Add the folder where you keep GGUF files and Seven will find every model inside it.'}
      actions={
        <>
          <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={() => void rescan()}>
            Rescan
          </Button>
          <Button size="sm" variant="badge" icon={<FolderPlus />} onClick={() => void addFolder()}>
            Add folder
          </Button>
        </>
      }
    >
      {folders.map((folder) => {
        const count = models.filter((m) => m.folder === folder).length
        return (
          <PathRow key={folder} label="Folder" path={folder} tags={[`${count} model${count === 1 ? '' : 's'}`]}>
            <Button size="sm" variant="ghost" icon={<X />} onClick={() => void removeFolder(folder)}>
              Remove
            </Button>
          </PathRow>
        )
      })}
    </SettingCard>
  )
}
