import { useContext, useMemo, useState, type ReactNode } from 'react'
import { ArrowDownUp, BookOpen, BookX, Check, Clock, ExternalLink, Feather, Lightbulb, Plus, ScrollText, Trash2, Undo2 } from 'lucide-react'
import { STORY_ENTRY_KINDS, newMemory, newSession, type StoryEntryKind, type StoryMemory, type StoryMemoryCategory, type StorySession } from '@shared/story'
import { KNOWLEDGE_SEGMENT, knowledgePart, knowledgeRef, type WorldKnowledge } from '@shared/worldKnowledge'
import { WORLD_LINK_KIND, worldLink } from '@shared/world'
import { showName } from '@shared/ids'
import type { CharacterSheet } from '@shared/types'
import { ActionBar, Button, EmptyState, Eyebrow, ListPane, ListRow, MainPane, ReadingPane, SearchBox, Segmented, Split, askConfirm, confirmDelete, openMenu, type MenuItem } from '../../../ui'
import { engine } from '../../../../lib/ipc'
import { useLive } from '../../../../lib/useLive'
import { openEntry } from '../../../../lib/library'
import { useViewPlace } from '../../../../lib/viewPlace'
import { failed } from '../../../../lib/notify'
import { useSheetHolds } from '../../../../lib/campaignHold'
import { InsideSlateContext } from '../../../entries/EntryCard'
import type { SheetDraft } from '../facets'
import { campaignHolders, innateHolder, type Holder } from '../holders'
import { MemoryCard } from '../mind/MemoryCard'
import { SessionCard } from '../story/SessionCard'
import { SessionComposer } from '../story/SessionComposer'
import { LoreDetail } from './LoreDetail'
import { LinkInlineEdit } from '../../LinkInlineEdit'

type Group = 'lore' | 'backstory' | 'events' | 'memories'

const GROUPS: { id: Group; label: string; icon: ReactNode }[] = [
  { id: 'lore', label: 'World knowledge', icon: <Lightbulb className="h-3.5 w-3.5" /> },
  { id: 'backstory', label: 'Backstory', icon: <Feather className="h-3.5 w-3.5" /> },
  { id: 'events', label: 'Events', icon: <ScrollText className="h-3.5 w-3.5" /> },
  { id: 'memories', label: 'Memories', icon: <Clock className="h-3.5 w-3.5" /> }
]

type Item =
  | { group: Group; key: string; title: string; note: string; kind: 'lore'; world: string; entry: WorldKnowledge; known: boolean; held: Holder[] }
  | { group: Group; key: string; title: string; note: string; kind: 'session'; holder: Holder; session: StorySession; number: number }
  | { group: Group; key: string; title: string; note: string; kind: 'memory'; holder: Holder; memory: StoryMemory }
  | { group: Group; key: string; title: string; note: string; kind: 'essence' }

const BACKSTORY_MEMORY = new Set(['backstory', 'secret'])

type EventKind = StoryEntryKind | 'all'

const EVENT_KINDS: { value: EventKind; label: string }[] = [{ value: 'all', label: 'All' }, ...STORY_ENTRY_KINDS.map((k) => ({ value: k, label: showName(k) }))]

