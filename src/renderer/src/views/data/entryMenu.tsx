import { Download, FolderOpen, Hash, Link, MessageSquarePlus, MessageSquareQuote, PanelRight, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { LibraryHit, LibrarySection } from '@shared/types'
import { showName } from '@shared/ids'
import { askConfirm, askText, openMenu, type MenuItem, confirmDelete } from '../../components/ui'
import { showInPanel } from '../../components/data/showInPanel'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { exportKindMenu, exportMenu } from '../../lib/exporting'
import { toast } from '../../store/toasts'
import { rebuildIndex, type DataSelection, entryLink } from '../../store/data'
import { useApp } from '../../store/app'
import { kindUi } from '../../registries/kinds'
import { failed, copyText } from '../../lib/notify'
import { useWindows } from '../../store/windows'
import { showInData } from '../../lib/library'
import { referenceInChat, startChatWith } from '../../lib/conversation'
import { useAgents } from '../../store/agents'
import { boardMenu } from '../../components/data/boardMenu'
import { favouriteItem } from '../../lib/favourites'


export function openIn(kind: string, id: string, select: (s: DataSelection | null) => void): void {
  const ui = kindUi(kind)
  if (ui.open) ui.open(id)
  else select({ kind, id })
}

let known: LibrarySection[] | null = null
let loading: Promise<LibrarySection[]> | null = null

export function rememberSections(list: LibrarySection[]): void {
  known = list
}

function sections(): Promise<LibrarySection[]> {
  if (known) return Promise.resolve(known)
  loading ??= engine('library.overview', { query: '', perKind: 0 }).then(
    (list) => (known = list),
    (err) => {
      loading = null
      throw err
    }
  )
  return loading
}

async function sectionOf(kind: string): Promise<LibrarySection | null> {
  const hit = (await sections()).find((s) => s.kind === kind)
  if (hit) return hit
  const [found] = await engine('library.overview', { query: '', perKind: 0, kind })
  if (found) known = [...(known ?? []), found]
  return found ?? null
}

function at(e: React.MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  return { clientX: e.clientX, clientY: e.clientY, preventDefault: () => undefined, stopPropagation: () => undefined }
}

function trimmed(items: MenuItem[]): MenuItem[] {
  return items.filter((i, n) => !i.separator || (n > 0 && n < items.length - 1 && !items[n - 1].separator))
}

function joined(...groups: MenuItem[][]): MenuItem[] {
  return groups.filter((g) => g.length).flatMap((g, i) => (i ? [{ label: '', separator: true }, ...g] : g))
}

export function entryMenuAt(e: React.MouseEvent, kind: string, id: string, title: string, extra: MenuItem[] = []): void {
  const where = at(e)
  void sectionOf(kind).then(
    (section) => {
      const selected = (useWindows.getState().locations.data as DataSelection | null | undefined) ?? null
      const select = (s: DataSelection | null) => showInData(s, false)
      const open = () => {
        openIn(kind, id, select)
        useApp.getState().setView('data')
      }
      const base = section ? entryActions(section, { kind, id, title, summary: '' }, { open, select, selected }) : []
      const own = new Set(extra.map((i) => i.label).filter(Boolean))
      const kept = trimmed(base.filter((i) => !own.has(i.label)))
      openMenu(where, showName(title), joined(trimmed(extra.filter((i) => !i.danger)), kept, extra.filter((i) => i.danger)))
    },
    () => openMenu(where, showName(title), extra)
  )
}

export function clearKind(section: LibrarySection): void {
  askConfirm(`Delete all ${section.count} ${section.plural.toLowerCase()}?`, "This can't be undone. Export them first if you might want them back.", 'Delete all', async () => {
    try {
      const r = await engine('library.clearKind', { kind: section.kind })
      toast.success(`Deleted ${r.removed}`, r.failed ? `${r.failed} could not be deleted` : section.plural)
    } catch (err) {
      toast.error('Could not delete', errorText(err))
    }
  })
}

export function exportMenuAt(e: React.MouseEvent, section: LibrarySection, open: { id: string; kind: string; title: string } | null = null): void {
  const where = at(e)
  void (open ? sectionOf(open.kind) : Promise.resolve(null))
    .then((found) => {
      const own = found?.exportable ? found : undefined
      const entry = own ? open : null
      openMenu(where, entry ? showName(entry.title) : section.plural, joined(entry ? exportMenu(`${entry.kind}/${entry.id}`, own?.carriable ? showName(entry.title) : null) : [], exportKindMenu(section.kind, section.plural)))
    })
    .catch(failed('Could not list what can be exported'))
}

export function kindMenuAt(e: React.MouseEvent, section: LibrarySection, select: (s: DataSelection | null) => void): void {
  const ui = kindUi(section.kind)
  const add = ui.add?.(section.kind, select)
  const where = at(e)
  openMenu(
    where,
    section.plural,
    joined(
      [{ label: 'Open', icon: <FolderOpen />, onSelect: () => select({ kind: section.kind, id: 'all' }) }, ...(add ? [{ label: ui.addLabel ?? `New ${section.label.toLowerCase()}`, icon: <Plus />, onSelect: add }] : [])],
      section.exportable && section.count > 0 ? [{ label: 'Export all', icon: <Download />, children: exportKindMenu(section.kind, section.plural) }] : [],
      section.removable && section.count > 0 ? [{ label: `Delete all ${section.plural.toLowerCase()}`, icon: <Trash2 />, danger: true, onSelect: () => clearKind(section) }] : [],
      [{ label: 'Rebuild index', icon: <RefreshCw />, onSelect: () => void rebuildIndex().catch(failed('Could not rebuild the index')) }]
    )
  )
}

export function startChatItems(link: string, first: string[] = []): MenuItem[] {
  const agents = useAgents.getState().list
  const ordered = [...agents.filter((a) => first.includes(a.id)), ...agents.filter((a) => !first.includes(a.id))]
  return ordered.map((a) => ({ label: a.name, onSelect: () => startChatWith(a.id, link) }))
}

export function entryActions(section: LibrarySection, hit: LibraryHit, ctx: { open: () => void; select: (s: DataSelection | null) => void; selected: DataSelection | null }): MenuItem[] {
  const entry = `${section.kind}/${hit.id}`
  const link = entryLink(section.kind, hit.id)
  const ui = kindUi(section.kind)
  const own = ui.menu ? ui.menu({ kind: section.kind, id: hit.id, title: hit.title, select: ctx.select, selected: ctx.selected }) : []
  const items: MenuItem[] = [
    { label: 'Open', icon: <FolderOpen />, onSelect: ctx.open },
    { label: 'Reference in chat', icon: <MessageSquareQuote />, onSelect: () => referenceInChat(link) },
    { label: 'Start chat with', icon: <MessageSquarePlus />, children: startChatItems(link) },
    { label: 'Show in chat panel', icon: <PanelRight />, onSelect: () => void showInPanel(entry) },
    boardMenu(entry),
    { label: 'Copy link', icon: <Link />, onSelect: () => void copyText(link, 'Link copied', link) },
    favouriteItem({ kind: section.kind, id: hit.id, label: hit.title, icon: section.icon }),
    {
      label: 'Tags…',
      icon: <Hash />,
      onSelect: () =>
        void (hit.tags ? Promise.resolve(hit.tags) : engine('tags.of', { entry })).then(
          (tags) =>
            askText('Tags', 'Separate with spaces or commas', tags.join(' '), async (text) => {
              await engine('tags.set', { entry, tags: text.split(/[\s,]+/).filter(Boolean) }).catch(failed('Could not tag'))
            }, { optional: true }),
          failed('Could not read the tags')
        )
    }
  ]
  if (section.renamable && !own.some((i) => i.label === 'Rename'))
    items.push({
      label: 'Rename',
      icon: <Pencil />,
      onSelect: () =>
        askText(`Rename ${showName(hit.title)}`, 'Name', showName(hit.title), async (name) => {
          await engine('library.rename', { entry, name }).catch(failed('Could not rename'))
        })
    })
  if (own.length) items.push({ label: '', separator: true }, ...own)
  if (section.exportable) items.push({ label: '', separator: true }, ...exportMenu(entry, section.carriable ? showName(hit.title) : null))
  if (section.removable && !own.some((i) => i.label === 'Delete'))
    items.push(
      { label: '', separator: true },
      {
        label: 'Delete',
        icon: <Trash2 />,
        danger: true,
        onSelect: () =>
          confirmDelete(`Delete ${showName(hit.title)}?`, `This removes it from ${section.plural} for good.`, () => engine('library.remove', { entry }), () => {
            if (ctx.selected?.kind === section.kind && ctx.selected.id === hit.id) ctx.select({ kind: section.kind, id: 'all' })
          })
      }
    )
  return items
}

export function openEntryMenu(e: React.MouseEvent, section: LibrarySection, hit: LibraryHit, ctx: Parameters<typeof entryActions>[2]): void {
  openMenu(e, showName(hit.title), entryActions(section, hit, ctx))
}

export function rowMenu(kind: string, id: string, title: string, open: () => void, extra: MenuItem[] = []): (e: React.MouseEvent) => void {
  return (e) => entryMenuAt(e, kind, id, title, [{ label: 'Open', icon: <FolderOpen />, onSelect: open }, ...extra])
}
