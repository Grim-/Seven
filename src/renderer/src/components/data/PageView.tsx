import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronDown, FilePlus, FileText, FolderPlus, Upload, Image as ImageIcon, MoreHorizontal, Pencil, Search, Trash2, Volume2 } from 'lucide-react'
import { pageKindOf, type CollectionViewKind } from '@shared/types'
import { EmptyState, ShellTabs, askText, openMenu, confirmDelete, type MenuItem } from '../ui'
import { engine } from '../../lib/ipc'
import { errorText, formatRelative } from '../../lib/format'
import { toast } from '../../store/toasts'
import { assetUrl, findPage, useAsset, useData, usePage } from '../../store/data'
import { pickPicture } from './PicturePicker'
import { VoiceModal } from '../voice/VoicePicker'
import { entryMenuAt } from '../../views/data/entryMenu'
import { cn } from '../../lib/cn'
import { CollectionBody } from './CollectionView'
import { NoteBody, PageNav, usePageNav } from './NoteView'
import { checkField } from './fields'
import { useTools } from '../../store/tools'
import { sideIcon } from '../../registries/side'
import { ModulePageView } from '../present/template'
import { failed } from '../../lib/notify'
import { ownScreen } from '../../registries/kinds'
import { showInData } from '../../lib/library'
import { chooseFiles } from '../../lib/importFiles'


export async function createPage(title: string, type: string | null = null, parent: string | null = null): Promise<string | null> {
  const clean = title.trim()
  if (!clean) return null
  try {
    const page = await engine('data.pages.create', { title: clean, body: '', fields: [], type, parent })
    return page.id
  } catch (err) {
    toast.error('Could not create the page', errorText(err))
    return null
  }
}

export function askNewPage(onCreated: (id: string) => void, type: { id: string; label: string } | null = null, parent: string | null = null): void {
  askText(type ? `New ${type.label.toLowerCase()}` : 'New page', 'Title', '', async (title) => {
    const id = await createPage(title, type?.id ?? null, parent)
    if (id) onCreated(id)
  })
}

export function askNewFolder(onCreated: (id: string) => void, parent: string | null = null): void {
  askText('New folder', 'Name', '', async (title) => {
    const id = await createPage(title, 'folder', parent)
    if (id) onCreated(id)
  })
}

export function usePageTypes(): { id: string; label: string; icon: string; single: boolean; parts: string[] }[] {
  const modules = useTools((s) => s.list)
  return useMemo(
    () => modules.filter((m) => m.state === 'on').flatMap((m) => m.pages.map((p) => ({ id: `${m.id}:${p.type}`, label: p.label, icon: p.icon, single: p.single, parts: Object.keys(p.parts ?? {}) }))),
    [modules]
  )
}

type PageTypeChoice = { id: string; label: string; icon: string; single: boolean; parts: string[] }

export function newPageItems(types: PageTypeChoice[], onCreated: (id: string) => void, parent: string | null = null): MenuItem[] {
  return [
    { label: 'Page', icon: <FileText />, onSelect: () => askNewPage(onCreated, null, parent) },
    ...types.filter((t) => !t.single).map((t) => ({ label: t.label, icon: sideIcon(t.icon), onSelect: () => askNewPage(onCreated, t, parent) }))
  ]
}

export function folderNewItems(types: PageTypeChoice[], onCreated: (id: string) => void, parent: string | null = null): MenuItem[] {
  const pages = newPageItems(types, onCreated, parent)
  return [
    pages.length > 1 ? { label: 'New page', icon: <FilePlus />, children: pages } : { label: 'New page', icon: <FilePlus />, onSelect: () => askNewPage(onCreated, null, parent) },
    { label: 'New folder', icon: <FolderPlus />, onSelect: () => askNewFolder(onCreated, parent) },
    { label: 'Add files', icon: <Upload />, onSelect: () => void chooseFiles(parent) }
  ]
}

export function newPageMenu(e: React.MouseEvent, types: PageTypeChoice[], onCreated: (id: string) => void, parent: string | null = null): void {
  const items = newPageItems(types, onCreated, parent)
  if (items.length === 1) return askNewPage(onCreated, null, parent)
  openMenu(e, 'New', items)
}

function Backlinks({ id }: { id: string }) {
  const pages = useData((s) => s.pages)
  const nav = usePageNav()
  const [links, setLinks] = useState<{ id: string; title: string }[]>([])
  useEffect(() => {
    let live = true
    engine('data.pages.backlinks', { id })
      .then((l) => live && setLinks(l))
      .catch(() => live && setLinks([]))
    return () => {
      live = false
    }
  }, [id, pages])
  if (!links.length) return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line/40 pt-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">
      Linked from
      {links.map((l) => (
        <button key={l.id} onClick={() => nav?.(l.id)} className="normal-case tracking-normal text-accent-soft hover:text-white">
          {l.title}
        </button>
      ))}
    </div>
  )
}

