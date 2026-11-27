import { useContext, useMemo, useState, type KeyboardEvent } from 'react'
import { Pin, Plus, Undo2 } from 'lucide-react'
import type { RelationCategory, RelationshipEntry } from '@shared/relationships'
import { ActionBar, EmptyState, Eyebrow, ListPane, ListRow, MainPane, ReadingPane, SearchBox, Split, askConfirm, openMenu, type MenuItem } from '../ui'
import { useViewPlace } from '../../lib/viewPlace'
import { cn } from '../../lib/cn'
import { InsideSlateContext } from '../entries/EntryCard'
import type { Holder } from '../data/sheet/holders'
import { CategoryChips } from './CategoryChips'
import { RelationshipForm } from './RelationshipForm'
import { blankRelationship } from './RelationshipEditor'
import { relationItems } from './relationItems'
import { categoryUi, stanceUi } from './styles'
import { useMirrors, type RelationOwner } from './useMirrors'

interface Row {
  key: string
  holder: Holder
  entry: RelationshipEntry
}

const keyOf = (holder: Holder, entry: RelationshipEntry): string => `${holder.key}:${entry.id}`

export function RelationsBoard({ holders, target, owner = null }: { holders: Holder[]; target: Holder; owner?: RelationOwner | null }) {
  const inSlate = useContext(InsideSlateContext)
  const [list, setList] = useViewPlace('relations.list', { open: true, width: 260 })
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<RelationCategory | 'all'>('all')
  const [picked, setPicked] = useState<string | null>(null)
  const innate = holders.find((h) => h.innate) ?? target

  const all = useMemo(() => holders.flatMap((h) => h.hold.relationships), [holders])
  const { mirrorItems, mirrorModal } = useMirrors(owner, all)
  const rows = useMemo((): Row[] => {
    const q = query.trim().toLowerCase()
    return holders.flatMap((holder) =>
      holder.hold.relationships
        .filter((e) => (category === 'all' || e.category === category) && (!q || [e.target, e.role, e.notes, ...(e.tags ?? [])].join(' ').toLowerCase().includes(q)))
        .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || a.target.localeCompare(b.target))
        .map((entry) => ({ key: keyOf(holder, entry), holder, entry }))
    )
  }, [holders, query, category])
  const selected = holders.flatMap((holder) => holder.hold.relationships.map((entry) => ({ key: keyOf(holder, entry), holder, entry }))).find((r) => r.key === picked) ?? null

  const save = (holder: Holder, next: RelationshipEntry[]) => holder.save({ ...holder.hold, relationships: next })
  const update = (holder: Holder) => (next: RelationshipEntry) => save(holder, holder.hold.relationships.map((x) => (x.id === next.id ? next : x)))
  const remove = (row: Row) =>
    askConfirm(`Remove ${row.entry.target}?`, 'It no longer reaches prompts or recall.', 'Remove', () => {
      save(row.holder, row.holder.hold.relationships.filter((x) => x.id !== row.entry.id))
      setPicked((p) => (p === row.key ? null : p))
    })
  const makeInnate = (row: Row): MenuItem[] =>
    row.holder.innate
      ? []
      : [
          {
            label: 'Make innate',
            icon: <Undo2 />,
            onSelect: () => {
              save(innate, [...innate.hold.relationships, row.entry])
              save(row.holder, row.holder.hold.relationships.filter((x) => x.id !== row.entry.id))
              setPicked(keyOf(innate, row.entry))
            }
          }
        ]
  const actions = (row: Row): MenuItem[] => relationItems(row.entry, { update: update(row.holder), remove: () => remove(row) }, [...mirrorItems(row.entry), ...makeInnate(row)])

  const add = () => {
    const entry = blankRelationship('person', 'New relation')
    save(target, [...target.hold.relationships, entry])
    setPicked(keyOf(target, entry))
  }
  const adds: MenuItem[] = [{ label: `Add${target.innate ? '' : ` in ${target.label}`}`, icon: <Plus />, onSelect: add }]

  const keys = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
    if (e.key === 'Delete' && selected) {
      e.preventDefault()
      remove(selected)
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const at = rows.findIndex((r) => r.key === picked)
      const next = rows[Math.max(0, Math.min(rows.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (next) setPicked(next.key)
    }
  }

  return (
    <div className={inSlate ? 'h-[min(60vh,34rem)] min-h-[20rem]' : 'h-[calc(100vh-13rem)] min-h-[26rem] p-3'}>
      <Split>
        <ListPane id="relations" open={list.open} width={list.width} min={200} max={440} reset={260} onWidth={(width) => setList({ ...list, width })} onClose={() => setList({ ...list, open: false })}>
          <aside tabIndex={0} onKeyDown={keys} className="panel-box flex h-full w-full flex-col outline-none" onContextMenu={(e) => openMenu(e, 'Relations', adds)}>
            <div className="flex flex-col gap-2 border-b border-line/40 p-2">
              <SearchBox value={query} onChange={setQuery} placeholder="Search relations" />
              {all.length > 0 && <CategoryChips items={all} value={category} onChange={setCategory} hideEmpty />}
              <ActionBar row items={adds} />
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-1.5">
              {holders.map((holder) => {
                const mine = rows.filter((r) => r.holder.key === holder.key)
                if (!mine.length && holder.key !== target.key) return null
                return (
                  <section key={holder.key} className="flex flex-col">
                    <Eyebrow className="px-2 py-1">
                      {holder.label} ({mine.length})
                    </Eyebrow>
                    {mine.map((row) => {
                      const cat = categoryUi(row.entry.category)
                      const st = stanceUi(row.entry.stance)
                      const CatIcon = cat.Icon
                      return (
                        <ListRow
                          key={row.key}
                          active={picked === row.key}
                          onClick={() => setPicked(row.key)}
                          onMenu={(e) => openMenu(e, row.entry.target, actions(row))}
                          icon={row.entry.pinned ? <Pin className="h-3.5 w-3.5 text-accent" /> : <CatIcon className={cn('h-3.5 w-3.5', cat.inkClass)} />}
                          title={row.entry.target}
                          meta={st.label}
                        />
                      )
                    })}
                  </section>
                )
              })}
            </div>
          </aside>
        </ListPane>
        <MainPane id="relations-main">
          <ReadingPane on={Boolean(selected)}>
            {selected ? (
              <div className="flex h-full min-h-0 flex-col gap-3 p-4">
                {!selected.holder.innate && <Eyebrow className="text-accent">{selected.holder.label}</Eyebrow>}
                <RelationshipForm value={selected.entry} onChange={update(selected.holder)} />
                <div className="shrink-0 border-t border-line/40 pt-3">
                  <ActionBar row items={actions(selected)} />
                </div>
              </div>
            ) : (
              <div className="p-4">
                <EmptyState title={all.length ? 'Pick a relation' : 'No relations yet'}>People, places, things, factions and ideas this character has a bond with.</EmptyState>
              </div>
            )}
          </ReadingPane>
        </MainPane>
      </Split>
      {mirrorModal}
    </div>
  )
}
