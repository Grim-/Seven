import { useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { ArrowDownAZ, Clock, GalleryVertical, LayoutGrid, LayoutPanelTop, List, SquareStack } from 'lucide-react'
import { cn } from '../../lib/cn'
import { openMenu, type MenuItem } from './ContextMenu'
import { pickWith, type Picking } from '../../lib/picking'
import { dragEntries, droppedEntries, isEntryDrag } from '../../lib/entryDrag'
import { getTransitionId, setTransitionId, transitionView } from '../../lib/viewTransition'
import { ShellCards } from './ShellCards'
import { ShellRows } from './ShellRows'
import { ShellTiles } from './ShellTiles'
import { ShellGallery } from './ShellGallery'
import { ShellDeck } from './ShellDeck'
import { SliderNumber } from './SliderNumber'
import { TokenFilterInput, parseTokenFilter, type FilterOption } from './TokenFilterInput'
import type { ShellAdd, ShellBinding, ShellColumnKey, ShellColumnSort, ShellGroup, ShellItem, ShellLayout, ShellSort, ShellViewProps } from './shellTypes'
import { readStored, writeStored } from '../../lib/stored'

export type { ShellAdd, ShellGroup, ShellItem, ShellLayout, ShellSort } from './shellTypes'

const METRIC_MULT: Record<string, number> = {
  b: 1,
  kb: 1024,
  k: 1e3,
  mb: 1024 ** 2,
  m: 1e6,
  gb: 1024 ** 3,
  g: 1e9,
  tb: 1024 ** 4,
  t: 1e12
}

function parseAsideSortValue(item: ShellItem): number | null {
  if (typeof item.aside === 'string' && item.aside.trim()) {
    const m = item.aside.trim().match(/^([\d,.]+)\s*(tb|gb|mb|kb|b|t|g|m|k)?$/i)
    if (m) {
      const n = Number(m[1].replace(/,/g, ''))
      const unit = (m[2] ?? '').toLowerCase()
      if (Number.isFinite(n)) return n * (METRIC_MULT[unit] ?? 1)
    }
    return null
  }
  return item.updatedAt ?? null
}

function compareByColumn(a: ShellItem, b: ShellItem, col: ShellColumnKey, sorts: ShellSort[]): number {
  if (col === 'name') {
    const nameSort = sorts.find((s) => s.id === 'name')
    return nameSort ? nameSort.compare(a, b) : a.title.localeCompare(b.title)
  }
  if (col === 'type') return (a.tag ?? '').localeCompare(b.tag ?? '') || a.title.localeCompare(b.title)
  if (col === 'contents') return (a.subtitle ?? '').localeCompare(b.subtitle ?? '') || a.title.localeCompare(b.title)
  const na = parseAsideSortValue(a)
  const nb = parseAsideSortValue(b)
  if (na !== null && nb !== null) return na - nb || a.title.localeCompare(b.title)
  if (na !== null) return 1
  if (nb !== null) return -1
  return (a.aside ?? '').localeCompare(b.aside ?? '') || a.title.localeCompare(b.title)
}

export function menuAdds(items: MenuItem[]): ShellAdd[] {
  return items.map((item) => ({
    label: item.label,
    icon: item.icon,
    onClick: (e) => (item.children ? openMenu(e, item.label, item.children) : item.onSelect?.()),
    ...(item.children ? { children: item.children } : {})
  }))
}

function addMenu(e: React.MouseEvent, adds: ShellAdd[]): void {
  if (!adds.length) return
  openMenu(
    e,
    'New',
    adds.map((a) =>
      a.children
        ? { label: a.label, icon: a.icon, children: a.children }
        : { label: a.label, icon: a.icon, onSelect: () => a.onClick(e) }
    )
  )
}

interface Saved {
  layout: ShellLayout
  sort: string
  sortDir?: 'asc' | 'desc'
  colSort?: ShellColumnSort | null
  size: number
}

export const DEFAULT_SORTS: ShellSort[] = [
  { id: 'name', title: 'Sort by name', icon: <ArrowDownAZ className="h-3.5 w-3.5" />, compare: (a, b) => a.title.localeCompare(b.title) },
  { id: 'recent', title: 'Newest first', icon: <Clock className="h-3.5 w-3.5" />, compare: (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0) }
]

const LAYOUTS: Record<ShellLayout, { title: string; icon: ReactNode; View: ComponentType<ShellViewProps> }> = {
  tiles: { title: 'Tiles', icon: <LayoutGrid className="h-3.5 w-3.5" />, View: ShellTiles },
  cards: { title: 'Cards', icon: <LayoutPanelTop className="h-3.5 w-3.5" />, View: ShellCards },
  list: { title: 'List', icon: <List className="h-3.5 w-3.5" />, View: ShellRows },
  gallery: { title: 'Gallery', icon: <GalleryVertical className="h-3.5 w-3.5" />, View: ShellGallery },
  deck: { title: 'Deck', icon: <SquareStack className="h-3.5 w-3.5" />, View: ShellDeck }
}

function read(id: string): Partial<Saved> | null {
  return readStored<Partial<Saved> | null>(`seven.shell.${id}`, null)
}

function load(ids: string[], layouts: ShellLayout[], sorts: ShellSort[]): Saved {
  const raw = ids.map(read).find(Boolean) ?? {}
  const rawLayout = raw.layout as string | undefined
  const layout = (rawLayout === 'grid' ? 'tiles' : rawLayout) as ShellLayout
  return {
    layout: layouts.includes(layout) ? layout : layouts[0],
    sort: sorts.some((s) => s.id === raw.sort) ? (raw.sort as string) : sorts[0].id,
    sortDir: raw.sortDir === 'desc' ? 'desc' : 'asc',
    colSort: raw.colSort ?? null,
    size: typeof raw.size === 'number' && raw.size > 0 ? raw.size : 100
  }
}

function store(id: string, value: Saved): void {
  writeStored(`seven.shell.${id}`, value)
}

function ToolButton({
  title,
  active,
  onClick,
  children
}: {
  title: string
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        'flex h-6 w-6 items-center justify-center',
        active ? 'text-accent' : 'text-dim hover:text-ink'
      )}
    >
      {children}
    </button>
  )
}

