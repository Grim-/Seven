import { useEffect, useMemo, useState } from 'react'
import { Copy, ExternalLink, FolderOpen, HardDriveDownload, Lock, LockOpen, MapPin, Play, Search, Sparkles, Target, Trash2, User, Users } from 'lucide-react'
import { agentSheets, chatPlayer, type CharacterSheet, type ChatMessage } from '@shared/types'
import type { WorldMeta } from '@shared/world'
import { stripRef } from '@shared/ids'
import { Button, EmptyState, Eyebrow, Input, Meter, Select, StatusBadge, openMenu } from '../ui'
import { useWorldPlayer } from '../play/useWorldPlayer'
import { useSheetWorld } from '../worlds/useSheetWorld'
import { OutcomeChoices } from '../worldEvents/OutcomeChoices'
import { openMetaScene } from '../worldEvents/useMetaScene'
import { useWorldEvents } from '../worldEvents/useWorldEvents'
import { AssetMedia } from '../pictures/AssetMedia'
import { SheetPortrait } from '../data/SheetPortrait'
import { engine, on } from '../../lib/ipc'
import { formatRelative } from '../../lib/format'
import { copyText, failed } from '../../lib/notify'
import { onLibraryChange, openEntry, showInData } from '../../lib/library'
import { useConversation } from '../../lib/conversation'
import { useSessions } from '../../store/sessions'
import { useModels } from '../../store/models'
import { useAgents } from '../../store/agents'
import { useVault } from '../../store/vault'
import { useData } from '../../store/data'
import { useImageHost } from '../../store/image'
import { toast } from '../../store/toasts'
import { noteFailure } from '../../store/problems'
import { cn } from '../../lib/cn'

type CacheState = 'building' | 'saving' | 'restoring' | 'idle'
const EMPTY_MESSAGES: ChatMessage[] = []

const CACHE_LABEL = new Map<CacheState, string>([
  ['building', 'Building cache…'],
  ['saving', 'Saving cache…'],
  ['restoring', 'Restoring cache…']
])

/** Live prompt/KV cache status, reuse ratio, vault encryption state, and manual disk save. */
export function ModelCacheGlance() {
  const { sessionId } = useConversation()
  const usage = useSessions((s) => (sessionId ? (s.usage[sessionId] ?? null) : null))
  const messages = useSessions((s) => (sessionId ? (s.messages[sessionId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES))
  const busy = useSessions((s) => (sessionId ? s.running[sessionId] === true || s.compacting[sessionId] === true : false))
  const loaded = useModels((s) => s.host.status === 'ready')
  const vaultConfigured = useVault((s) => s.status.configured)
  const [cacheState, setCacheState] = useState<CacheState>('idle')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setCacheState('idle')
    if (!sessionId) return
    return on('cache.state', (e) => {
      if (e.sessionId === sessionId) setCacheState(e.state)
    })
  }, [sessionId])

  const lastStats = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].stats) return messages[i].stats!
    }
    return null
  }, [messages])

  if (!sessionId) {
    return <EmptyState title="No active chat">Open a chat to inspect and save its model cache.</EmptyState>
  }

  const label = CACHE_LABEL.get(cacheState)
  const reusedPct = lastStats?.promptTokens ? Math.round((lastStats.reusedTokens / lastStats.promptTokens) * 100) : null
  const usedFraction = usage && usage.size > 0 ? usage.used / usage.size : null

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto">
      <div className="flex items-center justify-between gap-2 font-ui text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-ink/90">
          <span className={cn('h-1.5 w-1.5', label ? 'animate-pulse bg-accent' : loaded ? 'bg-secondary' : 'bg-faint')} />
          <span>{label ?? (loaded ? 'Cache ready' : 'No model loaded')}</span>
        </span>
        {reusedPct !== null && (
          <StatusBadge tone={reusedPct >= 80 ? 'idle' : 'busy'}>{reusedPct}% reused</StatusBadge>
        )}
      </div>

      {usage && (
        <Meter
          label="Context"
          value={usedFraction}
          text={`${usage.used.toLocaleString()} / ${usage.size.toLocaleString()}`}
        />
      )}

      <div className="flex items-center gap-1.5 font-ui text-[11px] text-dim">
        {vaultConfigured ? <Lock className="h-3 w-3 shrink-0 text-ok" /> : <LockOpen className="h-3 w-3 shrink-0 text-faint" />}
        <span className="truncate">{vaultConfigured ? 'Saved cache encrypted with vault' : 'Vault not set up (unencrypted)'}</span>
      </div>

      <div className="mt-auto flex items-center gap-2 pt-1">
        <Button
          size="sm"
          variant="secondary"
          icon={<HardDriveDownload />}
          disabled={busy || saving || !loaded}
          onClick={() => {
            setSaving(true)
            void engine('sessions.saveCache', { id: sessionId })
              .then((ok) =>
                ok
                  ? toast.success('Cache saved to disk', vaultConfigured ? 'Encrypted with your vault key.' : 'Saved unencrypted.')
                  : toast.info('Nothing to save', 'No active local model cache for this chat yet.')
              )
              .catch(failed('Could not save cache'))
              .finally(() => setSaving(false))
          }}
        >
          {saving || cacheState === 'saving' ? 'Saving…' : 'Save cache to disk'}
        </Button>
      </div>
    </div>
  )
}