export function KnowledgeTab({ sheet, draft, change, campaign }: { sheet: CharacterSheet; draft: SheetDraft; change: (next: SheetDraft) => void; campaign: string | null }) {
  const inSlate = useContext(InsideSlateContext)
  const data = useLive(() => engine('knowledge.forSheet', { sheet: sheet.id }), ['knowledge.changed', 'worlds.changed'], [sheet.id])
  const held = useSheetHolds(sheet.id, campaign)
  const [list, setList] = useViewPlace('knowledge.list', { open: true, width: 280, newest: true })
  const [query, setQuery] = useState('')
  const [eventKind, setEventKind] = useState<EventKind>('all')
  const [picked, setPicked] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [composing, setComposing] = useState<StorySession | null>(null)

  const innate = innateHolder(draft, change)
  const campaigns = campaignHolders(sheet.id, held)
  const holders = [innate, ...campaigns]
  const target = (campaign && campaigns.find((h) => h.key === campaign)) || innate
  const excluded = draft.mind?.excluded ?? []

  const items = useMemo((): Item[] => {
    const out: Item[] = [{ group: 'backstory', key: 'essence', title: 'Backstory essence', note: 'innate', kind: 'essence' }]
    for (const w of data?.worlds ?? []) {
      for (const e of w.entries) {
        const ref = knowledgeRef(w.id, e.id)
        const holding = holders.filter((h) => h.hold.knowledge.includes(ref))
        const global = e.scope === 'global'
        const known = global ? !excluded.includes(ref) : holding.length > 0
        out.push({ group: 'lore', key: `lore:${ref}`, title: showName(e.name), note: global ? (known ? 'global' : 'excluded') : holding.map((h) => h.label).join(', ') || 'not known', kind: 'lore', world: w.id, entry: e, known, held: holding })
      }
    }
    for (const h of holders) {
      h.hold.sessions.forEach((s, i) => {
        const backstory = s.phase === 'backstory'
        if (!backstory && eventKind !== 'all' && (s.kind ?? 'scene') !== eventKind) return
        out.push({ group: backstory ? 'backstory' : 'events', key: `s:${h.key}:${s.id}`, title: s.title || s.summary || `Entry ${i + 1}`, note: h.label, kind: 'session', holder: h, session: s, number: i + 1 })
      })
      for (const m of h.hold.memories) out.push({ group: BACKSTORY_MEMORY.has(m.category) ? 'backstory' : 'memories', key: `m:${h.key}:${m.id}`, title: m.summary, note: h.label, kind: 'memory', holder: h, memory: m })
    }
    return out
  }, [data, draft, held, eventKind])

  const q = query.trim().toLowerCase()
  const shown = q ? items.filter((i) => `${i.title} ${i.note}`.toLowerCase().includes(q) || (i.kind === 'lore' && i.entry.text.toLowerCase().includes(q))) : items
  const selected = items.find((i) => i.key === picked) ?? null

  const withHold = (h: Holder, patch: Partial<Holder['hold']>) => h.save({ ...h.hold, ...patch })
  const makeInnate = (fn: () => void): MenuItem => ({ label: 'Make innate', icon: <Undo2 />, onSelect: fn })

  const remove = (item: Item): MenuItem | null => {
    const done = () => setPicked((p) => (p === item.key ? null : p))
    if (item.kind === 'essence') return draft.story.backstorySummary ? { label: 'Clear', icon: <Trash2 />, danger: true, onSelect: () => change({ ...draft, story: { ...draft.story, backstorySummary: undefined } }) } : null
    if (item.kind === 'lore') {
      return { label: 'Delete from world', icon: <Trash2 />, danger: true, onSelect: () => confirmDelete(`Delete ${item.title}?`, 'It is removed from the world, for every character.', () => engine('library.remove', { entry: worldLink(item.world, KNOWLEDGE_SEGMENT, item.entry.id) }), done) }
    }
    if (item.kind === 'session') {
      const { holder, session } = item
      return { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => askConfirm(`Delete ${item.title}?`, 'It is removed for good.', 'Delete', () => { withHold(holder, { sessions: holder.hold.sessions.filter((s) => s.id !== session.id) }); done() }) }
    }
    const { holder, memory } = item
    return { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => askConfirm('Delete this memory?', `"${memory.summary}" is removed for good.`, 'Delete', () => { withHold(holder, { memories: holder.hold.memories.filter((m) => m.id !== memory.id) }); done() }) }
  }

  const moves = (item: Item): MenuItem[] => {
    if (item.kind === 'lore') {
      const ref = knowledgeRef(item.world, item.entry.id)
      const open: MenuItem = { label: 'Open', icon: <ExternalLink />, onSelect: () => openEntry(WORLD_LINK_KIND, knowledgePart(item.world, item.entry.id)) }
      if (item.entry.scope === 'global') return [{ label: item.known ? 'Exclude' : 'Include', icon: item.known ? <BookX /> : <Check />, onSelect: () => change({ ...draft, mind: { ...(draft.mind ?? {}), excluded: item.known ? [...excluded, ref] : excluded.filter((r) => r !== ref) } }) }, open]
      const campaignHeld = item.held.filter((h) => !h.innate)
      return [
        item.known
          ? { label: 'Forget', icon: <BookX />, onSelect: () => item.held.forEach((h) => withHold(h, { knowledge: h.hold.knowledge.filter((r) => r !== ref) })) }
          : { label: 'Knows it', icon: <Check />, onSelect: () => (target.innate ? withHold(target, { knowledge: [...target.hold.knowledge, ref] }) : void engine('knowledge.grant', { sheet: sheet.id, campaign: target.key, ref }).catch(failed('Could not give them that knowledge'))) },
        ...(campaignHeld.length && !item.held.some((h) => h.innate)
          ? [makeInnate(() => {
              withHold(innate, { knowledge: [...innate.hold.knowledge, ref] })
              campaignHeld.forEach((h) => withHold(h, { knowledge: h.hold.knowledge.filter((r) => r !== ref) }))
            })]
          : []),
        open
      ]
    }
    if (item.kind === 'session' && !item.holder.innate) {
      const { holder, session } = item
      return [makeInnate(() => {
        withHold(innate, { sessions: [...innate.hold.sessions, session] })
        withHold(holder, { sessions: holder.hold.sessions.filter((s) => s.id !== session.id) })
      })]
    }
    if (item.kind === 'memory' && !item.holder.innate) {
      const { holder, memory } = item
      return [makeInnate(() => {
        withHold(innate, { memories: [...innate.hold.memories, memory] })
        withHold(holder, { memories: holder.hold.memories.filter((m) => m.id !== memory.id) })
      })]
    }
    return []
  }

  const actions = (item: Item): MenuItem[] => {
    const del = remove(item)
    return [...moves(item), ...(del ? [del] : [])]
  }

  const addMemory = (category: StoryMemoryCategory, summary: string) => {
    const m = newMemory({ category, summary, pinned: category === 'backstory' })
    withHold(target, { memories: [...target.hold.memories, m] })
    setPicked(`m:${target.key}:${m.id}`)
    setEditing(m.id)
  }
  const adds: MenuItem[] = [
    { label: 'Memory', icon: <Plus />, onSelect: () => addMemory('memory', 'New memory') },
    { label: 'Event', icon: <Plus />, onSelect: () => setComposing(newSession(undefined, { phase: 'session', kind: 'scene' })) },
    { label: 'Secret', icon: <Plus />, onSelect: () => addMemory('secret', 'New secret') }
  ]

  const detail = (item: Item): ReactNode => {
    const extra = actions(item)
    if (item.kind === 'essence')
      return (
        <div className="flex flex-col gap-2">
          <Eyebrow className="text-accent">Backstory essence</Eyebrow>
          <LinkInlineEdit
            value={draft.story.backstorySummary ?? ''}
            placeholder="Click to write 2-4 sentences of who they were before now; always in their prompt."
            onSave={(v) => change({ ...draft, story: { ...draft.story, backstorySummary: v.trim() || undefined } })}
            className="border border-line/35 tone-panel-50 px-3 py-2 text-[13.5px] leading-relaxed text-ink/95"
          />
          {extra.length > 0 && <ActionBar row items={extra} />}
        </div>
      )
    if (item.kind === 'lore') return <LoreDetail entry={item.entry} note={item.note} items={extra} />
    if (item.kind === 'session') {
      const { holder, session } = item
      return (
        <div className="flex flex-col gap-2">
          <SessionCard
            session={session}
            number={item.number}
            editing={editing === session.id}
            defaultExpanded
            onEdit={(on) => setEditing(on ? session.id : null)}
            onChange={(patch) => withHold(holder, { sessions: holder.hold.sessions.map((s) => (s.id === session.id ? { ...s, ...patch } : s)) })}
            onRemove={() => withHold(holder, { sessions: holder.hold.sessions.filter((s) => s.id !== session.id) })}
          />
          {extra.length > 0 && <ActionBar row items={extra} />}
        </div>
      )
    }
    const { holder, memory } = item
    return (
      <MemoryCard
        memory={memory}
        editing={editing === memory.id}
        onEdit={(on) => setEditing(on ? memory.id : null)}
        onChange={(patch) => withHold(holder, { memories: holder.hold.memories.map((m) => (m.id === memory.id ? { ...m, ...patch } : m)) })}
        onRemove={() => withHold(holder, { memories: holder.hold.memories.filter((m) => m.id !== memory.id) })}
        extra={moves(item)}
      />
    )
  }

  if (!data) return null

  return (
    <div className={inSlate ? 'h-[min(60vh,34rem)] min-h-[20rem]' : 'h-[calc(100vh-13rem)] min-h-[26rem] p-3'}>
      <Split>
        <ListPane id="knowledge" open={list.open} width={list.width} min={200} max={460} reset={280} onWidth={(width) => setList({ ...list, width })} onClose={() => setList({ ...list, open: false })}>
          <aside className="panel-box flex h-full w-full flex-col" onContextMenu={(e) => openMenu(e, 'Add', adds)}>
            <div className="flex flex-col gap-2 border-b border-line/40 p-2">
              <SearchBox value={query} onChange={setQuery} placeholder="Search what they know" />
              <ActionBar row items={adds} />
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-1.5">
              {GROUPS.map((g) => {
                const grouped = shown.filter((i) => i.group === g.id)
                const events = g.id === 'events'
                const rows = events && list.newest ? [...grouped].reverse() : grouped
                if (!rows.length && !(events && eventKind !== 'all')) return null
                return (
                  <section key={g.id} className="flex flex-col">
                    <div className="flex items-center gap-1 px-2 py-1">
                      <Eyebrow className="flex-1">
                        {g.label} ({rows.length})
                      </Eyebrow>
                      {events && <Button size="sm" variant="ghost" icon={<ArrowDownUp />} title={list.newest ? 'Newest first' : 'Oldest first'} onClick={() => setList({ ...list, newest: !list.newest })} />}
                    </div>
                    {events && <Segmented wrap value={eventKind} options={EVENT_KINDS} onChange={setEventKind} />}
                    {rows.map((i) => {
                      const menu = actions(i)
                      return (
                        <ListRow
                          key={i.key}
                          active={picked === i.key}
                          onClick={() => setPicked(i.key)}
                          onMenu={menu.length ? (e) => openMenu(e, i.title, menu) : undefined}
                          icon={i.kind === 'lore' && !i.known ? <BookX className="h-3.5 w-3.5 text-faint" /> : i.kind === 'lore' ? <BookOpen className="h-3.5 w-3.5" /> : g.icon}
                          title={i.title}
                          meta={i.note}
                        />
                      )
                    })}
                  </section>
                )
              })}
            </div>
          </aside>
        </ListPane>
        <MainPane id="knowledge-main">
          <ReadingPane on={Boolean(selected)}>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{selected ? detail(selected) : <EmptyState title="Pick something">Lore, backstory, events and memories this character knows, innate and from {campaign ? 'this campaign' : 'its campaigns'}.</EmptyState>}</div>
          </ReadingPane>
        </MainPane>
      </Split>
      <SessionComposer
        session={composing}
        number={target.hold.sessions.length + 1}
        onChange={setComposing}
        onClose={() => setComposing(null)}
        onSave={() => {
          if (!composing) return
          withHold(target, { sessions: [...target.hold.sessions, composing] })
          setPicked(`s:${target.key}:${composing.id}`)
          setComposing(null)
        }}
      />
    </div>
  )
}
