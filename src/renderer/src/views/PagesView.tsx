import { usePlaces } from '../store/places'
import { FOLDER_TYPE, showName } from '@shared/ids'
import { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import MiniSearch from 'minisearch'
import { ArrowUpToLine, BookOpen, ChevronDown, ChevronRight, Download, Folder, FolderInput, FolderOpen, FolderPlus, Hash, Plus, X } from 'lucide-react'
import { pageKindOf, type LibrarySection, type PageMeta } from '@shared/types'
import { Button, EmptyState, Gutter, MainPane, PaneHeader, ReadingPane, SidePane, Split, VirtualList, openMenu, type MenuItem } from '../components/ui'
import { askNewFolder, folderNewItems, newPageMenu, usePageTypes } from '../components/data/PageView'
import { ancestorsOf, findPage, useData, type DataSelection } from '../store/data'
import { FolderPath } from '../components/data/FolderPath'
import { useApp } from '../store/app'
import { engine, on } from '../lib/ipc'
import { KindIcon, onLibraryChange } from '../lib/library'
import { presentOf } from '../registries/kinds'
import { GeneratedPage } from '../components/data/kindUis'
import { PageExplorer } from '../components/data/PageExplorer'
import { cn } from '../lib/cn'
import { failed } from '../lib/notify'
import { entryMenuAt, exportMenuAt, kindMenuAt } from './data/entryMenu'
import { CopyLinkButton } from '../components/data/CopyLinkButton'
import { pickWith } from '../lib/picking'
import { dragEntries, droppedEntries, isEntryDrag } from '../lib/entryDrag'
import { bulkItems, moveEntries, moveItems, tagItems } from '../components/data/bulkMenu'
import { showInData } from '../lib/library'

const ROOT = ''
const INDEX_ID = 'all:wiki-index'
const INDEX_TITLE = 'Wiki index'
const SEVEN = '__seven'

type Special = { id: string; title: string; summary: string }

function useSpecials(): Special[] {
  const list = useTree((s) => s.specials)
  useEffect(() => {
    const load = () =>
      void engine('library.guides')
        .then((specials) => useTree.setState({ specials }))
        .catch(failed('Could not load the Seven pages'))
    load()
    return onLibraryChange(load)
  }, [])
  return list
}
const INDENT = 14

const ALL = '__all'
const BY_TAG = '__tags'

interface TreeState {
  specials: Special[]
  selected: string | null
  open: Record<string, true>
  shut: Record<string, true>
  tab: string
  picked: string[]
  anchor: string | null
  select: (id: string | null) => void
  toggle: (id: string, on?: boolean) => void
  toggleShut: (id: string) => void
  reveal: (ids: string[]) => void
  setTab: (tab: string) => void
  setPicked: (picked: string[], anchor?: string | null) => void
}

const useTree = create<TreeState>((set) => ({
  specials: [],
  selected: null,
  open: {},
  shut: {},
  tab: ALL,
  picked: [],
  anchor: null,
  select: (selected) => set({ selected }),
  toggleShut: (id) =>
    set((s) => {
      const shut = { ...s.shut }
      if (shut[id]) delete shut[id]
      else shut[id] = true
      return { shut }
    }),
  setTab: (tab) => set({ tab }),
  setPicked: (picked, anchor) => set((s) => ({ picked, anchor: anchor === undefined ? s.anchor : anchor })),
  toggle: (id, on) =>
    set((s) => {
      const open = { ...s.open }
      if (on ?? !open[id]) open[id] = true
      else delete open[id]
      return { open }
    }),
  reveal: (ids) => set((s) => ({ open: { ...s.open, ...Object.fromEntries(ids.map((id) => [id, true as const])) } }))
}))

const TREE_PLACE = 'pages.tree'

function restoreTree(places: Record<string, unknown>): void {
  const saved = places[TREE_PLACE] as { selected?: unknown; open?: unknown; tab?: unknown } | undefined
  if (!saved) return
  useTree.setState({
    ...(typeof saved.selected === 'string' || saved.selected === null ? { selected: saved.selected } : {}),
    ...(saved.open && typeof saved.open === 'object' ? { open: saved.open as Record<string, true> } : {}),
    ...(typeof saved.tab === 'string' ? { tab: saved.tab } : {})
  })
}

if (usePlaces.getState().loaded) restoreTree(usePlaces.getState().places)
usePlaces.subscribe((s, prev) => s.loaded && !prev.loaded && restoreTree(s.places))
useTree.subscribe((s, prev) => {
  if (s.selected !== prev.selected || s.open !== prev.open || s.tab !== prev.tab) usePlaces.getState().save(TREE_PLACE, { selected: s.selected, open: s.open, tab: s.tab })
})

function useTagMap(): Record<string, string[]> {
  const [map, setMap] = useState<Record<string, string[]>>({})
  useEffect(() => {
    const load = () =>
      void engine('tags.map')
        .then(setMap)
        .catch(() => undefined)
    load()
    const offTags = on('tags.changed', load)
    const offLibrary = onLibraryChange(load)
    return () => {
      offTags()
      offLibrary()
    }
  }, [])
  return map
}

function SectionHead({ icon, label, count, open, first, onToggle }: { icon: React.ReactNode; label: string; count: number; open: boolean; first: boolean; onToggle: () => void }) {
  return (
    <div className={first ? undefined : 'mt-1.5 border-t border-line/30 pt-1.5'}>
      <button onClick={onToggle} className="flex w-full items-center gap-1.5 py-1 pl-1 pr-2 text-left text-[13px] text-white/80 hover:bg-white/[0.03]">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-dim">{open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</span>
        {icon}
        <span className="flex-1 truncate">{label}</span>
        <span className="shrink-0 font-mono text-[10px] text-faint">{count}</span>
      </button>
    </div>
  )
}

type Line = { key: string; node: () => React.ReactNode }

function useKindIcons(): Record<string, string> {
  const [icons, setIcons] = useState<Record<string, string>>({})
  useEffect(() => {
    void engine('library.kindInfo')
      .then((list) => setIcons(Object.fromEntries(list.map((k) => [k.kind, k.icon]))))
      .catch(() => undefined)
  }, [])
  return icons
}

function childrenMap(pages: PageMeta[]): Map<string, PageMeta[]> {
  const ids = new Set(pages.map((p) => p.id))
  const map = new Map<string, PageMeta[]>()
  for (const p of pages) {
    const key = p.parent && ids.has(p.parent) ? p.parent : ROOT
    const list = map.get(key) ?? []
    list.push(p)
    map.set(key, list)
  }
  return map
}



export function useOpenPage(): { id: string; title: string; kind: string } | null {
  const selected = useTree((s) => s.selected)
  const specials = useTree((s) => s.specials)
  const page = useData((s) => (selected ? s.pages.find((p) => p.id === selected) : undefined))
  if (!selected) return null
  if (page) return { id: page.id, title: page.title, kind: pageKindOf(page.type) }
  if (selected === INDEX_ID) return { id: INDEX_ID, title: INDEX_TITLE, kind: 'page' }
  const special = specials.find((x) => x.id === selected)
  return special ? { id: special.id, title: special.title, kind: 'page' } : null
}

export function showPage(id: string | null): void {
  useTree.getState().select(id)
  useApp.getState().setView('pages')
}

export function PagesBrowser({ section, select: selectData, onBack }: { section: LibrarySection; select: (s: DataSelection | null) => void; onBack?: () => void }) {
  useEffect(() => {
    void useData.getState().refresh().catch(() => undefined)
  }, [])
  const pages = useData((s) => s.pages)
  const { selected, open, shut, tab, picked, anchor, select, toggle, toggleShut, reveal, setTab, setPicked } = useTree()
  const tagMap = useTagMap()
  const icons = useKindIcons()
  const types = usePageTypes()
  const [filter, setFilter] = useState('')
  const [dragging, setDragging] = useState<string[]>([])
  const [over, setOver] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  const byId = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages])
  const tree = useMemo(() => childrenMap(pages), [pages])
  const current = selected ? (byId.get(selected) ?? null) : null
  const specials = useSpecials()
  const special = selected && !current ? (specials.find((s) => s.id === selected) ?? null) : null
  const path = useMemo(() => (current ? ancestorsOf(current.id, byId) : []), [current, byId])

  useEffect(() => {
    if (path.length) reveal(path.map((p) => p.id))
  }, [current?.id])

  const tagsOf = (p: PageMeta): string[] => tagMap[`${pageKindOf(p.type)}/${p.id}`] ?? []
  const tagList = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of pages) for (const t of tagMap[`${pageKindOf(p.type)}/${p.id}`] ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [pages, tagMap])
  const order = useMemo(() => {
    const out: string[] = []
    const walk = (list: PageMeta[]) => {
      for (const p of list) {
        out.push(p.id)
        walk(tree.get(p.id) ?? [])
      }
    }
    walk(tree.get(ROOT) ?? [])
    return out
  }, [tree])
  const pickedSet = useMemo(() => new Set(picked), [picked])

  useEffect(() => {
    if (tab !== ALL && tab !== BY_TAG && !tagList.some(([t]) => t === tab)) setTab(ALL)
  }, [tab, tagList])

  useEffect(() => {
    const live = picked.filter((id) => byId.has(id))
    if (live.length !== picked.length) setPicked(live)
  }, [byId])

  const click = (e: React.MouseEvent, p: PageMeta) => {
    const next = pickWith(e, p.id, { picked, anchor, selected: selected && byId.has(selected) ? selected : null, order })
    if (next) return setPicked(next.picked, next.anchor)
    setPicked([], p.id)
    select(p.id)
  }

  const q = filter.trim().toLowerCase()
  const visible = useMemo(() => {
    if (!q) return null
    const keep = new Set<string>()
    const near = new Set<string>()
    if (q.length > 2) {
      const index = new MiniSearch<{ id: string; title: string }>({ fields: ['title'], searchOptions: { prefix: (t) => t.length > 2, fuzzy: (t) => (t.length > 3 ? 0.2 : false), combineWith: 'AND' } })
      index.addAll(pages.map((p) => ({ id: p.id, title: p.title })))
      for (const r of index.search(q)) near.add(String(r.id))
    }
    for (const p of pages) {
      if (!p.title.toLowerCase().includes(q) && !near.has(p.id)) continue
      keep.add(p.id)
      for (const a of ancestorsOf(p.id, byId)) keep.add(a.id)
    }
    return keep
  }, [q, pages, byId])

  const made = (parent: string | null) => (id: string) => {
    select(id)
    if (parent) toggle(parent, true)
  }

  const openLink = (kind: string, ref: string): boolean => {
    const key = ref.replace(/^"|"$/g, '').toLowerCase()
    if (kind === 'page' && (key === INDEX_ID || key === 'wiki_index' || key === INDEX_TITLE.toLowerCase())) {
      select(INDEX_ID)
      return true
    }
    const extra = kind === 'page' ? specials.find((s) => s.id === ref || s.title.toLowerCase() === key) : undefined
    if (extra) {
      select(extra.id)
      return true
    }
    const found = findPage(pages, ref, (p) => pageKindOf(p.type) === kind)
    if (!found) return false
    select(found.id)
    return true
  }

  const screenSelect = (s: DataSelection | null) => {
    if (!s) return select(null)
    if (byId.has(s.id) || s.kind === 'page') return select(s.id)
    showInData(s)
  }

  const pickedPages = picked.map((id) => byId.get(id)).filter((p): p is PageMeta => Boolean(p))
  const reopen = (parent: string | null) => parent && toggle(parent, true)
  const bulkTags = (e: React.MouseEvent) => openMenu(e, `${pickedPages.length} pages`, tagItems(picked))
  const bulkMove = (e: React.MouseEvent) => openMenu(e, 'Move under', moveItems(picked, reopen))
  const bulkTop = () => void moveEntries(pickedPages.filter((p) => p.parent).map((p) => p.id), null)

  const menu = (e: React.MouseEvent, p: PageMeta) => {
    if (pickedSet.has(p.id) && picked.length > 1) {
      openMenu(e, `${picked.length} pages`, bulkItems(picked, { onMoved: reopen, onClear: () => setPicked([]) }))
      return
    }
    const extra: MenuItem[] = [
      { label: 'Open', icon: <FolderOpen />, onSelect: () => select(p.id) },
      ...(p.type === 'folder'
        ? [
            { label: 'New here', icon: <Plus />, children: folderNewItems(types, made(p.id), p.id) }
          ]
        : []),
      ...(p.parent ? [{ label: 'Move to top level', icon: <ArrowUpToLine />, onSelect: () => void moveEntries([p.id], null) }] : [])
    ]
    entryMenuAt(e, pageKindOf(p.type), p.id, p.title, extra)
  }

  const drop = (parent: string | null) => (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const ids = droppedEntries(e).filter((id) => id !== parent && (byId.get(id)?.parent ?? null) !== parent)
    setDragging([])
    setOver(null)
    if (!ids.length) return
    if (parent) toggle(parent, true)
    void moveEntries(ids, parent)
  }

  const pageLine = (p: PageMeta, depth: number): React.ReactNode => {
    const kids = tree.get(p.id) ?? []
    const expanded = Boolean(visible) || Boolean(open[p.id])
    const kind = pageKindOf(p.type)
    return (
        <div
          draggable
          onDragStart={(e) => {
            const ids = pickedSet.has(p.id) ? picked : [p.id]
            dragEntries(e, ids)
            setDragging(ids)
          }}
          onDragEnd={() => {
            setDragging([])
            setOver(null)
          }}
          onDragOver={(e) => {
            if (!isEntryDrag(e) || dragging.includes(p.id)) return
            e.preventDefault()
            e.stopPropagation()
            setOver(p.id)
          }}
          onDragLeave={() => over === p.id && setOver(null)}
          onDrop={drop(p.id)}
          onClick={(e) => click(e, p)}
          onContextMenu={(e) => menu(e, p)}
          style={{ paddingLeft: 4 + depth * INDENT }}
          data-on={pickedSet.has(p.id) || over === p.id || selected === p.id}
          data-drag={dragging.includes(p.id)}
          className={cn('shell-row group flex cursor-pointer items-center gap-1.5 py-1 pr-2 text-[13px]', pickedSet.has(p.id) || selected === p.id ? 'text-white' : 'text-white/80')}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (kids.length) toggle(p.id)
            }}
            className={cn('flex h-4 w-4 shrink-0 items-center justify-center text-dim hover:text-white', !kids.length && 'invisible')}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          {kind === 'folder' ? (
            expanded ? <FolderOpen className={cn('h-3.5 w-3.5 shrink-0', selected === p.id ? 'text-accent' : 'text-accent-soft')} /> : <Folder className={cn('h-3.5 w-3.5 shrink-0', selected === p.id ? 'text-accent' : 'text-accent-soft')} />
          ) : (
            <KindIcon name={icons[kind] ?? 'file-text'} className={cn('h-3.5 w-3.5 shrink-0', selected === p.id ? 'text-accent' : 'text-dim')} />
          )}
          <span className={cn('min-w-0 flex-1 truncate', pickedSet.has(p.id) && 'shell-cursor')}>{showName(p.title)}</span>
          {kids.length > 0 && !expanded && <span className="shrink-0 font-mono text-[10px] text-faint">{kids.length}</span>}
        </div>
    )
  }

  const lines: Line[] = []
  const addPage = (p: PageMeta, depth: number, prefix: string) => {
    if (visible && !visible.has(p.id)) return
    lines.push({ key: `${prefix}/${p.id}`, node: () => pageLine(p, depth) })
    if (Boolean(visible) || open[p.id]) for (const k of tree.get(p.id) ?? []) addPage(k, depth + 1, `${prefix}/${p.id}`)
  }
  const addSection = (key: string, icon: React.ReactNode, label: string, count: number, isOpen: boolean, onToggle: () => void) => {
    const first = lines.length === 0
    lines.push({ key: `section:${key}`, node: () => <SectionHead icon={icon} label={label} count={count} open={isOpen} first={first} onToggle={onToggle} /> })
    return isOpen
  }

  const roots = tree.get(ROOT) ?? []
  if (tab === ALL) for (const p of roots) addPage(p, 0, '')
  if (tab === BY_TAG) {
    for (const [t, n] of tagList) if (addSection(`tag:${t}`, <Hash className="h-3.5 w-3.5 shrink-0 text-dim" />, t, n, Boolean(q) || !shut[`tag:${t}`], () => toggleShut(`tag:${t}`))) for (const p of pages.filter((p) => tagsOf(p).includes(t))) addPage(p, 1, `tag:${t}`)
    const untagged = pages.filter((p) => !tagsOf(p).length)
    if (untagged.length && addSection('tag:', <Hash className="h-3.5 w-3.5 shrink-0 text-faint" />, 'Untagged', untagged.length, Boolean(q) || !shut['tag:'], () => toggleShut('tag:'))) for (const p of untagged) addPage(p, 1, 'untagged')
  }
  if (tab !== ALL && tab !== BY_TAG) for (const p of pages.filter((p) => tagsOf(p).includes(tab))) addPage(p, 0, `only:${tab}`)
  if (tab === ALL && specials.length > 0 && (!q || specials.some((s) => s.title.toLowerCase().includes(q))) && addSection(SEVEN, <BookOpen className="h-3.5 w-3.5 shrink-0 text-dim" />, 'Seven', specials.length, Boolean(q) || Boolean(open[SEVEN]), () => toggle(SEVEN)))
    for (const sp of specials.filter((s) => !q || s.title.toLowerCase().includes(q)))
      lines.push({
        key: `special:${sp.id}`,
        node: () => (
          <button
            title={sp.summary}
            onClick={() => select(sp.id)}
            style={{ paddingLeft: 4 + INDENT }}
            className={cn('flex w-full items-center gap-1.5 border-l-2 py-1 pr-2 text-left text-[13px]', selected === sp.id ? 'border-l-accent bg-accent/[0.08] text-white' : 'border-l-transparent text-white/70 hover:bg-white/[0.03]')}
          >
            <span className="h-4 w-4 shrink-0" />
            <KindIcon name="file-text" className={cn('h-3.5 w-3.5 shrink-0', selected === sp.id ? 'text-accent' : 'text-faint')} />
            <span className="min-w-0 flex-1 truncate">{sp.title}</span>
          </button>
        )
      })
  const openPage = useOpenPage()
  const listWidth = useApp((s) => s.settings?.pagesWidth ?? 288)
  const kind = current ? pageKindOf(current.type) : null
  const Screen = kind ? presentOf(kind).Screen : undefined

  return (
    <div className="h-full min-h-0">
    <Split>
      <SidePane id="pages" width={listWidth} min={200} max={640} reset={288} onWidth={(w) => void useApp.getState().updateSettings({ pagesWidth: w })}>
      <aside className="panel-box flex h-full w-full flex-col">
        <PaneHeader title="Pages" titleHint="Top level" count={pages.length} onTitle={() => select(null)} onTitleMenu={(e) => kindMenuAt(e, section, selectData)} back={onBack ? { label: 'All kinds', onClick: onBack } : undefined}>
          <Button size="sm" variant="ghost" icon={<FolderPlus />} title="New folder" onClick={() => askNewFolder(made(null))} />
          <Button size="sm" variant="ghost" icon={<Plus />} title="New page" onClick={(e) => newPageMenu(e, types, made(null))} />
          <Button size="sm" variant="ghost" icon={<Download />} title="Export" onClick={(e) => exportMenuAt(e, section, openPage)} />
        </PaneHeader>
        <div className="px-2 pt-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setFilter('')}
            placeholder="Filter by name"
            spellCheck={false}
            className="h-7 w-full border border-line/40 bg-transparent px-2 text-[12.5px] text-white outline-none placeholder:text-faint focus:border-accent/50"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {[
              { id: ALL, label: 'All' },
              ...(tagList.length ? [{ id: BY_TAG, label: 'By tag' }] : []),
              ...tagList.map(([t, n]) => ({ id: t, label: `#${t} ${n}` }))
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setTab(pill.id)}
                className={cn('border px-1.5 py-0.5 font-mono text-[10.5px]', tab === pill.id ? 'border-accent bg-accent/15 text-white' : 'border-line/50 text-dim hover:border-accent/60 hover:text-white')}
              >
                {pill.label}
              </button>
            ))}
          </div>
          {picked.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1 border border-teal/40 bg-teal/[0.06] px-1.5 py-1">
              <span className="flex-1 font-mono text-[10.5px] text-teal">{picked.length} picked</span>
              <button title="Tags" onClick={bulkTags} className="flex h-6 w-6 items-center justify-center text-dim hover:text-accent">
                <Hash className="h-3.5 w-3.5" />
              </button>
              <button title="Move under a page" onClick={bulkMove} className="flex h-6 w-6 items-center justify-center text-dim hover:text-accent">
                <FolderInput className="h-3.5 w-3.5" />
              </button>
              <button title="Move to top level" onClick={bulkTop} className="flex h-6 w-6 items-center justify-center text-dim hover:text-accent">
                <ArrowUpToLine className="h-3.5 w-3.5" />
              </button>
              <button title="Clear selection" onClick={() => setPicked([])} className="flex h-6 w-6 items-center justify-center text-dim hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        <div
          ref={scroller}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1.5"
          onContextMenu={(e) => openMenu(e, 'Pages', folderNewItems(types, made(null)))}
          onDragOver={(e) => {
            if (!isEntryDrag(e)) return
            e.preventDefault()
            setOver(ROOT)
          }}
          onDrop={drop(null)}
        >
          <VirtualList count={lines.length} scroller={scroller} estimate={26} overscan={16} keyOf={(i) => lines[i].key}>
            {(i) => lines[i].node()}
          </VirtualList>
          {visible && visible.size === 0 && <div className="px-3 py-1.5 text-[12px] text-faint">Nothing matches "{filter.trim()}".</div>}
          {(over === ROOT || dragging.some((id) => (byId.get(id)?.parent ?? null) !== null)) && (
            <div className={cn('mx-2 mt-2 border border-dashed px-2 py-2 text-center font-mono text-[10.5px] uppercase tracking-[0.14em]', over === ROOT ? 'border-accent/60 text-accent' : 'border-line/50 text-faint')}>
              Drop here for the top level
            </div>
          )}
          <div className="min-h-6 flex-1" />
        </div>
      </aside>
      </SidePane>
      <Gutter resets="pages" />
      <MainPane id="page">
      <section className="flex h-full min-w-0 flex-1 flex-col gap-2">
        {current && current.type === FOLDER_TYPE ? (
          <>
            <FolderPath trail={path} current={showName(current.title)} onPick={select}>
              <CopyLinkButton kind={pageKindOf(current.type)} id={current.id} />
            </FolderPath>
            <PageExplorer key={current.id} folder={current.id} onOpen={(id) => select(id)} onMenu={menu} />
          </>
        ) : current ? (
          <>
            <FolderPath trail={path} current={showName(current.title)} onPick={select}>
              <CopyLinkButton kind={pageKindOf(current.type)} id={current.id} />
            </FolderPath>
            <ReadingPane>{Screen ? <Screen key={current.id} kind={kind!} id={current.id} select={screenSelect} /> : <EmptyState title="No view">This kind has no screen of its own.</EmptyState>}</ReadingPane>
          </>
        ) : special ? (
          <>
            <nav className="flex min-w-0 items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em]">
              <button onClick={() => select(INDEX_ID)} className="shrink-0 text-accent-soft hover:text-white">
                {INDEX_TITLE}
              </button>
              <ChevronRight className="h-3 w-3 shrink-0 text-faint" />
              <span className="text-accent-soft">Seven</span>
              <ChevronRight className="h-3 w-3 shrink-0 text-faint" />
              <span className="truncate text-white">{special.title}</span>
              <span className="ml-2 normal-case tracking-normal text-faint">generated, read only</span>
            </nav>
            <div className="flex min-h-0 flex-1 flex-col">
              <GeneratedPage key={special.id} id={special.id} onEntry={openLink} />
            </div>
          </>
        ) : selected === INDEX_ID ? (
          <>
            <nav className="flex min-w-0 items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em]">
              <button title="Top level" onClick={() => select(null)} className="shrink-0 text-accent-soft hover:text-white">
                /
              </button>
              <span className="text-white">{INDEX_TITLE}</span>
              <span className="ml-2 normal-case tracking-normal text-faint">every folder and page</span>
            </nav>
            <div className="flex min-h-0 flex-1 flex-col">
              <GeneratedPage id={INDEX_ID} onEntry={openLink} />
            </div>
          </>
        ) : (
          <PageExplorer
            folder={null}
            onOpen={(id) => select(id)}
            onMenu={menu}
            header={
              <>
                <span className="font-mono text-[12px] text-accent-soft">/</span>
                <button onClick={() => select(INDEX_ID)} className="ml-2 flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-dim hover:text-white">
                  <BookOpen className="h-3.5 w-3.5" />
                  {INDEX_TITLE}
                </button>
              </>
            }
          />
        )}
      </section>
      </MainPane>
    </Split>
    </div>
  )
}