export function PageDetail({ id, onDeleted }: { id: string; onDeleted?: () => void }) {
  const page = usePage(id)
  const [voicing, setVoicing] = useState(false)
  const [part, setPart] = useState<string | null>(null)
  const types = usePageTypes()
  const picture = useAsset(page?.image ?? '')
  if (page === undefined) return <div className="p-3 font-mono text-[11px] text-dim">Loading…</div>
  if (!page) return <EmptyState title="Deleted">This page no longer exists.</EmptyState>

  const typeLabel = page.type ? types.find((t) => t.id === page.type)?.label : null
  const Screen = page.type ? ownScreen(pageKindOf(page.type)) : undefined
  const hasItems = !page.type && page.records.length > 0
  const view: CollectionViewKind = page.view ?? (checkField(page) ? 'checklist' : 'table')
  const changePicture = () => void pickPicture(page.image).then((r) => r && engine('data.pages.image', { id: page.id, image: r.id }).catch(failed('Could not set the picture')))
  const rename = () =>
    askText('Rename page', 'Title', page.title, async (title) => {
      await engine('data.pages.write', { id: page.id, title, body: null }).catch(failed('Could not rename'))
    })
  const menu = (e: React.MouseEvent) =>
    entryMenuAt(e, pageKindOf(page.type), page.id, page.title, [
      { label: 'Rename', icon: <Pencil />, onSelect: rename },
      { label: page.image ? 'Change picture' : 'Add a picture', icon: <ImageIcon />, onSelect: changePicture },
      { label: page.voice ? 'Change voice' : 'Give it a voice', icon: <Volume2 />, onSelect: () => setVoicing(true) },
      {
        label: 'Delete',
        icon: <Trash2 />,
        danger: true,
        onSelect: () =>
          confirmDelete(`Delete ${page.title}?`, 'Its text and items are removed. Boards and chats showing it will say it is missing.', () => engine('data.pages.delete', { id: page.id }), () => onDeleted?.())
      }
    ])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center gap-2">
        {page.image && picture && (
          <button title="Change picture" onClick={changePicture} className="h-14 w-14 shrink-0 overflow-hidden border border-line/60 hover:border-accent">
            <img src={assetUrl(picture)} alt="" className="h-full w-full object-cover" />
          </button>
        )}
        {Screen ? (
          <span className="flex-1" />
        ) : (
          <h2 onDoubleClick={rename} className="min-w-0 flex-1 truncate text-[17px] font-semibold text-white">
            {page.title}
          </h2>
        )}
        {page.type && <span className="shrink-0 border border-line/60 px-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent-soft">{typeLabel ?? 'Tool off'}</span>}
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{formatRelative(page.updatedAt)}</span>
        <button title="More" onClick={menu} className="flex h-7 w-7 shrink-0 items-center justify-center text-dim hover:text-white">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      {page.type ? (
        typeLabel && Screen ? (
          <Screen kind={pageKindOf(page.type)} id={page.id} select={(s) => s && showInData(s)} />
        ) : typeLabel ? (
          <div className="flex flex-col gap-2">
            {(types.find((t) => t.id === page.type)?.parts.length ?? 0) > 1 && (
              <ShellTabs value={part ?? types.find((t) => t.id === page.type)!.parts[0]} options={types.find((t) => t.id === page.type)!.parts.map((p) => ({ value: p, label: p }))} onChange={setPart} />
            )}
            <ModulePageView pageId={page.id} version={page.version} part={part} />
          </div>
        ) : (
          <div className="border border-line/50 px-3 py-2 text-[12.5px] text-dim">This page belongs to a tool that is off or removed. Turn it on in Tools to see it.</div>
        )
      ) : null}
      {page.type ? (
        <details open={Boolean(page.body.trim())} className="group">
          <summary className="cursor-pointer font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft">Notes</summary>
          <div className="pt-2">
            <NoteBody page={page} heading={false} maxHeight="" contents className="seven-doc-bg p-3" />
          </div>
        </details>
      ) : (
        <NoteBody key={page.id} page={page} heading={false} maxHeight="" startEditing={!page.body && !hasItems} contents className="seven-doc-bg p-3" />
      )}
      {hasItems && <CollectionBody page={page} view={view} recordIds={null} />}
      <Backlinks id={page.id} />
      {voicing && (
        <VoiceModal
          title={`Voice for ${page.title}`}
          value={page.voice ?? null}
          onClose={() => setVoicing(false)}
          onSave={(voice) => {
            void engine('data.pages.voice', { id: page.id, voice }).catch(failed('Could not set the voice'))
          }}
        />
      )}
    </div>
  )
}

