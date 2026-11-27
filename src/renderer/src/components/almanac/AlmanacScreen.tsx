import { useEffect, useRef, useState } from 'react'
import {
  almanacMarkdown,
  formatAlmanacClock,
  formatAlmanacTime,
  padClock,
  sortAlmanacEntries,
  worldSecondsFromDayTime,
  worldTimeFromSeconds,
  type Almanac,
  type AlmanacEntry,
  type AlmanacOpening
} from '@shared/almanac'
import type { ChatElement } from '@shared/chatElements'
import { showName, stripRef } from '@shared/ids'
import type { GameSave, SaveMeta } from '@shared/game/save'
import type { Story } from '@shared/story'
import { splitLink } from '@shared/text'
import { pageKindOf } from '@shared/types'
import { PLACE_TYPE_KEY, type WorldEntity, type WorldMeta } from '@shared/world'
import {
  Archive,
  BookOpen,
  Clock,
  Compass,
  Eye,
  EyeOff,
  MapPin,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
  X
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { useConversation } from '../../lib/conversation'
import { engine, on } from '../../lib/ipc'
import { openChat, openEntry } from '../../lib/library'
import { failed } from '../../lib/notify'
import { chatElementType } from '../../registries/chatElements'
import type { KindScreenProps } from '../../registries/kinds'
import { useAgents } from '../../store/agents'
import { useApp } from '../../store/app'
import { useTools } from '../../store/tools'
import { useData } from '../../store/data'
import { noteFailure } from '../../store/problems'
import { useSessions } from '../../store/sessions'
import { Markdown } from '../chat/Markdown'
import '../chat/MessageElements'
import { Chip } from '../chat/References'
import { RoleplayText } from '../chat/Roleplay'
import { MarkdownEditor } from '../data/MarkdownEditor'
import { setWhere } from '../maps/placeActions'
import { StoryThreads } from '../data/sheet/story/StoryThreads'
import {
  BrowsePick,
  Button,
  ChipInput,
  EmptyState,
  Eyebrow,
  InlineEdit,
  InlineNumber,
  Popover,
  ReadingPane,
  RowAction,
  SearchBox,
  Segmented,
  ShellTabs,
  StatusBadge,
  TagInput,
  Tooltip,
  askConfirm,
  askText
} from '../ui'
import { LinkInlineEdit } from '../data/LinkInlineEdit'
import { BroadsheetView } from './BroadsheetView'

type AlmanacTab = 'overview' | 'chronicle' | 'threads' | 'broadsheet'

export function askNewAlmanac(select: KindScreenProps['select']): void {
  askText('New Almanac', 'Title (e.g. Embers of Night)', '', async (title) => {
    if (!title.trim()) return
    const created = await engine('almanacs.save', {
      almanac: { title: title.trim(), currentTime: 8 * 3600 }
    })
    select({ kind: 'almanac', id: created.id })
  })
}

function renderRefChip(raw: string, onRemove?: () => void) {
  const clean = raw.trim()
  if (!clean) return null
  const link = splitLink(clean)
  if (link.kind && link.ref) {
    return <Chip key={clean} kind={link.kind} refText={stripRef(link.ref)} part={link.part} onRemove={onRemove} />
  }
  return (
    <span
      key={clean}
      className="inline-flex items-center gap-1 border border-line/45 tone-panel-60 px-2 py-0.5 font-ui text-[11px] text-ink/85"
    >
      <span>{clean}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} title="Remove" className="cursor-pointer text-faint hover:text-alert">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

function ArchivedElements({ messageId, elements }: { messageId: string; elements?: ChatElement[] }) {
  if (!elements || !elements.length) return null
  return (
    <div className="chat-elements mt-2">
      {elements.map((el, i) => {
        const spec = chatElementType(el)
        return spec ? <spec.View key={i} data={el.data} messageId={messageId} /> : null
      })}
    </div>
  )
}

function AlmanacEntryEditor({
  entry,
  sheetSuggestions,
  placeSuggestions,
  onChange,
  onDone,
  onCancel,
  isNew
}: {
  entry: AlmanacEntry
  sheetSuggestions: string[]
  placeSuggestions: string[]
  onChange: (next: AlmanacEntry) => void
  onDone: () => void
  onCancel?: () => void
  isNew?: boolean
}) {
  const setTime = (day: number, hour: number, minute: number, seq = entry.when.seq) => {
    const time = worldSecondsFromDayTime(day, hour, minute)
    onChange({
      ...entry,
      when: { ...entry.when, time, day, hour, minute, seq }
    })
  }

  return (
    <div className="flex flex-col gap-3 border border-accent/50 tone-panel-60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/35 pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow className="text-accent">{isNew ? 'Log Scene' : 'Edit Scene'}</Eyebrow>
          <div className="flex items-center gap-1 border border-line/45 tone-panel-50 px-2 py-0.5 font-ui text-[11.5px] text-ink">
            <span className="text-dim">Day</span>
            <InlineNumber
              value={entry.when.day}
              min={1}
              max={99999}
              onSave={(day) => setTime(day, entry.when.hour, entry.when.minute)}
            />
            <span className="text-dim">·</span>
            <InlineNumber
              value={entry.when.hour}
              min={0}
              max={23}
              onSave={(hour) => setTime(entry.when.day, hour, entry.when.minute)}
            />
            <span className="text-dim">:</span>
            <InlineNumber
              value={entry.when.minute}
              min={0}
              max={59}
              onSave={(minute) => setTime(entry.when.day, entry.when.hour, minute)}
            />
            <span className="ml-1 text-faint">#</span>
            <InlineNumber
              value={entry.when.seq}
              min={1}
              max={999}
              onSave={(seq) => setTime(entry.when.day, entry.when.hour, entry.when.minute, seq)}
            />
          </div>
          <InlineEdit
            value={entry.title}
            placeholder="Scene title…"
            onSave={(title) => onChange({ ...entry, title })}
            className="text-[15px] font-semibold text-ink"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={onDone}>
            {isNew ? 'Save Scene' : 'Done'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="font-label text-[10px] font-bold caps-5 text-dim">Summary</span>
          <LinkInlineEdit
            value={entry.summary}
            placeholder="Concise 1–2 sentence recap"
            onSave={(summary) => onChange({ ...entry, summary })}
            className="border border-line/40 tone-panel-40 px-2.5 py-1.5 text-[12.5px] text-ink/90"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label text-[10px] font-bold caps-5 text-dim">Outcome / Consequence</span>
          <LinkInlineEdit
            value={entry.outcome}
            placeholder="What changed as a result? (optional)"
            onSave={(outcome) => onChange({ ...entry, outcome })}
            className="border border-line/40 tone-panel-40 px-2.5 py-1.5 text-[12.5px] text-ink/90"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="font-label text-[10px] font-bold caps-5 text-dim">Where (@world:.../place/...)</span>
          <LinkInlineEdit
            value={entry.where}
            suggestions={placeSuggestions}
            placeholder="@world:.../place/... or location"
            onSave={(where) => onChange({ ...entry, where: where.trim() })}
            className="border border-line/40 tone-panel-40 px-2.5 py-1.5 font-ui text-[12px] text-ink/90"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label text-[10px] font-bold caps-5 text-dim">Who was involved</span>
          <ChipInput
            value={entry.who}
            suggestions={sheetSuggestions}
            onChange={(who) => onChange({ ...entry, who })}
            placeholder="@sheet:... or name"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label text-[10px] font-bold caps-5 text-dim">Tags</span>
          <TagInput
            value={entry.tags ?? []}
            onChange={(tags) => onChange({ ...entry, tags })}
            placeholder="Tag (e.g. parley, ambush)"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-label text-[10px] font-bold caps-5 text-dim">
          Secret / Hidden Note (excluded from #public &amp; newspapers)
        </span>
        <LinkInlineEdit
          value={entry.secret ?? ''}
          placeholder="Optional hidden truth…"
          onSave={(secret) => onChange({ ...entry, secret: secret.trim() || undefined })}
          className="border border-line/40 tone-panel-40 px-2.5 py-1.5 text-[12px] text-warn"
        />
      </div>

      <MarkdownEditor
        key={entry.id}
        value={entry.notes}
        onValue={(notes) => onChange({ ...entry, notes })}
        placeholder="Scene notes, dialogue beats, or lore. Use @kind:name to cross-link places, characters, factions, or files."
        className="min-h-36"
      />
    </div>
  )
}

export function AlmanacScreen({ id }: KindScreenProps) {
  const conv = useConversation()
  const setView = useApp((s) => s.setView)
  const playEnabled = useTools((s) => s.list.some((m) => m.id === 'play' && m.state === 'on'))
  const sessions = useSessions((s) => s.list)
  const agents = useAgents((s) => s.list)
  const pages = useData((s) => s.pages)

  const [almanacs, setAlmanacs] = useState<Almanac[]>([])
  const [worlds, setWorlds] = useState<WorldMeta[]>([])
  const [saves, setSaves] = useState<SaveMeta[]>([])
  const [activeSave, setActiveSave] = useState<GameSave | null>(null)
  const [worldPlaces, setWorldPlaces] = useState<Record<string, WorldEntity>>({})
  const [tab, setTab] = useState<AlmanacTab>('overview')
  const [groupMode, setGroupMode] = useState<'day' | 'where' | 'thread'>('day')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [whereFilter, setWhereFilter] = useState<string | null>(null)
  const [whoFilter, setWhoFilter] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showSecrets, setShowSecrets] = useState(true)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [editingEntry, setEditingEntry] = useState(false)
  const [composing, setComposing] = useState<AlmanacEntry | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const panelsRef = useRef<HTMLDivElement>(null)

  const reload = () => {
    void engine('almanacs.list').then(setAlmanacs).catch(noteFailure('almanac', 'Could not load almanacs'))
    void engine('worlds.list').then(setWorlds).catch(noteFailure('almanac', 'Could not load worlds'))
    void engine('saves.all').then(setSaves).catch(noteFailure('almanac', 'Could not load saves'))
  }

  useEffect(() => {
    reload()
    const offAlm = on('almanacs.changed', reload)
    const offWorlds = on('worlds.changed', reload)
    const offSaves = on('saves.changed', reload)
    return () => {
      offAlm()
      offWorlds()
      offSaves()
    }
  }, [id])

  const almanac = (() => {
    if (!almanacs.length) return null
    if (id && id !== 'all') return almanacs.find((a) => a.id === id) ?? null
    return almanacs[0]
  })()

  useEffect(() => {
    if (!almanac?.worldId) {
      setActiveSave(null)
      setWorldPlaces({})
      return
    }
    const loadWorldData = () => {
      const savePromise = almanac.saveId
        ? engine('saves.get', { id: almanac.saveId })
        : engine('saves.current', { world: almanac.worldId! })
      void savePromise.then(setActiveSave).catch(() => setActiveSave(null))
      void engine('worlds.records', { id: almanac.worldId!, type: PLACE_TYPE_KEY, layer: 'play' })
        .then(setWorldPlaces)
        .catch(() => setWorldPlaces({}))
    }
    loadWorldData()
    return on('saves.changed', loadWorldData)
  }, [almanac?.worldId, almanac?.saveId])

  useEffect(() => {
    const el = panelsRef.current
    if (!el) return
    const onBeforeMatch = (e: Event) => {
      const target = e.target as HTMLElement | null
      const panel = target?.closest<HTMLElement>('[data-almanac-tab]')
      const matchedTab = panel?.dataset.almanacTab as AlmanacTab | undefined
      if (matchedTab) setTab(matchedTab)
    }
    el.addEventListener('beforematch', onBeforeMatch)
    return () => el.removeEventListener('beforematch', onBeforeMatch)
  }, [])

  if (!almanac) {
    return (
      <div className="flex h-full flex-1 items-center justify-center p-6">
        <EmptyState title="No Almanac selected">
          Choose an Almanac from the list, or create a new one to track your storyline&apos;s world clock, opening setup, threads, and archived chats.
        </EmptyState>
      </div>
    )
  }

  const isSessionOne = almanac.entries.length === 0
  const wtNow = worldTimeFromSeconds(almanac.currentTime, 1)
  const liveSceneChats = sessions.filter((s) => s.scene?.almanacId === almanac.id)
  const sheetSuggestions = pages.filter((p) => pageKindOf(p.type) === 'sheet').map((p) => `@sheet:${p.id}`)

  const worldPlaceLinks = almanac.worldId
    ? Object.keys(worldPlaces).map((k) => `@world:${almanac.worldId}/place/${k}`)
    : []
  const placeSuggestions = [
    ...new Set([
      ...worldPlaceLinks,
      ...(almanac.opening?.startingWhere ? [almanac.opening.startingWhere] : []),
      ...almanac.entries.map((e) => e.where).filter(Boolean)
    ])
  ]

  const savePartySheets = activeSave
    ? Object.keys(activeSave.characters).map((s) => (s.startsWith('@') ? s : `@sheet:${s}`))
    : []
  const currentWorld = worlds.find((w) => w.id === almanac.worldId) ?? null
  if (currentWorld?.player) {
    const playerRef = currentWorld.player.startsWith('@') ? currentWorld.player : `@sheet:${currentWorld.player}`
    if (!savePartySheets.includes(playerRef)) savePartySheets.unshift(playerRef)
  }

  const saveAlmanacPatch = (patch: Partial<Almanac>) => {
    void engine('almanacs.save', {
      almanac: { ...almanac, ...patch },
      previousId: almanac.id
    }).catch(failed('Could not save almanac'))
  }

  const saveOpeningPatch = (patch: Partial<AlmanacOpening>) => {
    const cur: AlmanacOpening = almanac.opening ?? {
      premise: '',
      incitingIncident: '',
      startingWhere: '',
      startingTime: almanac.currentTime
    }
    saveAlmanacPatch({ opening: { ...cur, ...patch } })
  }

  const setClockDayTime = (day: number, hour: number, minute: number) => {
    const absoluteTime = worldSecondsFromDayTime(day, hour, minute)
    void engine('almanacs.advanceClock', { id: almanac.id, absoluteTime }).catch(failed('Could not set clock'))
  }

  const syncFromWorldSave = () => {
    const mergedCast = [...new Set([...almanac.cast, ...savePartySheets])]
    const saveClock = activeSave ? Object.values(activeSave.clock)[0]?.time : undefined
    const nextTime = typeof saveClock === 'number' && saveClock > 0 ? saveClock : almanac.currentTime
    const firstWhere =
      almanac.opening?.startingWhere ||
      (activeSave
        ? Object.values(activeSave.characters).find((c) => c.where)?.where ?? ''
        : '') ||
      worldPlaceLinks[0] ||
      ''
    saveAlmanacPatch({
      cast: mergedCast,
      currentTime: nextTime,
      opening: {
        premise: almanac.opening?.premise ?? '',
        incitingIncident: almanac.opening?.incitingIncident ?? '',
        startingWhere: firstWhere,
        startingTime: almanac.opening?.startingTime ?? nextTime,
        ...(almanac.opening?.tone ? { tone: almanac.opening.tone } : {})
      }
    })
  }

  const bindWorld = (worldId: string | null) => {
    if (!worldId) {
      saveAlmanacPatch({ worldId: null, saveId: null })
      return
    }
    void Promise.all([
      engine('saves.current', { world: worldId }).catch(() => null),
      engine('worlds.records', { id: worldId, type: PLACE_TYPE_KEY, layer: 'play' }).catch(() => ({}))
    ]).then(([curSave, places]) => {
      const party = curSave ? Object.keys(curSave.characters).map((s) => `@sheet:${s}`) : []
      const wMeta = worlds.find((w) => w.id === worldId)
      if (wMeta?.player) {
        const pRef = `@sheet:${stripRef(wMeta.player)}`
        if (!party.includes(pRef)) party.unshift(pRef)
      }
      const firstPlaceKey = Object.keys(places)[0]
      const defaultWhere =
        almanac.opening?.startingWhere ||
        (curSave ? Object.values(curSave.characters).find((c) => c.where)?.where : '') ||
        (firstPlaceKey ? `@world:${worldId}/place/${firstPlaceKey}` : '')
      saveAlmanacPatch({
        worldId,
        saveId: curSave?.id ?? null,
        cast: [...new Set([...almanac.cast, ...party])],
        ...(defaultWhere
          ? {
              opening: {
                premise: almanac.opening?.premise ?? '',
                incitingIncident: almanac.opening?.incitingIncident ?? '',
                startingWhere: defaultWhere,
                startingTime: almanac.opening?.startingTime ?? almanac.currentTime,
                ...(almanac.opening?.tone ? { tone: almanac.opening.tone } : {})
              }
            }
          : {})
      })
    })
  }

  const openWorldPlay = () => {
    if (!almanac.worldId) return
    const action =
      almanac.saveId
        ? engine('saves.select', { world: almanac.worldId, id: almanac.saveId })
        : Promise.resolve(null)
    void action
      .then(() => setView('play'))
      .catch(failed('Could not open World Play'))
  }

  const sheetIds = new Set(pages.filter((p) => pageKindOf(p.type) === 'sheet').map((p) => p.id))
  const normCharRef = (raw: string): string => {
    const t = raw.trim()
    if (!t) return ''
    const clean = stripRef(t).replace(/^sheet:/i, '')
    return sheetIds.has(clean) ? `@sheet:${clean}` : t
  }

  const worldPlaceOptions = Object.entries(worldPlaces).map(([key, place]) => {
    const link = almanac.worldId ? `@world:${almanac.worldId}/place/${key}` : key
    const label = (typeof place.name === 'string' && place.name.trim()) || showName(key)
    const note =
      typeof place.summary === 'string' && place.summary.trim()
        ? place.summary.trim()
        : typeof place.description === 'string' && place.description.trim()
          ? place.description.trim()
          : undefined
    return {
      value: link,
      label,
      group: currentWorld?.name ?? 'Places',
      ...(note ? { note } : {})
    }
  })

  const castStanding = (() => {
    const map = new Map<string, string>()
    const defaultWhere = almanac.opening?.startingWhere ?? ''
    for (const c of almanac.cast) {
      const key = normCharRef(c)
      if (key) map.set(key, defaultWhere)
    }
    for (const s of savePartySheets) {
      const key = normCharRef(s)
      const rawSheet = stripRef(key).replace(/^sheet:/i, '')
      const saveWhere = activeSave?.characters[rawSheet]?.where ?? defaultWhere
      if (key) map.set(key, saveWhere)
    }
    const chronological = sortAlmanacEntries(almanac.entries, 'oldest')
    for (const e of chronological) {
      for (const w of e.who) {
        const key = normCharRef(w)
        if (!key) continue
        if (e.where) map.set(key, e.where)
        else if (!map.has(key)) map.set(key, defaultWhere)
      }
    }
    for (const s of liveSceneChats) {
      for (const c of s.scene?.characters ?? []) {
        const key = normCharRef(c)
        if (key && s.scene?.where) map.set(key, s.scene.where)
      }
    }
    // Live save character position overrides chronological fallback when present.
    for (const key of map.keys()) {
      const rawSheet = stripRef(key).replace(/^sheet:/i, '')
      const saveWhere = activeSave?.characters[rawSheet]?.where
      if (saveWhere) map.set(key, saveWhere)
    }
    return [...map.entries()]
  })()

  const setCastLocation = async (charRef: string, nextWhere: string | null) => {
    const rawSheet = stripRef(charRef).replace(/^sheet:/i, '')
    if (!sheetIds.has(rawSheet)) return
    const clean = (nextWhere ?? '').trim()
    try {
      if (almanac.saveId && !activeSave?.characters[rawSheet]) {
        await engine('saves.bring', { id: almanac.saveId, sheet: rawSheet })
      }
      const placeMatch = /^(?:@world:[^/]+\/place\/|@place:)(.+)$/i.exec(clean)
      if (placeMatch) {
        await setWhere(rawSheet, placeMatch[1], almanac.worldId)
      } else if (!clean) {
        await setWhere(rawSheet, null, almanac.worldId)
      } else {
        const s = await engine('sheets.get', { id: rawSheet })
        await engine('sheets.save', {
          id: s.id,
          title: s.title,
          fields: s.fields,
          values: s.values,
          dnd: s.dnd,
          story: { ...s.story, where: clean }
        })
      }
      reload()
    } catch (err) {
      failed('Could not update character location')(err)
    }
  }

  const removeCastEntry = (charRef: string) => {
    const rawId = stripRef(charRef).replace(/^sheet:/i, '')
    const matches = (v: string) => {
      const t = v.trim()
      return t === charRef || t === rawId || t === `@sheet:${rawId}`
    }
    const nextCast = almanac.cast.filter((c) => !matches(c))
    const nextEntries = almanac.entries.map((e) =>
      e.who.some(matches) ? { ...e, who: e.who.filter((w) => !matches(w)) } : e
    )
    saveAlmanacPatch({ cast: nextCast, entries: nextEntries })
  }

  const distinctLocations = (() => {
    const counts = new Map<string, number>()
    for (const link of worldPlaceLinks) counts.set(link, 0)
    if (almanac.opening?.startingWhere) counts.set(almanac.opening.startingWhere, 0)
    for (const e of almanac.entries) {
      if (e.where) counts.set(e.where, (counts.get(e.where) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  })()

  const distinctCast = (() => {
    const counts = new Map<string, number>()
    for (const c of almanac.cast) counts.set(c, 0)
    for (const e of almanac.entries) {
      for (const w of e.who) counts.set(w, (counts.get(w) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  })()

  const distinctTags = (() => {
    const counts = new Map<string, number>()
    for (const e of almanac.entries) {
      for (const t of e.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  })()

  const filteredEntries = (() => {
    const q = query.trim().toLowerCase()
    return sortAlmanacEntries(almanac.entries, sortOrder).filter((e) => {
      if (whereFilter && e.where !== whereFilter) return false
      if (whoFilter && !e.who.includes(whoFilter)) return false
      if (tagFilter && !(e.tags ?? []).includes(tagFilter)) return false
      if (q) {
        const hay = [
          e.title,
          e.summary,
          e.outcome,
          e.where,
          e.notes,
          ...e.who,
          ...(e.tags ?? []),
          ...(showSecrets && e.secret ? [e.secret] : []),
          ...(e.messages?.map((m) => `${m.speaker}: ${m.text}`) ?? [])
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  })()

  const groupedEntries = (() => {
    const groups: { key: string; label: string; sub?: string; entries: AlmanacEntry[] }[] = []
    const byKey = new Map<string, { key: string; label: string; sub?: string; entries: AlmanacEntry[] }>()
    for (const e of filteredEntries) {
      const spec =
        groupMode === 'day'
          ? {
              key: `day:${e.when.day}`,
              label: `Day ${e.when.day}`,
              sub: `${almanac.entries.filter((x) => x.when.day === e.when.day).length} scene(s)`
            }
          : groupMode === 'where'
            ? {
                key: `where:${e.where || 'unplaced'}`,
                label: e.where ? showName(stripRef(e.where)) : 'Unspecified Location',
                sub: e.where || undefined
              }
            : {
                key: `thread:${e.threadIds[0] ?? 'general'}`,
                label: almanac.threads.find((t) => (t.id ?? t.text) === e.threadIds[0])?.text ?? 'General Chronicle'
              }
      let bucket = byKey.get(spec.key)
      if (!bucket) {
        bucket = { ...spec, entries: [] }
        byKey.set(spec.key, bucket)
        groups.push(bucket)
      }
      bucket.entries.push(e)
    }
    return groups
  })()

  const activeEntry =
    (selectedEntryId ? almanac.entries.find((e) => e.id === selectedEntryId) : null) ??
    filteredEntries[0] ??
    null

  const openComposer = () => {
    const wt = worldTimeFromSeconds(almanac.currentTime, 1)
    const maxSeq = almanac.entries
      .filter((e) => e.when.day === wt.day)
      .reduce((m, e) => Math.max(m, e.when.seq), 0)
    setTab('chronicle')
    setComposing({
      id: `alm_${Date.now().toString(36)}`,
      kind: 'scene',
      tags: tagFilter ? [tagFilter] : isSessionOne ? ['session-1'] : [],
      when: { ...wt, seq: maxSeq + 1 },
      where: whereFilter ?? almanac.opening?.startingWhere ?? '',
      who: [...almanac.cast],
      threadIds: [],
      title: isSessionOne ? 'Session 1: Opening Scene' : '',
      summary: '',
      outcome: '',
      notes: '',
      links: [],
      createdAt: Date.now()
    })
  }

  const commitComposed = () => {
    if (!composing) return
    void engine('almanacs.recordEntry', {
      id: almanac.id,
      entry: {
        ...composing,
        title: composing.title.trim() || composing.summary.trim().slice(0, 64) || `Scene (${formatAlmanacTime(composing.when)})`
      }
    })
      .then(({ entry }) => {
        setComposing(null)
        setSelectedEntryId(entry.id)
      })
      .catch(failed('Could not record entry'))
  }

  const updateExistingEntry = (next: AlmanacEntry) => {
    void engine('almanacs.recordEntry', {
      id: almanac.id,
      entry: next
    }).catch(failed('Could not update entry'))
  }

  const deleteEntry = (entryId: string) => {
    saveAlmanacPatch({ entries: almanac.entries.filter((e) => e.id !== entryId) })
    if (selectedEntryId === entryId) setSelectedEntryId(null)
  }

  const toggleCheck = (entryId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

  const startSceneChat = (where?: string, characters?: string[], titleOverride?: string) => {
    const defaultAgentId = agents[0]?.id ?? 'default'
    const resolvedWhere = (where ?? almanac.opening?.startingWhere ?? '').trim()
    const resolvedChars = characters && characters.length ? characters : almanac.cast.length ? almanac.cast : savePartySheets
    void engine('sessions.create', { agentId: defaultAgentId })
      .then(async (created) => {
        if (titleOverride) {
          await engine('sessions.rename', { id: created.id, title: titleOverride })
        }
        return engine('sessions.setScene', {
          id: created.id,
          scene: {
            almanacId: almanac.id,
            worldId: almanac.worldId,
            saveId: almanac.saveId,
            where: resolvedWhere,
            characters: resolvedChars,
            worldTime: almanac.currentTime
          }
        })
      })
      .then((updated) => {
        conv.go(updated.id)
        setView('chat')
      })
      .catch(failed('Could not start scene chat'))
  }

  const archiveLiveSession = (sessionId: string, deleteChat: boolean) => {
    void engine('almanacs.archiveChat', {
      almanacId: almanac.id,
      sessionId,
      deleteChat
    })
      .then(({ entry }) => {
        setSelectedEntryId(entry.id)
        setTab('chronicle')
      })
      .catch(failed('Could not archive chat'))
  }

  const storyShim: Story = {
    where: almanac.opening?.startingWhere ?? '',
    threads: almanac.threads,
    sessions: []
  }

  const catchUpPackText = (() => {
    const chosen = sortAlmanacEntries(
      almanac.entries.filter((e) => checkedIds.has(e.id)),
      'oldest'
    )
    if (!chosen.length) return almanacMarkdown(almanac, { part: showSecrets ? null : 'public', includeSecrets: showSecrets })
    const lines = [
      `# Scene Catch-Up Pack — ${almanac.title}`,
      `- Current World Clock: ${formatAlmanacClock(almanac.currentTime)}`,
      ...(almanac.worldId ? [`- World: @world:${almanac.worldId}`] : []),
      ...(almanac.cast.length ? [`- Active Cast: ${almanac.cast.join(', ')}`] : []),
      ...(almanac.opening?.premise ? [`- Storyline Premise: ${almanac.opening.premise}`] : []),
      `\n## Selected Chronicle Events (Chronological)`
    ]
    for (const e of chosen) {
      lines.push(
        `### [${formatAlmanacTime(e.when)} #${e.when.seq}] ${e.title}`,
        ...(e.tags?.length ? [`- Tags: ${e.tags.map((t) => `#${t}`).join(' ')}`] : []),
        ...(e.where ? [`- Where: ${e.where}`] : []),
        ...(e.who.length ? [`- Who: ${e.who.join(', ')}`] : []),
        ...(e.summary ? [`- Summary: ${e.summary}`] : []),
        ...(e.outcome ? [`- Outcome: ${e.outcome}`] : []),
        ...(showSecrets && e.secret ? [`- Secret: ${e.secret}`] : [])
      )
      if (e.messages?.length) {
        lines.push(`- Archived Transcript (${e.messages.length} turns):`)
        for (const m of e.messages) {
          lines.push(`  - **${m.speaker}:** ${m.text}`)
        }
      }
      lines.push('')
    }
    return lines.join('\n')
  })()

  const catchUpTokens = Math.ceil(catchUpPackText.length / 4)
  const worldSaves = saves.filter((s) => !almanac.worldId || s.world === almanac.worldId)
  const currentSave = worldSaves.find((s) => s.id === (almanac.saveId ?? activeSave?.id))
  const openThreadsCount = almanac.threads.filter((t) => !t.done).length
  const liveOriginChat = activeEntry?.chatId ? sessions.find((s) => s.id === activeEntry.chatId) : undefined

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* STORYLINE DASHBOARD HEADER + SHELL TABS */}
      <div className="shrink-0 border-b border-line/50 tone-panel-40 px-4 pt-2.5">
        <ShellTabs<AlmanacTab>
          value={tab}
          onChange={setTab}
          options={[
            {
              value: 'overview',
              label: isSessionOne ? 'Session 1 & Setup' : 'Storyline Overview',
              icon: <Compass />,
              count: liveSceneChats.length || undefined
            },
            {
              value: 'chronicle',
              label: 'Chronicle',
              icon: <BookOpen />,
              count: almanac.entries.length
            },
            {
              value: 'threads',
              label: 'Threads & Cast',
              icon: <Users />,
              count: openThreadsCount || undefined
            },
            {
              value: 'broadsheet',
              label: 'Broadsheet & Pack',
              icon: <Sparkles />,
              count: checkedIds.size || undefined
            }
          ]}
        >
          {/* Stage Pill */}
          <StatusBadge tone={isSessionOne ? 'warn' : 'ok'}>
            {isSessionOne ? 'Session 1 · Ready to Begin' : `${almanac.entries.length} Scenes`}
          </StatusBadge>

          {/* Compact World Clock */}
          <div className="flex items-center gap-1.5 border border-line/50 tone-panel-60 px-2.5 py-1 font-ui text-[11.5px] text-ink">
            <Clock className="h-3.5 w-3.5 text-accent" />
            <span className="text-dim">Day</span>
            <InlineNumber
              value={wtNow.day}
              min={1}
              max={99999}
              onSave={(d) => setClockDayTime(d, wtNow.hour, wtNow.minute)}
            />
            <span className="text-dim">·</span>
            <InlineNumber
              value={wtNow.hour}
              min={0}
              max={23}
              onSave={(h) => setClockDayTime(wtNow.day, h, wtNow.minute)}
            />
            <span className="text-dim">:</span>
            <InlineNumber
              value={wtNow.minute}
              min={0}
              max={59}
              onSave={(m) => setClockDayTime(wtNow.day, wtNow.hour, m)}
            />
          </div>

          {/* World & Save Binding Popover */}
          <Popover
            title="Bound Game World & Save"
            side="bottom"
            align="end"
            triggerClassName="flex h-7 items-center gap-1.5 border border-line/50 tone-well-60 px-2.5 font-ui text-[11px] text-dim hover:border-accent/60 hover:text-ink"
            trigger={
              <>
                <span>{currentWorld ? currentWorld.name : 'Bind World…'}</span>
                {currentSave && <span className="text-accent">· {currentSave.name}</span>}
              </>
            }
            className="w-64 p-2.5"
          >
            <div className="flex flex-col gap-2">
              <div className="font-label text-[10px] caps-5 text-dim">Game World</div>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => bindWorld(null)}
                  className={cn(
                    'px-2 py-1 text-left text-xs',
                    !almanac.worldId ? 'bg-accent/15 text-ink' : 'text-dim hover:bg-ink/5 hover:text-ink'
                  )}
                >
                  Unbound (standalone)
                </button>
                {worlds.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => bindWorld(w.id)}
                    className={cn(
                      'px-2 py-1 text-left text-xs',
                      almanac.worldId === w.id ? 'bg-accent/15 text-ink' : 'text-dim hover:bg-ink/5 hover:text-ink'
                    )}
                  >
                    {w.name}
                  </button>
                ))}
              </div>

              {worldSaves.length > 0 && (
                <div className="border-t border-line/40 pt-2">
                  <div className="mb-1 font-label text-[10px] caps-5 text-dim">Game Save</div>
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => saveAlmanacPatch({ saveId: null })}
                      className={cn(
                        'px-2 py-1 text-left text-xs',
                        !almanac.saveId ? 'bg-accent/15 text-ink' : 'text-dim hover:bg-ink/5 hover:text-ink'
                      )}
                    >
                      Active save
                    </button>
                    {worldSaves.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => saveAlmanacPatch({ saveId: s.id })}
                        className={cn(
                          'px-2 py-1 text-left text-xs',
                          almanac.saveId === s.id ? 'bg-accent/15 text-ink' : 'text-dim hover:bg-ink/5 hover:text-ink'
                        )}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Popover>

          {almanac.worldId && playEnabled && (
            <Button size="sm" variant="secondary" icon={<Play />} onClick={openWorldPlay}>
              Play World
            </Button>
          )}

          <Button
            size="sm"
            variant="primary"
            icon={<MessageSquare />}
            onClick={() =>
              startSceneChat(
                whereFilter ?? almanac.opening?.startingWhere ?? '',
                almanac.cast,
                isSessionOne ? `${almanac.title} — Session 1` : undefined
              )
            }
          >
            {isSessionOne ? 'Begin Session 1 Chat' : 'New Scene Chat'}
          </Button>
        </ShellTabs>
      </div>

      {/* TAB PANELS CONTAINER */}
      <div ref={panelsRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* TAB 1: STORYLINE OVERVIEW & SESSION 1 OPENING */}
        <div
          role="tabpanel"
          aria-label="Storyline Overview"
          data-almanac-tab="overview"
          {...(tab !== 'overview' ? ({ hidden: 'until-found' } as Record<string, unknown>) : {})}
          className={cn(tab === 'overview' ? 'flex-1 overflow-y-auto' : '')}
        >
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 p-5">
            {/* Contemporaneous Stage & Launch Banner */}
            <section className="flex flex-wrap items-center justify-between gap-4 border border-accent/50 tone-panel-55 p-4 shadow-[inset_3px_0_0_var(--color-accent)]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Eyebrow className="text-accent">
                    {isSessionOne
                      ? 'Storyline Stage: Session 1 — Opening Scene'
                      : `Storyline Stage: In Progress · ${formatAlmanacClock(almanac.currentTime)}`}
                  </Eyebrow>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-dim">
                  {isSessionOne
                    ? 'No chronicle scenes have been recorded yet. Agents bound to this Almanac are informed that this is Session 1 (the start of the storyline) and receive the Story Opening foundation below.'
                    : `${almanac.entries.length} scene(s) recorded on the world clock. Agents receive the Story Opening premise, current world clock, active threads, and recent outcomes.`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {almanac.worldId && playEnabled && (
                  <>
                    <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={syncFromWorldSave}>
                      Sync Party &amp; Clock from Save
                    </Button>
                    <Button size="sm" variant="secondary" icon={<Play />} onClick={openWorldPlay}>
                      Enter World Play
                    </Button>
                  </>
                )}
                <Button size="sm" variant="secondary" icon={<Plus />} onClick={openComposer}>
                  Log Scene Manually
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<MessageSquare />}
                  onClick={() =>
                    startSceneChat(
                      almanac.opening?.startingWhere ?? '',
                      almanac.cast,
                      isSessionOne ? `${almanac.title} — Session 1` : undefined
                    )
                  }
                >
                  {isSessionOne ? 'Start Session 1 Chat' : 'Start Scene Chat'}
                </Button>
              </div>
            </section>

            {/* STORY OPENING & SESSION 1 FOUNDATION */}
            <section className="flex flex-col gap-3.5 border border-line/45 tone-panel-45 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/35 pb-2.5">
                <div>
                  <Eyebrow className="text-accent">Story Opening &amp; Session 1 Setup</Eyebrow>
                  <div className="mt-0.5 text-[12.5px] text-dim">
                    Defines the storyline premise, where Session 1 begins in the world, and the inciting situation. Agents automatically read this so they know how the story starts.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
              {/* Starting Location tied to the Bound World */}
              <div className="flex flex-col gap-1.5">
                <span className="font-label text-[10px] font-bold caps-5 text-dim">
                  Session 1 Starting Location ({currentWorld ? currentWorld.name : 'World'})
                </span>
                <BrowsePick
                  value={almanac.opening?.startingWhere || null}
                  allowCustom
                  placeholder="Pick a starting place or type a location…"
                  options={worldPlaceOptions}
                  onChange={(next) => saveOpeningPatch({ startingWhere: next?.trim() ?? '' })}
                  className="max-w-md"
                />
              </div>

                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="font-label text-[10px] font-bold caps-5 text-dim">
                    Storyline Premise / Campaign Hook
                  </span>
                  <LinkInlineEdit
                    value={almanac.opening?.premise ?? ''}
                    placeholder="What is the overarching premise or central conflict of this storyline?"
                    onSave={(premise) => saveOpeningPatch({ premise })}
                    className="border border-line/40 tone-panel-45 px-2.5 py-1.5 text-[13px] h-22.5 text-ink"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-label text-[10px] font-bold caps-5  text-dim">
                    Tone &amp; Core Stakes
                  </span>
                  <InlineEdit
                    value={almanac.opening?.tone ?? ''}
                    placeholder="e.g. Gritty noir intrigue · High-stakes frontier survival"
                    onSave={(tone) => saveOpeningPatch({ tone })}
                    className="border border-line/40 tone-panel-45 px-2.5 py-1.5 h-22.5 text-[13px] text-ink"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-label text-[10px] font-bold caps-5 text-dim">
                  Session 1 Opening Scene / Inciting Situation
                </span>
                <MarkdownEditor
                  key={`opening_${almanac.id}`}
                  value={almanac.opening?.incitingIncident ?? ''}
                  onValue={(incitingIncident) => saveOpeningPatch({ incitingIncident })}
                  compact
                  placeholder="Describe the immediate situation as Session 1 opens — where the cast is standing, what just happened, and what demands their attention right now."
                  className="min-h-24"
                />
              </div>
            </section>

            {/* WORLD SAVE PARTY & ACTIVE SCENE CHATS (2-COLUMN GRID) */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Cast & World Save Standing */}
              <section className="flex flex-col gap-3 border border-line/45 tone-panel-45 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/35 pb-2">
                  <div>
                    <Eyebrow className="text-accent">Storyline Cast &amp; World Standing ({castStanding.length})</Eyebrow>
                    <div className="mt-0.5 text-[12px] text-dim">
                      Characters in this storyline and their current location.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <BrowsePick
                      value={null}
                      allowCustom
                      clearable={false}
                      placeholder="+ Add character…"
                      options={pages
                        .filter((p) => pageKindOf(p.type) === 'sheet' && !almanac.cast.includes(`@sheet:${p.id}`) && !almanac.cast.includes(p.id))
                        .map((p) => ({
                          value: `@sheet:${p.id}`,
                          label: p.title,
                          group: 'Characters'
                        }))}
                      onChange={(next) => {
                        if (!next) return
                        const clean = next.trim()
                        if (!clean || almanac.cast.includes(clean)) return
                        saveAlmanacPatch({ cast: [...almanac.cast, clean] })
                      }}
                      className="w-52"
                    />
                    {currentWorld && (
                      <Button size="sm" variant="ghost" onClick={() => openEntry('world', currentWorld.id)}>
                        Open World
                      </Button>
                    )}
                  </div>
                </div>

                {castStanding.length > 0 && (
                  <div className="divide-y divide-line/30 border border-line/35 tone-well-40">
                    {castStanding.map(([charRef, locRef]) => {
                      const rawSheet = stripRef(charRef).replace(/^sheet:/i, '')
                      const isSheet = sheetIds.has(rawSheet)
                      return (
                        <div
                          key={charRef}
                          className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5"
                        >
                          {renderRefChip(charRef, () => removeCastEntry(charRef))}
                          <div className="flex items-center gap-1.5">
                            <span className="font-ui text-[10px] text-faint">at</span>
                            {isSheet ? (
                              <BrowsePick
                                value={locRef || null}
                                allowCustom
                                placeholder="Place character…"
                                options={worldPlaceOptions}
                                onChange={(next) => void setCastLocation(charRef, next)}
                                className="w-56"
                              />
                            ) : locRef ? (
                              renderRefChip(locRef)
                            ) : (
                              <span className="font-ui text-[10.5px] text-faint">Unplaced</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* Active Scene Chats */}
              <section className="flex flex-col gap-3 border border-line/45 tone-panel-45 p-4">
                <div className="flex items-center justify-between border-b border-line/35 pb-2">
                  <div>
                    <Eyebrow className="text-accent">Active Scene Chats ({liveSceneChats.length})</Eyebrow>
                    <div className="mt-0.5 text-[12px] text-dim">
                      Live chats currently bound to this storyline. Archive when a scene concludes.
                    </div>
                  </div>
                </div>

                {liveSceneChats.length === 0 ? (
                  <div className="flex flex-col items-start gap-2.5 py-2">
                    <div className="text-[12.5px] text-faint">
                      No live scene chats are open right now.
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<MessageSquare />}
                      onClick={() =>
                        startSceneChat(
                          almanac.opening?.startingWhere ?? '',
                          almanac.cast,
                          isSessionOne ? `${almanac.title} — Session 1` : undefined
                        )
                      }
                    >
                      {isSessionOne ? 'Start Session 1 Chat' : 'Start New Scene Chat'}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {liveSceneChats.map((s) => (
                      <div
                        key={s.id}
                        className="flex flex-col gap-2.5 border border-line/45 tone-panel-55 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => openChat(s.id)}
                            className="flex items-center gap-2 text-left text-[13.5px] font-semibold text-ink hover:text-accent"
                          >
                            <span className="h-2 w-2 rounded-full bg-ok" />
                            <span>{s.title}</span>
                          </button>
                          <span className="font-ui text-[11px] text-dim">
                            {formatAlmanacClock(s.scene?.worldTime ?? almanac.currentTime)}
                          </span>
                        </div>

                        {(s.scene?.where || (s.scene?.characters && s.scene.characters.length > 0)) && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {s.scene?.where && renderRefChip(s.scene.where)}
                            {s.scene?.characters.map((c) => renderRefChip(c))}
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-1.5 border-t border-line/30 pt-2">
                          <Button size="sm" variant="ghost" onClick={() => openChat(s.id)}>
                            Continue Chat
                          </Button>
                          <Button size="sm" variant="secondary" icon={<Archive />} onClick={() => archiveLiveSession(s.id, false)}>
                            Archive
                          </Button>
                          <Button size="sm" variant="danger" icon={<Trash2 />} onClick={() => archiveLiveSession(s.id, true)}>
                            Archive &amp; Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>

        {/* TAB 2: CHRONICLE (MASTER-DETAIL TIMELINE & DRILL-DOWN) */}
        <div
          role="tabpanel"
          aria-label="Chronicle"
          data-almanac-tab="chronicle"
          {...(tab !== 'chronicle' ? ({ hidden: 'until-found' } as Record<string, unknown>) : {})}
          className={cn(tab === 'chronicle' ? 'flex min-h-0 flex-1 overflow-hidden' : '')}
        >
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* LEFT MASTER PANE: WORLD-TIME LEDGER */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-line/45">
              {/* Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/40 tone-panel-30 px-4 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented
                    value={groupMode}
                    onChange={setGroupMode}
                    options={[
                      { value: 'day', label: 'By Day' },
                      { value: 'where', label: 'By Location' },
                      { value: 'thread', label: 'By Thread' }
                    ]}
                  />
                  <Segmented
                    value={sortOrder}
                    onChange={setSortOrder}
                    options={[
                      { value: 'newest', label: 'Newest' },
                      { value: 'oldest', label: 'Chronological' }
                    ]}
                  />
                  {(whereFilter || whoFilter || tagFilter) && (
                    <button
                      type="button"
                      onClick={() => {
                        setWhereFilter(null)
                        setWhoFilter(null)
                        setTagFilter(null)
                      }}
                      className="flex items-center gap-1 border border-accent/50 bg-accent/10 px-2 py-0.5 font-ui text-[10.5px] text-accent"
                    >
                      <span>{whereFilter ?? whoFilter ?? `#${tagFilter}`}</span>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-52">
                    <SearchBox value={query} onChange={setQuery} placeholder="Search chronicle & transcripts…" />
                  </div>
                  <Tooltip title={showSecrets ? 'Secrets visible' : 'Secrets hidden (#public mode)'}>
                    <button
                      type="button"
                      onClick={() => setShowSecrets((v) => !v)}
                      className={cn(
                        'flex h-7 items-center gap-1 border px-2 font-label text-[10.5px] caps',
                        showSecrets ? 'border-line/50 tone-well-40 text-dim hover:text-ink' : 'border-accent/60 bg-accent/10 text-accent'
                      )}
                    >
                      {showSecrets ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      <span>{showSecrets ? 'Secrets' : '#public'}</span>
                    </button>
                  </Tooltip>
                  <Button size="sm" variant="primary" icon={<Plus />} onClick={openComposer}>
                    Log Scene
                  </Button>
                </div>
              </div>

              {/* Ledger Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4">
                {composing && (
                  <div className="mb-4">
                    <AlmanacEntryEditor
                      entry={composing}
                      sheetSuggestions={sheetSuggestions}
                      placeSuggestions={placeSuggestions}
                      onChange={setComposing}
                      onDone={commitComposed}
                      onCancel={() => setComposing(null)}
                      isNew
                    />
                  </div>
                )}

                {groupedEntries.length === 0 ? (
                  <EmptyState
                    title={query || whereFilter || whoFilter || tagFilter ? 'No matching entries' : 'Session 1 has not been archived yet'}
                    action={
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          icon={<MessageSquare />}
                          onClick={() =>
                            startSceneChat(
                              almanac.opening?.startingWhere ?? '',
                              almanac.cast,
                              `${almanac.title} — Session 1`
                            )
                          }
                        >
                          Begin Session 1 Chat
                        </Button>
                        <Button size="sm" variant="secondary" icon={<Plus />} onClick={openComposer}>
                          Log Scene Manually
                        </Button>
                      </div>
                    }
                  >
                    Start your Session 1 chat (or play in the bound world) and archive it here onto the world clock.
                  </EmptyState>
                ) : (
                  <div className="flex flex-col gap-5">
                    {groupedEntries.map((group) => (
                      <section key={group.key} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between border-b border-line/40 pb-1">
                          <span className="font-label text-[11px] font-bold caps-14 text-accent">
                            {group.label}
                          </span>
                          {group.sub && <span className="font-ui text-[10.5px] text-faint">{group.sub}</span>}
                        </div>

                        <div className="ml-2 flex flex-col border-l border-line/50">
                          {group.entries.map((entry) => {
                            const isSelected = activeEntry?.id === entry.id
                            const isChecked = checkedIds.has(entry.id)
                            const hasTranscript = Boolean(entry.messages && entry.messages.length > 0)
                            const liveChat = entry.chatId ? sessions.find((s) => s.id === entry.chatId) : undefined

                            return (
                              <div
                                key={entry.id}
                                onClick={() => {
                                  setSelectedEntryId(entry.id)
                                  setEditingEntry(false)
                                }}
                                className={cn(
                                  'group relative flex cursor-pointer items-start gap-3 border-b border-line/30 py-3 pl-4 pr-2 transition-colors',
                                  isSelected
                                    ? 'bg-accent/10 shadow-[inset_2px_0_0_var(--color-accent)]'
                                    : 'hover:bg-ink/[0.02]'
                                )}
                              >
                                <span
                                  className={cn(
                                    'absolute -left-[5px] top-4 h-2 w-2 border',
                                    isSelected ? 'border-accent bg-accent' : 'border-line bg-bg'
                                  )}
                                />

                                {/* Time & Sequence */}
                                <div className="w-20 shrink-0 pt-0.5 font-ui text-[11.5px]">
                                  <div className="font-semibold text-ink">
                                    {padClock(entry.when.hour)}:{padClock(entry.when.minute)}
                                  </div>
                                  <div className="text-[10px] text-faint">#{entry.when.seq}</div>
                                </div>

                                {/* Headline & Summary */}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[14px] font-semibold text-ink">{entry.title}</span>
                                    {hasTranscript && (
                                      <StatusBadge tone={liveChat ? 'ok' : 'busy'}>
                                        {entry.messages!.length} turns
                                      </StatusBadge>
                                    )}
                                    {entry.tags?.map((t) => (
                                      <span key={t} className="font-ui text-[10.5px] text-accent/80">
                                        #{t}
                                      </span>
                                    ))}
                                  </div>

                                  {entry.summary && (
                                    <div className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-dim">
                                      {entry.summary}
                                    </div>
                                  )}

                                  {entry.outcome && (
                                    <div className="mt-1 font-ui text-[11px] text-ok">→ {entry.outcome}</div>
                                  )}

                                  {(entry.where || entry.who.length > 0) && (
                                    <div
                                      className="mt-1.5 flex flex-wrap items-center gap-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {entry.where && renderRefChip(entry.where)}
                                      {entry.who.map((w) => renderRefChip(w))}
                                    </div>
                                  )}
                                </div>

                                {/* Catch-Up Check */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleCheck(entry.id)
                                  }}
                                  title="Stage in Catch-Up Pack"
                                  className={cn(
                                    'shrink-0 border px-1.5 py-0.5 font-label text-[10px] caps',
                                    isChecked
                                      ? 'border-accent/60 bg-accent/15 text-accent'
                                      : 'border-line/40 text-faint opacity-0 hover:text-ink group-hover:opacity-100'
                                  )}
                                >
                                  {isChecked ? '✓ Pack' : '+ Pack'}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT DETAIL PANE: DEDICATED DRILL-DOWN READING PANE */}
            {activeEntry && (
              <ReadingPane className="w-[480px] max-w-[48%] shrink-0 overflow-y-auto tone-panel-35">
                <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-line/45 tone-surface-95 px-4 py-3 backdrop-blur-[var(--panel-blur)]">
                  <div className="min-w-0">
                    <div className="font-label text-[10.5px] caps-5 text-accent">
                      {formatAlmanacTime(activeEntry.when)} · #{activeEntry.when.seq}
                    </div>
                    <h3 className="mt-0.5 text-[16px] font-semibold text-ink">{activeEntry.title}</h3>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <RowAction
                      icon={<Pencil />}
                      title="Edit scene"
                      onClick={() => setEditingEntry((v) => !v)}
                    />
                    <RowAction
                      danger
                      icon={<Trash2 />}
                      title="Delete scene"
                      onClick={() =>
                        askConfirm(
                          `Delete "${activeEntry.title}"?`,
                          'It will be removed from this Almanac.',
                          'Delete',
                          () => deleteEntry(activeEntry.id)
                        )
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-4 p-4">
                  {editingEntry ? (
                    <AlmanacEntryEditor
                      entry={activeEntry}
                      sheetSuggestions={sheetSuggestions}
                      placeSuggestions={placeSuggestions}
                      onChange={updateExistingEntry}
                      onDone={() => setEditingEntry(false)}
                    />
                  ) : (
                    <>
                      {/* Linked Entities */}
                      {(activeEntry.where || activeEntry.who.length > 0 || (activeEntry.tags && activeEntry.tags.length > 0)) && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {activeEntry.where && renderRefChip(activeEntry.where)}
                          {activeEntry.who.map((w) => renderRefChip(w))}
                          {activeEntry.tags?.map((t) => (
                            <span key={t} className="font-ui text-[11px] text-accent">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Outcome Callout */}
                      {activeEntry.outcome && (
                        <div className="border-l-2 border-ok tone-panel-50 px-3 py-2">
                          <div className="font-label text-[10px] font-bold caps-5 text-ok">
                            Outcome / Consequence
                          </div>
                          <div className="mt-0.5 text-[13px] text-ink">{activeEntry.outcome}</div>
                        </div>
                      )}

                      {/* Summary */}
                      {activeEntry.summary && (
                        <div className="text-[13.5px] leading-relaxed text-ink/90">{activeEntry.summary}</div>
                      )}

                      {/* Secret */}
                      {showSecrets && activeEntry.secret && (
                        <div className="border-l-2 border-warn bg-warn/5 px-3 py-2">
                          <div className="font-label text-[10px] font-bold caps-5 text-warn">
                            Secret (omitted from #public)
                          </div>
                          <div className="mt-0.5 text-[12.5px] text-warn">{activeEntry.secret}</div>
                        </div>
                      )}

                      {/* Notes */}
                      {activeEntry.notes.trim() && (
                        <div className="border border-line/40 tone-panel-45 p-3 text-[13px]">
                          <Markdown text={activeEntry.notes} />
                        </div>
                      )}

                      {/* Origin Chat Provenance & Controls */}
                      {(activeEntry.chatId || (activeEntry.messages && activeEntry.messages.length > 0)) && (
                        <div className="flex flex-col gap-2 border border-line/45 tone-panel-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'h-2 w-2 rounded-full',
                                  liveOriginChat ? 'bg-ok' : 'bg-faint'
                                )}
                              />
                              <span className="text-[12.5px] font-medium text-ink">
                                {activeEntry.chatTitle ?? activeEntry.chatId ?? 'Archived Scene Chat'}
                              </span>
                            </div>
                            <span className="font-ui text-[10px] text-dim">
                              {liveOriginChat ? '● Live in Chats' : '○ Deleted from Chats · Preserved here'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {liveOriginChat ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  icon={<MessageSquare />}
                                  onClick={() => openChat(liveOriginChat.id)}
                                >
                                  Open / Continue Chat
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  icon={<Archive />}
                                  onClick={() => archiveLiveSession(liveOriginChat.id, false)}
                                >
                                  Sync Turns
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  icon={<Trash2 />}
                                  onClick={() =>
                                    void engine('sessions.delete', { id: liveOriginChat.id }).catch(
                                      failed('Could not delete live chat')
                                    )
                                  }
                                >
                                  Delete Live Chat
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={<MessageSquare />}
                                onClick={() =>
                                  startSceneChat(
                                    activeEntry.where,
                                    activeEntry.who.length ? activeEntry.who : almanac.cast
                                  )
                                }
                              >
                                Start Follow-Up Chat Here
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Full Archived Chat Transcript (with RoleplayText & ChatElements) */}
                      {activeEntry.messages && activeEntry.messages.length > 0 && (
                        <div className="flex flex-col gap-2.5">
                          <Eyebrow className="text-accent">
                            Archived Transcript ({activeEntry.messages.length} turns)
                          </Eyebrow>
                          <div className="flex flex-col gap-2.5">
                            {activeEntry.messages.map((m) => (
                              <div key={m.id} className="border border-line/40 tone-panel-55 p-3">
                                <div className="mb-1.5 flex items-center justify-between">
                                  <span
                                    className={cn(
                                      'font-label text-[10.5px] font-bold caps-5 ',
                                      m.role === 'user' ? 'text-secondary-ink' : 'text-accent'
                                    )}
                                  >
                                    {m.speaker}
                                  </span>
                                  <span className="font-ui text-[10px] text-faint">{m.role}</span>
                                </div>
                                {m.text && (
                                  <div className="text-[13px] text-ink/90">
                                    {m.role === 'assistant' ? (
                                      <RoleplayText text={m.text} agent={null} />
                                    ) : (
                                      <Markdown text={m.text} />
                                    )}
                                  </div>
                                )}
                                <ArchivedElements messageId={m.id} elements={m.elements} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </ReadingPane>
            )}
          </div>
        </div>

        {/* TAB 3: THREADS & CAST INDEX */}
        <div
          role="tabpanel"
          aria-label="Threads & Cast"
          data-almanac-tab="threads"
          {...(tab !== 'threads' ? ({ hidden: 'until-found' } as Record<string, unknown>) : {})}
          className={cn(tab === 'threads' ? 'flex-1 overflow-y-auto' : '')}
        >
          <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-start gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <StoryThreads
              story={storyShim}
              onChange={(next) => saveAlmanacPatch({ threads: next.threads })}
              query={query}
            />

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2.5 border border-line/45 tone-panel-45 p-3.5">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-secondary-ink" />
                  <Eyebrow>Locations ({distinctLocations.length})</Eyebrow>
                </div>
                {distinctLocations.length === 0 ? (
                  <div className="text-[12px] text-faint">Locations logged on scenes appear here.</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {distinctLocations.map(([loc, count]) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => {
                          setWhereFilter(loc)
                          setTab('chronicle')
                        }}
                        className="flex items-baseline gap-1.5 border border-line/45 tone-well-55 px-2.5 py-1 text-[12px] text-dim hover:border-accent/60 hover:text-ink"
                      >
                        <span>{showName(stripRef(loc))}</span>
                        <span className="font-ui text-[10px] text-faint">{count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2.5 border border-line/45 tone-panel-45 p-3.5">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-accent" />
                  <Eyebrow>Cast &amp; Factions ({distinctCast.length})</Eyebrow>
                </div>
                {distinctCast.length === 0 ? (
                  <div className="text-[12px] text-faint">Characters and factions appear here.</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {distinctCast.map(([person, count]) => (
                      <button
                        key={person}
                        type="button"
                        onClick={() => {
                          setWhoFilter(person)
                          setTab('chronicle')
                        }}
                        className="flex items-baseline gap-1.5 border border-line/45 tone-well-55 px-2.5 py-1 text-[12px] text-dim hover:border-accent/60 hover:text-ink"
                      >
                        <span>{showName(stripRef(person))}</span>
                        <span className="font-ui text-[10px] text-faint">{count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {distinctTags.length > 0 && (
                <div className="flex flex-col gap-2.5 border border-line/45 tone-panel-45 p-3.5">
                  <Eyebrow>Scene Tags ({distinctTags.length})</Eyebrow>
                  <div className="flex flex-wrap gap-1.5">
                    {distinctTags.map(([tag, count]) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setTagFilter(tag)
                          setTab('chronicle')
                        }}
                        className="flex items-baseline gap-1 border border-line/45 tone-well-55 px-2 py-0.5 font-ui text-[11px] text-dim hover:border-accent/60 hover:text-ink"
                      >
                        <span>#{tag}</span>
                        <span className="text-[10px] text-faint">{count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TAB 4: BROADSHEET & CATCH-UP PACK (#PUBLIC) */}
        <div
          role="tabpanel"
          aria-label="Broadsheet & Pack"
          data-almanac-tab="broadsheet"
          {...(tab !== 'broadsheet' ? ({ hidden: 'until-found' } as Record<string, unknown>) : {})}
          className={cn(tab === 'broadsheet' ? 'flex-1 overflow-y-auto' : '')}
        >
          <BroadsheetView
            almanac={almanac}
            catchUpPackText={catchUpPackText}
            catchUpTokens={catchUpTokens}
            checkedCount={checkedIds.size}
            onSaveEditions={(editions) => saveAlmanacPatch({ editions })}
            onStartSceneChat={() => startSceneChat()}
          />
        </div>
      </div>
    </div>
  )
}
