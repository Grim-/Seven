import { useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { ArrowDownAZ, Clock, GalleryVertical, LayoutGrid, LayoutPanelTop, List, SquareStack } from 'lucide-react'
import { cn } from '../../lib/cn'
import { openMenu, type MenuItem } from './ContextMenu'
import { pickWith, type Picking } from '../../lib/picking'
import { dragEntries, droppedEntries, isEntryDrag } from '../../lib/entryDrag'
import { ShellCards } from './ShellCards'
import { ShellRows } from './ShellRows'
import { ShellTiles } from './ShellTiles'
import { ShellGallery } from './ShellGallery'
import { ShellDeck } from './ShellDeck'
import { SliderNumber } from './SliderNumber'
import type { ShellAdd, ShellBinding, ShellGroup, ShellItem, ShellLayout, ShellSort, ShellViewProps } from './shellTypes'

export type { ShellAdd, ShellGroup, ShellItem, ShellLayout, ShellSort } from './shellTypes'

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

function read(id: string): { layout?: string; sort?: string; size?: number } | null {
  try {
    const raw = localStorage.getItem(`seven.shell.${id}`)
    return raw ? (JSON.parse(raw) as { layout?: string; sort?: string; size?: number }) : null
  } catch {
    return null
  }
}

function load(ids: string[], layouts: ShellLayout[], sorts: ShellSort[]): Saved {
  const raw = ids.map(read).find(Boolean) ?? {}
  const layout = (raw.layout === 'grid' ? 'tiles' : raw.layout) as ShellLayout
  return {
    layout: layouts.includes(layout) ? layout : layouts[0],
    sort: sorts.some((s) => s.id === raw.sort) ? (raw.sort as string) : sorts[0].id,
    size: typeof raw.size === 'number' && raw.size > 0 ? raw.size : 100
  }
}

function store(ids: string[], value: Saved): void {
  try {
    for (const id of ids) localStorage.setItem(`seven.shell.${id}`, JSON.stringify(value))
  } catch {
    return
  }
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
        active ? 'text-accent' : 'text-dim hover:text-white'
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
  const [dragging, setDragging] = useState<string[]>([])
  const [picking, setPicking] = useState<Picking>({ picked: [], anchor: null })
  const [over, setOver] = useState<string | null>(null)
  const update = (next: Partial<Saved>) => {
    const value = { ...saved, ...next }
    setSaved(value)
    store(ids, value)
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? items.filter(
          (i) =>
            i.title.toLowerCase().includes(q) ||
            i.subtitle?.toLowerCase().includes(q) ||
            i.excerpt?.toLowerCase().includes(q)
        )
      : [...items]
    const sort = sorts.find((s) => s.id === saved.sort) ?? sorts[0]
    return list.sort((a, b) => (a.group ?? 0) - (b.group ?? 0) || sort.compare(a, b))
  }, [items, query, saved.sort, sorts])

  const layout = layouts.includes(saved.layout) ? saved.layout : layouts[0]
  const View = LAYOUTS[layout].View
  const picked = picking.picked.filter((k) => shown.some((i) => i.key === k))
  const withPicked = (item: ShellItem) => (picked.includes(item.key) ? picked : [item.key])
  const bind = (item: ShellItem): ShellBinding => ({
    props: {
      ...drag(item),
      onClick: (e: React.MouseEvent) => {
        const next = pickable ? pickWith(e, item.key, { ...picking, picked, selected: null, order: shown.map((i) => i.key) }) : null
        if (next) return setPicking(next)
        setPicking({ picked: [], anchor: item.key })
        onOpen?.(item, shown)
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

  return (
    <div className="flex min-h-0 flex-1 flex-col border border-line/60 bg-black/70">
      <div className="flex shrink-0 items-center gap-2 border-b border-line/40 px-2.5 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">{header}</div>
        {filter && <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
          placeholder="Filter"
          spellCheck={false}
          className="h-6 w-40 border border-line/40 bg-transparent px-2 text-[12px] text-white outline-none placeholder:text-faint focus:border-accent/50"
        />}
        {sorts.map((s) => (
          <ToolButton key={s.id} title={s.title} active={saved.sort === s.id} onClick={() => update({ sort: s.id })}>
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
                <div className="flex items-baseline gap-2 border-b border-line/40 pb-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-accent-soft">
                  {g.label}
                  <span className="font-normal text-faint">{inGroup.length}</span>
                </div>
                {g.note && <div className="text-[11.5px] leading-snug text-dim">{g.note}</div>}
                {inGroup.length || (!query && g.adds?.length) ? (
                  <View items={inGroup} adds={query ? [] : (g.adds ?? [])} bind={bind} scale={saved.size / 100} asideLabel={asideLabel} />
                ) : (
                  <div className="text-[12px] text-faint">{query ? 'No matches.' : 'None yet.'}</div>
                )}
              </section>
            )
          })
        ) : (
          <View items={shown} adds={query ? [] : adds} bind={bind} scale={saved.size / 100} asideLabel={asideLabel} />
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