/** Compact image prompt history glance with copy, Files jump, and prompt/image deletion. */
export function ImageHistoryGlance() {
  const history = useImageHost((s) => s.history)
  const refreshHistory = useImageHost((s) => s.refreshHistory)
  const removeHistory = useImageHost((s) => s.removeHistory)
  const assets = useData((s) => s.assets)
  const assetSet = useMemo(() => new Set(assets.map((a) => a.id)), [assets])
  const [query, setQuery] = useState('')

  useEffect(() => {
    void refreshHistory().catch(noteFailure('image', 'Could not load image prompt history'))
  }, [refreshHistory])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? history.filter((e) => `${e.prompt} ${e.modelName} ${e.contextTitle ?? ''}`.toLowerCase().includes(q))
      : history
    return base.slice(0, 12)
  }, [history, query])

  if (history.length === 0) {
    return <EmptyState title="No saved prompts">Generated images and their prompts appear here.</EmptyState>
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-faint" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter image prompts…"
          className="h-7 pl-7 text-[11.5px]"
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
        {shown.map((entry) => {
          const exists = assetSet.has(entry.assetId)
          return (
            <div key={entry.id} className="flex items-start gap-2 border border-line/50 tone-well-35 p-1.5">
              <div className="h-11 w-11 shrink-0 overflow-hidden border border-line/50 tone-panel-60">
                {exists ? (
                  <AssetMedia id={entry.assetId} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-ui text-[9px] text-faint">Missing</span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-1.5 font-ui text-[10px] text-faint">
                  <span className="truncate text-dim">{entry.modelName}</span>
                  <span>· {entry.width}×{entry.height}</span>
                  <span className="ml-auto shrink-0">{formatRelative(entry.createdAt)}</span>
                </div>
                <p className="line-clamp-2 text-[11.5px] leading-snug text-ink/90">{entry.prompt}</p>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" icon={<Copy />} onClick={() => void copyText(entry.prompt, 'Prompt copied')}>
                    Copy
                  </Button>
                  {exists && (
                    <Button size="sm" variant="ghost" icon={<FolderOpen />} onClick={() => showInData({ kind: 'asset', id: entry.assetId })}>
                      Files
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 />}
                    className="ml-auto"
                    title="Delete prompt"
                    onClick={(e) => {
                      if (!exists) return void removeHistory(entry.id, false)
                      openMenu(e, 'Delete prompt', [
                        { label: 'Remove prompt only', icon: <Trash2 />, onSelect: () => void removeHistory(entry.id, false) },
                        { label: 'Delete prompt & image', icon: <Trash2 />, danger: true, onSelect: () => void removeHistory(entry.id, true) }
                      ])
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Live present-state glance ('where I am right now and who I am') for active chat/scene characters. */
export function CharacterStateGlance() {
  const { sessionId, key: convKey } = useConversation()
  const session = useSessions((s) => (sessionId ? (s.list.find((x) => x.id === sessionId) ?? null) : null))
  const draftAgentId = useSessions((s) => s.drafts[convKey]?.agentId ?? null)
  const agents = useAgents((s) => s.list)
  const agentId = session?.agentId ?? draftAgentId
  const agent = useMemo(() => agents.find((a) => a.id === agentId) ?? null, [agents, agentId])

  const agentWorld = useSheetWorld(agent?.sheet)
  const worldPlayer = useWorldPlayer(session?.scene?.worldId ?? agentWorld ?? null)
  const playerId = chatPlayer(agent, worldPlayer)
  const agentSheetIds = useMemo(() => (agent ? agentSheets(agent) : []), [agent])

  const sheetRefs = useMemo(() => {
    const fromScene = (session?.scene?.characters ?? [])
      .map((c) => stripRef(c).replace(/^sheet:/i, '').trim())
      .filter(Boolean)
    return [...new Set([...(playerId ? [playerId] : []), ...agentSheetIds, ...fromScene])]
  }, [playerId, agentSheetIds, session?.scene?.characters])

  const [sheets, setSheets] = useState<CharacterSheet[]>([])
  useEffect(() => {
    if (!sheetRefs.length) {
      setSheets([])
      return
    }
    let alive = true
    const load = () => {
      void Promise.all(
        sheetRefs.map((id) =>
          engine('sheets.get', { id }).catch((err) => {
            noteFailure('sheets', 'Could not load active character sheet')(err)
            return null
          })
        )
      ).then((rows) => {
        if (alive) setSheets(rows.filter((x): x is CharacterSheet => x !== null))
      })
    }
    load()
    return onLibraryChange(load)
  }, [sheetRefs])

  if (!sheetRefs.length) {
    return <EmptyState title="No active character">Choose your player character or assign a character to this agent or scene to track their live state here.</EmptyState>
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto">
      {sheets.map((s) => {
        const openThreads = s.story.threads.filter((t) => !t.done).length
        const isPlayer = s.id === playerId
        const isAgent = agentSheetIds.includes(s.id)
        const roleTag = isPlayer ? 'You' : isAgent ? 'Agent' : 'Scene'
        return (
          <div key={s.id} className="flex flex-col gap-1.5 border border-line/50 tone-well-35 p-2.5">
            <div className="flex items-center gap-2">
              <SheetPortrait image={s.image} className="h-7 w-7 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-display text-[13px] font-semibold text-ink">{s.title}</span>
              <StatusBadge tone={isPlayer ? 'ok' : 'idle'}>{roleTag}</StatusBadge>
              <Button size="sm" variant="ghost" icon={<ExternalLink />} onClick={() => openEntry('sheet', s.id)} title="Open character sheet" />
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11.5px]">
              <span className="inline-flex items-center gap-1 text-faint"><MapPin className="h-3 w-3" /> Where</span>
              <span className="truncate text-ink/90">{s.story.where || 'Not set'}</span>
              <span className="inline-flex items-center gap-1 text-faint"><User className="h-3 w-3" /> Doing</span>
              <span className="truncate text-ink/90">{s.story.doing || '—'}</span>
              <span className="inline-flex items-center gap-1 text-faint"><Target className="h-3 w-3" /> Goal</span>
              <span className="truncate text-ink/90">{s.story.goal || '—'}</span>
              <span className="inline-flex items-center gap-1 text-faint"><Sparkles className="h-3 w-3" /> Mood</span>
              <span className="truncate text-ink/90">{s.story.mood || '—'}</span>
            </div>
            {openThreads > 0 && (
              <Eyebrow className="pt-0.5 text-accent-soft">{openThreads} open thread{openThreads === 1 ? '' : 's'}</Eyebrow>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Meta narrative events glance: activate, open Round Table, or resolve outcomes directly. */
export function WorldEventsGlance() {
  const { sessionId } = useConversation()
  const sceneWorld = useSessions((s) => (sessionId ? (s.list.find((x) => x.id === sessionId)?.scene?.worldId ?? null) : null))
  const [worlds, setWorlds] = useState<WorldMeta[]>([])
  const [pickedWorld, setPickedWorld] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const load = () => void engine('worlds.list').then(setWorlds).catch(failed('Could not load worlds'))
    load()
    return on('worlds.changed', load)
  }, [])

  const effectiveWorld = sceneWorld ?? (pickedWorld || worlds[0]?.id || null)
  const events = useWorldEvents(effectiveWorld)

  if (!effectiveWorld) {
    return <EmptyState title="No world">Create a world to track and resolve meta narrative events here.</EmptyState>
  }

  const ordered = [...events].sort((a, b) => {
    const rank = (s: string) => (s === 'active' ? 0 : s === 'dormant' ? 1 : 2)
    return rank(a.status) - rank(b.status) || a.title.localeCompare(b.title)
  })

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      {!sceneWorld && worlds.length > 0 && (
        <div className="flex shrink-0 items-center justify-between gap-2">
          <Eyebrow>World</Eyebrow>
          <Select
            value={effectiveWorld}
            options={worlds.map((w) => ({ value: w.id, label: w.name }))}
            onChange={setPickedWorld}
            className="h-7 w-40 text-[11px]"
          />
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
        {ordered.length === 0 ? (
          <EmptyState title="No world events">Add meta narrative events in this world to run or resolve them here.</EmptyState>
        ) : (
          ordered.map((ev) => (
            <div key={ev.id} className="flex flex-col gap-2 border border-line/50 tone-well-35 p-2.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-ui text-[12px] font-semibold text-ink">{ev.title}</span>
                <StatusBadge tone={ev.resolution ? 'ok' : ev.status === 'active' ? 'warn' : 'idle'}>
                  {ev.resolution ? 'Resolved' : ev.status === 'active' ? 'Active' : 'Dormant'}
                </StatusBadge>
              </div>
              {ev.rumours[0]?.text && <p className="line-clamp-2 text-[11.5px] text-dim">{ev.rumours[0].text}</p>}
              <div className="flex flex-wrap items-center gap-1.5">
                {!ev.resolution && ev.status === 'dormant' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Play />}
                    disabled={busyId === ev.id}
                    onClick={() => {
                      setBusyId(ev.id)
                      void engine('worldEvents.setStatus', { id: ev.id, status: 'active', worldId: effectiveWorld })
                        .catch(failed('Could not activate event'))
                        .finally(() => setBusyId(null))
                    }}
                  >
                    Activate
                  </Button>
                )}
                {!ev.resolution && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Users />}
                    onClick={() => void openMetaScene(effectiveWorld, ev.id).catch(failed('Could not open meta-narrative scene'))}
                  >
                    Open in chat
                  </Button>
                )}
              </div>
              {(ev.status === 'active' || ev.resolution) && (
                <OutcomeChoices
                  ev={ev}
                  busy={busyId === ev.id}
                  onResolve={(outcomeId) => {
                    setBusyId(ev.id)
                    void engine('worldEvents.resolve', { id: ev.id, worldId: effectiveWorld, outcomeId })
                      .catch(failed('Could not resolve event'))
                      .finally(() => setBusyId(null))
                  }}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
