import { ArrowUpToLine, FolderInput, Hash, Minus, Plus, Trash2, X } from 'lucide-react'
import { isAssetId, showName } from '@shared/ids'
import { pageKindOf, type PageMeta } from '@shared/types'
import { askText, confirmDelete, type MenuItem } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useData } from '../../store/data'

function entryOf(id: string): string {
  if (isAssetId(id)) return `file/${id}`
  return `${pageKindOf(useData.getState().pages.find((p) => p.id === id)?.type)}/${id}`
}

export function moveEntries(ids: string[], parent: string | null): Promise<void> {
  return Promise.all(ids.filter((id) => id !== parent).map((id) => (isAssetId(id) ? engine('data.assets.move', { id, parent }) : engine('data.pages.move', { id, parent })))).then(
    () => undefined,
    failed(ids.length === 1 ? 'Could not move it' : 'Could not move them')
  )
}

const words = (text: string) => text.split(/[\s,]+/).map((t) => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean)

function retag(ids: string[], add: string[], remove: string[]): Promise<void> {
  const drop = new Set(remove)
  return Promise.all(
    ids.map(async (id) => {
      const entry = entryOf(id)
      const now = await engine('tags.of', { entry })
      await engine('tags.set', { entry, tags: [...new Set([...now, ...add])].filter((t) => !drop.has(t)) })
    })
  ).then(() => undefined, failed('Could not tag'))
}

export function tagItems(ids: string[]): MenuItem[] {
  const what = `${ids.length} item${ids.length === 1 ? '' : 's'}`
  return [
    { label: 'Add tags…', icon: <Plus />, onSelect: () => askText(`Add tags to ${what}`, 'Separate with spaces or commas', '', (text) => retag(ids, words(text), [])) },
    { label: 'Remove tags…', icon: <Minus />, onSelect: () => askText(`Remove tags from ${what}`, 'Separate with spaces or commas', '', (text) => retag(ids, [], words(text))) }
  ]
}

export function moveItems(ids: string[], then?: (parent: string | null) => void): MenuItem[] {
  const picked = new Set(ids)
  const targets = useData
    .getState()
    .pages.filter((p: PageMeta) => !picked.has(p.id))
    .sort((a, b) => a.title.localeCompare(b.title))
  return targets.length ? targets.map((t) => ({ label: showName(t.title), onSelect: () => void moveEntries(ids, t.id).then(() => then?.(t.id)) })) : [{ label: 'No other pages', disabled: true }]
}

export function bulkItems(ids: string[], options: { onMoved?: (parent: string | null) => void; onClear?: () => void } = {}): MenuItem[] {
  return [
    { label: 'Tags', icon: <Hash />, children: tagItems(ids) },
    { label: 'Move under', icon: <FolderInput />, children: moveItems(ids, options.onMoved) },
    { label: 'Move to top level', icon: <ArrowUpToLine />, onSelect: () => void moveEntries(ids, null).then(() => options.onMoved?.(null)) },
    ...(options.onClear ? [{ label: 'Clear selection', icon: <X />, onSelect: options.onClear }] : []),
    { label: '', separator: true },
    {
      label: `Delete ${ids.length}…`,
      icon: <Trash2 />,
      danger: true,
      onSelect: () => confirmDelete(`Delete ${ids.length} items?`, "The pages and files picked are deleted; what is inside a picked folder moves up a level. This can't be undone.", () => Promise.all(ids.map((id) => engine('library.remove', { entry: entryOf(id) }))), options.onClear)
    }
  ]
}
