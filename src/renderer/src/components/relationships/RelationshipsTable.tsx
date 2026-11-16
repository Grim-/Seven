import { useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { ExternalLink, Link2, Pencil, Pin, Plus, Trash2 } from 'lucide-react'
import {
  linkTagOf,
  parseLinkRef,
  stanceMeta,
  type RelationCategory,
  type RelationStance,
  type RelationshipEntry
} from '@shared/relationships'
import { Button, EmptyState, Eyebrow, Fold, GridRow, GridTable, SearchBox, askConfirm, openMenu, type GridColumn, type MenuEvent, type MenuItem } from '../ui'
import { cn } from '../../lib/cn'
import { copyText } from '../../lib/notify'
import { openEntry } from '../../lib/library'
import { RelationshipEditor } from './RelationshipEditor'
import { CATEGORY_UIS, STANCE_UIS, categoryUi, stanceUi } from './styles'

export interface InheritedRelationships {
  id: string
  title: string
  items: RelationshipEntry[]
  onOpen?: () => void
}

function menuEventFrom(e: MouseEvent): MenuEvent {
  return { preventDefault() {}, stopPropagation() {}, clientX: e.clientX, clientY: e.clientY }
}

function SortableColumns(compact: boolean, sort: 'name' | 'stance' | 'recent', dir: 'asc' | 'desc', onSort: (col: 'name' | 'stance' | 'recent') => void): GridColumn[] {
  if (compact) {
    return [
      { label: 'Target', width: 'minmax(0,1.4fr)', sorted: sort === 'name' ? dir : null, onSort: () => onSort('name') },
      { label: 'Stance', width: 'minmax(0,1fr)', sorted: sort === 'stance' ? dir : null, onSort: () => onSort('stance') },
      { label: '', width: '3.25rem', right: true }
    ]
  }
  return [
    { label: 'Target', width: 'minmax(11rem,1.4fr)', sorted: sort === 'name' ? dir : null, onSort: () => onSort('name') },
    { label: 'Bond / Role', width: 'minmax(7rem,0.9fr)' },
    { label: 'Stance', width: 'minmax(7.5rem,0.8fr)', sorted: sort === 'stance' ? dir : null, onSort: () => onSort('stance') },
    { label: 'Notes', width: 'minmax(10rem,1.8fr)' },
    { label: '', width: '5rem', right: true }
  ]
}

export function RelationshipsTable({
  items,
  onChange,
  compact = false,
  readOnly = false,
  emptyHint = 'No relationships yet. Track characters, places, items, factions, or concepts.',
  inherited
}: {
  items: RelationshipEntry[]
  onChange?: (next: RelationshipEntry[]) => void
  compact?: boolean
  readOnly?: boolean
  emptyHint?: string
  inherited?: InheritedRelationships[]
}) {
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<RelationCategory | 'all'>('all')
  const [sort, setSort] = useState<'name' | 'stance' | 'recent'>('recent')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<RelationshipEntry | null | 'new'>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const toggleSort = (col: 'name' | 'stance' | 'recent') => {
    if (sort === col) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(col)
      setDir(col === 'name' ? 'asc' : 'desc')
    }
  }

  const stanceOrder = useMemo(() => new Map(STANCE_UIS.map((s, i) => [s.id, i])), [])
  const categoryCounts = useMemo(() => {
    const counts = new Map<RelationCategory, number>()
    for (const item of items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1)
    return counts
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = items.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
      if (!q) return true
      return [item.target, item.role, item.notes, item.category, item.stance, ...(item.tags ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
    return [...list].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      let cmp = 0
      if (sort === 'name') cmp = a.target.localeCompare(b.target)
      else if (sort === 'stance') cmp = (stanceOrder.get(a.stance) ?? 3) - (stanceOrder.get(b.stance) ?? 3)
      else cmp = a.updatedAt - b.updatedAt
      return dir === 'asc' ? cmp : -cmp
    })
  }, [items, categoryFilter, query, sort, dir, stanceOrder])

  const updateItem = (nextEntry: RelationshipEntry) => {
    if (!onChange) return
    const exists = items.some((x) => x.id === nextEntry.id)
    onChange(exists ? items.map((x) => (x.id === nextEntry.id ? nextEntry : x)) : [...items, nextEntry])
  }

  const removeItem = (entry: RelationshipEntry) => {
    if (!onChange) return
    askConfirm(`Remove relationship with ${entry.target}?`, 'It will no longer appear in prompts or recall.', 'Remove', () => {
      onChange(items.filter((x) => x.id !== entry.id))
      if (selectedId === entry.id) setSelectedId(null)
    })
  }

  const setStance = (entry: RelationshipEntry, stance: RelationStance) => {
    updateItem({
      ...entry,
      stance,
      ...(typeof entry.affinity === 'number' ? { affinity: stanceMeta(stance).defaultAffinity } : {}),
      updatedAt: Date.now()
    })
  }

  const rowMenuItems = (entry: RelationshipEntry): MenuItem[] => {
    const parsed = entry.ref ? parseLinkRef(entry.ref) : null
    const stanceItems: MenuItem[] = STANCE_UIS.map((s) => ({
      label: `${s.id === entry.stance ? '✓ ' : ''}${s.label}`,
      onSelect: () => setStance(entry, s.id)
    }))
    return [
      ...(parsed ? [{ label: `Open ${entry.target}`, icon: <ExternalLink />, onSelect: () => openEntry(parsed.kind, parsed.id) }] : []),
      ...(entry.ref ? [{ label: 'Copy @link', icon: <Link2 />, onSelect: () => copyText(linkTagOf(entry.ref!), 'Link copied') }] : []),
      ...(!readOnly && onChange
        ? [
            { label: 'Edit', icon: <Pencil />, onSelect: () => setEditing(entry) },
            { label: 'Set stance', children: stanceItems },
            {
              label: entry.pinned ? 'Unpin from prompt' : 'Pin to prompt',
              icon: <Pin />,
              onSelect: () => updateItem({ ...entry, pinned: entry.pinned ? undefined : true, updatedAt: Date.now() })
            },
            { label: 'Remove', icon: <Trash2 />, danger: true, onSelect: () => removeItem(entry) }
          ]
        : [])
    ]
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement | null)?.tagName
    const typing = tag === 'INPUT' || tag === 'TEXTAREA'
    if (typing) return
    if (e.key === '/') {
      e.preventDefault()
      rootRef.current?.querySelector<HTMLInputElement>('input[type="search"], input[placeholder*="Filter"]')?.focus()
      return
    }
    const sel = selectedId ? filtered.find((x) => x.id === selectedId) : null
    if (!sel || readOnly) return
    if (e.key === 'Enter') {
      e.preventDefault()
      setEditing(sel)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      removeItem(sel)
    }
  }

  const columns = SortableColumns(compact, sort, dir, toggleSort)

  return (
    <div ref={rootRef} tabIndex={0} onKeyDown={onKeyDown} className="flex min-w-0 flex-col gap-3 outline-none">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[11rem] flex-1">
          <SearchBox value={query} onChange={setQuery} placeholder="Filter relationships… (/)" />
        </div>
        {!readOnly && onChange && (
          <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setEditing('new')}>
            Add relationship
          </Button>
        )}
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={cn(
              'border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors',
              categoryFilter === 'all' ? 'border-accent bg-accent/15 text-accent' : 'border-line/50 text-dim hover:border-line hover:text-white'
            )}
          >
            All ({items.length})
          </button>
          {CATEGORY_UIS.map(({ id, plural, Icon, chipClass }) => {
            const count = categoryCounts.get(id) ?? 0
            if (compact && count === 0) return null
            const on = categoryFilter === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCategoryFilter(id)}
                className={cn(
                  'flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors',
                  on ? chipClass : 'border-line/40 text-dim hover:border-line hover:text-white',
                  count === 0 && !on && 'opacity-50'
                )}
              >
                <Icon className="h-3 w-3" />
                {plural}
                {count > 0 && <span className="opacity-75">{count}</span>}
              </button>
            )
          })}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="No relationships yet"
          action={
            !readOnly && onChange ? (
              <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setEditing('new')}>
                Add first relationship
              </Button>
            ) : undefined
          }
        >
          {emptyHint}
        </EmptyState>
      ) : (
        <div className="border border-line/40 bg-black/30">
          <GridTable columns={columns} empty={filtered.length === 0 && 'No relationships match that filter.'}>
            {filtered.map((entry) => {
              const cat = categoryUi(entry.category)
              const st = stanceUi(entry.stance)
              const parsed = entry.ref ? parseLinkRef(entry.ref) : null
              const CatIcon = cat.Icon
              return (
                <GridRow
                  key={entry.id}
                  selected={selectedId === entry.id}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setSelectedId(entry.id)
                    openMenu(menuEventFrom(e), entry.target, rowMenuItems(entry))
                  }}
                >
                  <div
                    onClick={() => setSelectedId(entry.id)}
                    onDoubleClick={() => {
                      if (!readOnly && onChange) setEditing(entry)
                    }}
                    className="flex min-w-0 items-center gap-2 py-0.5"
                  >
                    <span title={cat.label} className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center border', cat.chipClass)}>
                      <CatIcon className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {parsed ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEntry(parsed.kind, parsed.id)
                            }}
                            title={`Open ${linkTagOf(entry.ref!)}`}
                            className="truncate text-left text-[13px] font-medium text-teal hover:underline"
                          >
                            {entry.target}
                          </button>
                        ) : (
                          <span className="truncate text-[13px] font-medium text-white/95">{entry.target}</span>
                        )}
                        {entry.pinned && (
                          <span title="Pinned to default prompt" className="inline-flex shrink-0 text-accent">
                            <Pin className="h-3 w-3" />
                          </span>
                        )}
                        {entry.secret && <span className="border border-purple/40 bg-purple/10 px-1 font-mono text-[9px] uppercase text-purple">secret</span>}
                      </div>
                      {compact && (entry.role || entry.notes) && (
                        <div className="truncate text-[11px] text-dim">{[entry.role, entry.notes].filter(Boolean).join(' — ')}</div>
                      )}
                    </div>
                  </div>

                  {!compact && (
                    <div
                      onClick={() => setSelectedId(entry.id)}
                      onDoubleClick={() => {
                        if (!readOnly && onChange) setEditing(entry)
                      }}
                      className="min-w-0 truncate font-mono text-[11.5px] text-dim"
                    >
                      {entry.role || '—'}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    {!readOnly && onChange ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openMenu(
                            menuEventFrom(e),
                            `${entry.target} · stance`,
                            STANCE_UIS.map((s) => ({
                              label: `${s.id === entry.stance ? '✓ ' : ''}${s.label}`,
                              onSelect: () => setStance(entry, s.id)
                            }))
                          )
                        }}
                        title="Click to change stance"
                        className={cn('border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider hover:brightness-125', st.badgeClass)}
                      >
                        {st.label}
                      </button>
                    ) : (
                      <span className={cn('border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider', st.badgeClass)}>
                        {st.label}
                      </span>
                    )}
                    {typeof entry.affinity === 'number' && (
                      <span className="font-mono text-[10.5px] tabular-nums text-faint">
                        {entry.affinity >= 0 ? `+${entry.affinity}` : entry.affinity}
                      </span>
                    )}
                  </div>

                  {!compact && (
                    <div
                      onClick={() => setSelectedId(entry.id)}
                      onDoubleClick={() => {
                        if (!readOnly && onChange) setEditing(entry)
                      }}
                      className="min-w-0 truncate text-[12px] text-dim"
                      title={entry.notes || undefined}
                    >
                      {entry.notes || '—'}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-0.5">
                    {!readOnly && onChange && (
                      <>
                        {!compact && (
                          <button
                            type="button"
                            onClick={() => updateItem({ ...entry, pinned: entry.pinned ? undefined : true, updatedAt: Date.now() })}
                            title={entry.pinned ? 'Unpin from prompt' : 'Pin to prompt'}
                            className={cn('p-1 hover:text-white', entry.pinned ? 'text-accent' : 'text-faint')}
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditing(entry)}
                          title="Edit relationship"
                          className="p-1 text-dim hover:text-white"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(entry)}
                          title="Remove relationship"
                          className="p-1 text-faint hover:text-alert"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </GridRow>
              )
            })}
          </GridTable>
        </div>
      )}

      {inherited && inherited.some((group) => group.items.length > 0) && (
        <Fold label="From bound character sheets" count={inherited.reduce((n, g) => n + g.items.length, 0)}>
          <div className="flex flex-col gap-3 pt-1">
            {inherited
              .filter((g) => g.items.length > 0)
              .map((group) => (
                <div key={group.id} className="flex flex-col gap-1.5 border border-line/35 bg-black/25 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Eyebrow>{group.title}</Eyebrow>
                    {group.onOpen && (
                      <Button size="sm" variant="ghost" icon={<ExternalLink />} onClick={group.onOpen}>
                        Open sheet
                      </Button>
                    )}
                  </div>
                  <RelationshipsTable items={group.items} compact readOnly />
                </div>
              ))}
          </div>
        </Fold>
      )}

      {editing !== null && (
        <RelationshipEditor
          open
          initial={editing === 'new' ? null : editing}
          onSave={updateItem}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