export function KindShell({
  id,
  inherit,
  items,
  adds = [],
  header,
  selectionBar,
  empty = 'Nothing here yet.',
  onOpen,
  onMenu,
  onDouble,
  onMove,
  dragOut = false,
  pickable = false,
  layouts = ['cards', 'list'],
  sorts = DEFAULT_SORTS,
  filter = true,
  groups,
  asideLabel = 'Changed'
}: {
  id: string
  inherit?: string
  items: ShellItem[]
  adds?: ShellAdd[]
  header?: ReactNode
  selectionBar?: (picked: string[], actions: { selectAll: () => void; clear: () => void }) => ReactNode
  empty?: string
  onOpen?: (item: ShellItem, shown: ShellItem[]) => void
  onMenu?: (e: React.MouseEvent, item: ShellItem, picked: string[]) => void
  onDouble?: (item: ShellItem) => void
  onMove?: (keys: string[], target: string) => void
  dragOut?: boolean
  pickable?: boolean
  layouts?: ShellLayout[]
  sorts?: ShellSort[]
  filter?: boolean
  groups?: ShellGroup[]
  asideLabel?: string
}) {
  const ids = inherit ? [id, inherit] : [id]
  const [saved, setSaved] = useState<Saved>(() => load(ids, layouts, sorts))
  const [query, setQuery] = useState('')
  const [typeFilters, setTypeFilters] = useState<string[]>([])
  const [tagFilters, setTagFilters] = useState<string[]>([])
  const [dragging, setDragging] = useState<string[]>([])
  const [picking, setPicking] = useState<Picking>({ picked: [], anchor: null })
  const [over, setOver] = useState<string | null>(null)
  const update = (next: Partial<Saved>) => {
    const value = { ...saved, ...next }
    setSaved(value)
    store(id, value)
  }

  const parsedFilter = useMemo(() => parseTokenFilter(query), [query])
  const activeTypes = useMemo(() => [...new Set([...typeFilters, ...parsedFilter.types])], [typeFilters, parsedFilter.types])
  const activeTags = useMemo(() => [...new Set([...tagFilters, ...parsedFilter.tags])], [tagFilters, parsedFilter.tags])

  const { typeOptions, tagOptions } = useMemo(() => {
    const typeCounts = new Map<string, number>()
    const tagCounts = new Map<string, number>()
    for (const item of items) {
      const k = (item.kind ?? item.tag ?? '').trim().toLowerCase()
      if (k) typeCounts.set(k, (typeCounts.get(k) ?? 0) + 1)
      for (const t of item.tags ?? []) {
        const low = t.trim().toLowerCase()
        if (low) tagCounts.set(low, (tagCounts.get(low) ?? 0) + 1)
      }
    }
    const typeOpts: FilterOption[] =
      typeCounts.size > 1
        ? [...typeCounts.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
        : []
    const tagOpts: FilterOption[] = [...tagCounts.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    return { typeOptions: typeOpts, tagOptions: tagOpts }
  }, [items])

  const activeColumnSort: ShellColumnSort | null = useMemo(() => {
    if (saved.colSort) return saved.colSort
    const rev = saved.sortDir === 'desc'
    if (saved.sort === 'name') return { column: 'name', dir: rev ? 'desc' : 'asc' }
    if (saved.sort === 'size-desc' || saved.sort === 'recent' || saved.sort === 'downloads' || saved.sort === 'updated') {
      return { column: 'aside', dir: rev ? 'asc' : 'desc' }
    }
    if (saved.sort === 'size-asc') return { column: 'aside', dir: rev ? 'desc' : 'asc' }
    return null
  }, [saved.colSort, saved.sort, saved.sortDir])

  const shown = useMemo(() => {
    const q = parsedFilter.text
    const list =
      q || activeTypes.length > 0 || activeTags.length > 0
        ? items.filter((i) => {
            if (activeTypes.length > 0) {
              const k = (i.kind ?? i.tag ?? '').trim().toLowerCase()
              if (!activeTypes.includes(k)) return false
            }
            if (activeTags.length > 0) {
              const iTags = (i.tags ?? []).map((t) => t.trim().toLowerCase())
              if (!activeTags.every((t) => iTags.includes(t))) return false
            }
            if (!q) return true
            return (
              i.title.toLowerCase().includes(q) ||
              i.subtitle?.toLowerCase().includes(q) ||
              i.excerpt?.toLowerCase().includes(q)
            )
          })
        : [...items]
    if (saved.colSort) {
      const mul = saved.colSort.dir === 'desc' ? -1 : 1
      return list.sort((a, b) => (a.group ?? 0) - (b.group ?? 0) || mul * compareByColumn(a, b, saved.colSort!.column, sorts))
    }
    const sort = sorts.find((s) => s.id === saved.sort) ?? sorts[0]
    const mul = saved.sortDir === 'desc' ? -1 : 1
    return list.sort((a, b) => (a.group ?? 0) - (b.group ?? 0) || mul * sort.compare(a, b))
  }, [items, parsedFilter.text, activeTypes, activeTags, saved.sort, saved.sortDir, saved.colSort, sorts])

  const handleToolbarSort = (sortId: string) => {
    if (!saved.colSort && saved.sort === sortId) {
      update({ sortDir: saved.sortDir === 'desc' ? 'asc' : 'desc' })
    } else {
      update({ sort: sortId, sortDir: 'asc', colSort: null })
    }
  }

  const handleColumnSort = (column: ShellColumnKey) => {
    if (activeColumnSort?.column === column) {
      const nextDir = activeColumnSort.dir === 'asc' ? 'desc' : 'asc'
      update({ colSort: { column, dir: nextDir } })
    } else {
      update({ colSort: { column, dir: column === 'aside' ? 'desc' : 'asc' } })
    }
  }

  const layout = layouts.includes(saved.layout) ? saved.layout : layouts[0]
  const View = LAYOUTS[layout].View
  const picked = picking.picked.filter((k) => shown.some((i) => i.key === k))
  const withPicked = (item: ShellItem) => (picked.includes(item.key) ? picked : [item.key])
  const tid = getTransitionId()
  const bind = (item: ShellItem): ShellBinding => ({
    props: {
      ...drag(item),
      style: tid === item.key ? ({ viewTransitionName: 'active-entry' } as React.CSSProperties) : undefined,
      onClick: (e: React.MouseEvent) => {
        const next = pickable ? pickWith(e, item.key, { ...picking, picked, selected: null, order: shown.map((i) => i.key) }) : null
        if (next) return setPicking(next)
        setPicking({ picked: [], anchor: item.key })
        setTransitionId(item.key)
        transitionView(() => onOpen?.(item, shown), item.key)
      },
      onContextMenu: (e: React.MouseEvent) => onMenu?.(e, item, withPicked(item)),
      onDoubleClick: () => onDouble?.(item)
    },
    over: over === item.key,
    dragging: dragging.includes(item.key),
    picked: picked.includes(item.key)
  })
  const drag = (item: ShellItem) =>
    onMove || dragOut
      ? {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            const keys = withPicked(item)
            dragEntries(e, keys)
            setDragging(keys)
          },
          onDragEnd: () => {
            setDragging([])
            setOver(null)
          },
          ...(item.target && onMove
            ? {
                onDragOver: (e: React.DragEvent) => {
                  if (!isEntryDrag(e) || dragging.includes(item.key)) return
                  e.preventDefault()
                  e.stopPropagation()
                  setOver(item.key)
                },
                onDragLeave: () => setOver((o) => (o === item.key ? null : o)),
                onDrop: (e: React.DragEvent) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const keys = droppedEntries(e).filter((k) => k !== item.key)
                  setDragging([])
                  setOver(null)
                  setPicking({ picked: [], anchor: null })
                  if (keys.length) onMove(keys, item.key)
                }
              }
            : {})
        }
      : {}

  const selectAll = () => setPicking({ picked: shown.map((i) => i.key), anchor: shown[0]?.key ?? null })
  const clearSelection = () => setPicking({ picked: [], anchor: null })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!pickable) return
    const target = e.target as HTMLElement | null
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      selectAll()
    } else if (e.key === 'Escape' && picked.length) {
      e.preventDefault()
      clearSelection()
    }
  }

  return (
    <div
      tabIndex={pickable ? -1 : undefined}
      onKeyDown={handleKeyDown}
      className="flex min-h-0 flex-1 flex-col border border-line/60 tone-panel-70 outline-none"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-line/40 px-2.5 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {pickable && picked.length > 0 && selectionBar ? (
            selectionBar(picked, { selectAll, clear: clearSelection })
          ) : (
            <>
              {header}
              {pickable && selectionBar && shown.length > 0 && (
                <button
                  type="button"
                  onClick={selectAll}
                  title="Select all items (Ctrl+A · Ctrl+click · Shift+click)"
                  className="border border-line/50 px-2 py-0.5 font-ui text-[10.5px] text-dim hover:border-accent/50 hover:text-accent"
                >
                  Select all
                </button>
              )}
            </>
          )}
        </div>
        {filter && (
          <TokenFilterInput
            compact
            value={query}
            onChange={setQuery}
            types={typeFilters}
            onTypesChange={setTypeFilters}
            tags={tagFilters}
            onTagsChange={setTagFilters}
            typeOptions={typeOptions}
            tagOptions={tagOptions}
            placeholder={typeOptions.length || tagOptions.length ? 'Filter, type: or #tag' : 'Filter'}
            className="min-w-[10rem] max-w-[20rem]"
          />
        )}
        {sorts.map((s) => (
          <ToolButton key={s.id} title={s.title} active={!saved.colSort && saved.sort === s.id} onClick={() => handleToolbarSort(s.id)}>
            {s.icon}
          </ToolButton>
        ))}
        <span className="h-4 w-px bg-line/40" />
        <span className="text-[11.5px] text-faint">Size</span>
        <SliderNumber value={saved.size} min={25} max={400} step={5} onChange={(size) => size > 0 && update({ size })} className="w-44" />
        {layouts.length > 1 && <span className="h-4 w-px bg-line/40" />}
        {layouts.length > 1 &&
          layouts.map((l) => (
            <ToolButton
              key={l}
              title={LAYOUTS[l].title}
              active={layout === l}
              onClick={() => update({ layout: l })}
            >
              {LAYOUTS[l].icon}
            </ToolButton>
          ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5" onContextMenu={(e) => addMenu(e, [...adds, ...(groups ?? []).flatMap((g) => g.adds ?? [])])}>
        {groups ? (
          groups.map((g, i) => {
            const inGroup = shown.filter((item) => (item.group ?? 0) === i)
            return (
              <section key={g.label} className="mb-4 flex flex-col gap-2">
                <div className="flex items-baseline gap-2 border-b border-line/40 pb-1 font-label text-[10.5px] font-bold caps-16 text-accent-soft">
                  {g.label}
                  <span className="font-normal text-faint">{inGroup.length}</span>
                </div>
                {g.note && <div className="text-[11.5px] leading-snug text-dim">{g.note}</div>}
                {inGroup.length || (!query && g.adds?.length) ? (
                  <View shellId={id} items={inGroup} adds={query ? [] : (g.adds ?? [])} bind={bind} scale={saved.size / 100} asideLabel={asideLabel} columnSort={activeColumnSort} onColumnSort={handleColumnSort} />
                ) : (
                  <div className="text-[12px] text-faint">{query ? 'No matches.' : 'None yet.'}</div>
                )}
              </section>
            )
          })
        ) : (
          <View shellId={id} items={shown} adds={query ? [] : adds} bind={bind} scale={saved.size / 100} asideLabel={asideLabel} columnSort={activeColumnSort} onColumnSort={handleColumnSort} />
        )}
        {!groups && !shown.length && (
          <div className="px-1 py-3 text-[12.5px] text-faint">
            {query ? `Nothing matches "${query.trim()}".` : adds.length ? '' : empty}
          </div>
        )}
      </div>
    </div>
  )
}