function Jump({ current, onPick }: { current: string; onPick: (ref: string, create: boolean) => void }) {
  const pages = useData((s) => s.pages)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const title = pages.find((p) => p.id === current)?.title ?? current
  const q = query.trim().toLowerCase()
  const matches = useMemo(
    () => (q ? pages.filter((p) => p.title.toLowerCase().includes(q) || p.summary.toLowerCase().includes(q)) : pages).slice(0, 12),
    [pages, q]
  )
  const exact = q && pages.some((p) => p.title.toLowerCase() === q)
  const options = [...matches.map((p) => ({ id: p.id, label: p.title, create: false })), ...(q && !exact ? [{ id: query.trim(), label: `Create “${query.trim()}”`, create: true }] : [])]

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  const pick = (i: number) => {
    const o = options[i]
    if (!o) return
    setOpen(false)
    setQuery('')
    onPick(o.id, o.create)
  }

  return (
    <div ref={box} className="relative min-w-0 flex-1">
      {open ? (
        <div className="flex h-7 items-center gap-1.5 border border-accent/60 bg-black/60 px-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-dim" />
          <input
            autoFocus
            value={query}
            placeholder="Go to a page"
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, options.length - 1))
              if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
              if (e.key === 'Enter') pick(active)
              if (e.key === 'Escape') setOpen(false)
            }}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-white outline-none placeholder:text-faint"
          />
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="flex h-7 w-full items-center gap-2 border border-line/50 px-2 text-left hover:border-accent/60">
          <FileText className="h-3.5 w-3.5 shrink-0 text-accent" />
          <span className="truncate font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-white">{title}</span>
          <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-dim" />
        </button>
      )}
      {open && options.length > 0 && (
        <div className="absolute inset-x-0 top-8 z-30 flex max-h-72 flex-col overflow-y-auto border border-line/60 bg-bg shadow-lg">
          {options.map((o, i) => (
            <button
              key={`${o.create}-${o.id}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(i)}
              className={cn('px-2.5 py-1.5 text-left text-[12.5px]', i === active ? 'bg-accent/10 text-white' : 'text-white/80', o.create && 'text-accent')}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function PageHost({ id, onChange, onClose }: { id: string; onChange?: (id: string) => void; onClose?: () => void }) {
  const [nav, setNav] = useState<{ history: string[]; index: number }>({ history: [id], index: 0 })
  const current = nav.history[nav.index]

  const push = (target: string) => {
    setNav((n) => (n.history[n.index] === target ? n : { history: [...n.history.slice(0, n.index + 1), target], index: n.index + 1 }))
    onChange?.(target)
  }

  useEffect(() => {
    if (id !== current) push(id)
  }, [id])

  const go = async (ref: string, create = false) => {
    const found = create ? undefined : findPage(useData.getState().pages, ref)
    if (found) return push(found.id)
    const made = await createPage(ref)
    if (made) push(made)
  }

  const step = (by: number) => {
    const index = Math.max(0, Math.min(nav.index + by, nav.history.length - 1))
    if (index === nav.index) return
    setNav({ ...nav, index })
    onChange?.(nav.history[index])
  }

  return (
    <PageNav.Provider value={(ref) => void go(ref)}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-1 border-b border-line/40 px-2 py-1.5">
          <button title="Back" disabled={nav.index === 0} onClick={() => step(-1)} className="flex h-7 w-7 items-center justify-center text-dim hover:text-white disabled:opacity-30">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button title="Forward" disabled={nav.index >= nav.history.length - 1} onClick={() => step(1)} className="flex h-7 w-7 items-center justify-center text-dim hover:text-white disabled:opacity-30">
            <ArrowRight className="h-4 w-4" />
          </button>
          <Jump current={current} onPick={(ref, create) => void go(ref, create)} />
          {onClose && (
            <button onClick={onClose} className="ml-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim hover:text-white">
              Close
            </button>
          )}
        </div>
        <PageDetail key={current} id={current} onDeleted={() => (nav.index > 0 ? step(-1) : onClose?.())} />
      </div>
    </PageNav.Provider>
  )
}

export function ToolPage({ id }: { id: string }) {
  const page = usePage(id)
  if (page === undefined) return <div className="p-3 font-mono text-[11px] text-dim">Loading…</div>
  if (!page) return <EmptyState title="Gone">This tool's page no longer exists.</EmptyState>
  return (
    <div className="min-h-0 flex-1 overflow-y-auto border border-line/60 bg-black/70 p-2">
      <ModulePageView pageId={page.id} version={page.version} />
    </div>
  )
}
