import { Archive, FolderOutput, Send } from 'lucide-react'
import { engine, main } from './ipc'
import { toast } from '../store/toasts'
import { errorText } from './format'
import { askConfirm, type MenuItem } from '../components/ui'
import { openExport } from '../components/export/exportStore'
import { type CarryTarget } from '../components/carry/carryStore'
import { openPortableExport } from '../components/portability/portabilityStore'

export async function saveAsset(id: string, name: string): Promise<void> {
  try {
    const path = await main('asset.saveAs', { id, name })
    if (path) toast.success('Saved a copy', path)
  } catch (err) {
    toast.error('Could not save', errorText(err))
  }
}

export type ExportTarget = 'obsidian' | 'markdown'

export function exportToFolder(what: { entries?: string[]; kind?: string | null; tag?: string | null }, target: ExportTarget): void {
  askConfirm('Export to a folder', 'Seven writes one file per entry, with their pictures and files, into a new folder inside the one you pick. The exported files are not encrypted.', 'Pick a folder', async () => {
    try {
      const dir = await main('dialog.openFolder')
      if (!dir) return
      const r = await engine('library.exportFolder', { entries: what.entries ?? [], kind: what.kind ?? null, tag: what.tag ?? null, target, dir })
      toast.success('Exported', `${r.files} file${r.files === 1 ? '' : 's'}${r.attachments ? ` and ${r.attachments} attachment${r.attachments === 1 ? '' : 's'}` : ''} to ${r.folder}`)
      if (r.skipped.length) toast.info(`${r.skipped.length} skipped`, r.skipped.slice(0, 6).join(', '))
    } catch (err) {
      toast.error('Could not export', errorText(err))
    }
  })
}

function folderMenu(what: { entries?: string[]; kind?: string | null }): MenuItem {
  return {
    label: 'Export to a folder',
    icon: <FolderOutput />,
    children: [
      { label: 'For Obsidian', onSelect: () => exportToFolder(what, 'obsidian') },
      { label: 'As plain markdown', onSelect: () => exportToFolder(what, 'markdown') }
    ]
  }
}

export function exportMenu(entry: string, carry: CarryTarget['title'] | null): MenuItem[] {
  const slash = entry.indexOf('/')
  const portableItem =
    slash > 0
      ? [{ kind: entry.slice(0, slash), id: entry.slice(slash + 1), title: carry ?? undefined }]
      : undefined
  return [
    {
      label: 'Export (Markdown / Card / JSON / Bundle)…',
      icon: <Archive />,
      onSelect: () => openPortableExport({ items: portableItem, defaultFormat: carry ? 'card' : 'bundle' })
    },
    { label: 'Hand to an agent…', icon: <Send />, onSelect: () => openExport('entry', { entry }) },
    folderMenu({ entries: [entry] })
  ]
}

export function exportKindMenu(kind: string, label: string): MenuItem[] {
  return [
    {
      label: `Export all ${label.toLowerCase()} (Markdown / Card / JSON / Bundle)…`,
      icon: <Archive />,
      onSelect: () => openPortableExport({ kind })
    },
    { label: `Hand all ${label.toLowerCase()} to an agent…`, icon: <Send />, onSelect: () => openExport('kind', { kind }) },
    { ...folderMenu({ kind }), label: `Export all ${label.toLowerCase()} to a folder` }
  ]
}
