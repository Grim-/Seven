import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { Archive, BookOpen, Clock, Dices, ExternalLink, Gamepad2, MapPin, Plus, RefreshCw, Trash2, Unlink, Users, X } from 'lucide-react'
import { formatAlmanacClock, isGameplayScene, worldSecondsFromDayTime, worldTimeFromSeconds, type Almanac, type SessionSceneBinding } from '@shared/almanac'
import { detachGameplaySession, rolloverGameplaySession } from '../play/gameplaySession'
import { useApp } from '../../store/app'
import { useTools } from '../../store/tools'
import { pageKindOf, type SessionMeta } from '@shared/types'
import { cn } from '../../lib/cn'
import { engine, on } from '../../lib/ipc'
import { openEntry } from '../../lib/library'
import { failed } from '../../lib/notify'
import { useConversation } from '../../lib/conversation'
import { useData } from '../../store/data'
import { noteFailure } from '../../store/problems'
import { useLocked } from '../vault/Vault'
import { Button, ChipInput, Field, InlineNumber, Input, Modal, Popover, StatusBadge, Tooltip } from '../ui'
import { LinkTextarea } from '../data/LinkTextarea'
import { LinkInlineEdit } from '../data/LinkInlineEdit'
import { EventsBadge } from '../worldEvents/EventsBadge'
import { useChatWorld } from './useChatWorld'
import { showName } from '@shared/ids'

const useSceneUi = create<{
  openFor: Record<string, boolean>
  setOpen: (sessionId: string, open: boolean) => void
  toggle: (sessionId: string) => void
}>((set) => ({
  openFor: {},
  setOpen: (sessionId, open) => set((s) => ({ openFor: { ...s.openFor, [sessionId]: open } })),
  toggle: (sessionId) => set((s) => ({ openFor: { ...s.openFor, [sessionId]: !s.openFor[sessionId] } }))
}))

export function useAlmanacsList(): { almanacs: Almanac[]; reload: () => void } {
  const locked = useLocked()
  const [almanacs, setAlmanacs] = useState<Almanac[]>([])
  const reload = () => {
    if (locked) {
      setAlmanacs([])
      return
    }
    void engine('almanacs.list')
      .then(setAlmanacs)
      .catch(noteFailure('almanac', 'Could not load almanacs'))
  }
  useEffect(() => {
    reload()
    return on('almanacs.changed', reload)
  }, [locked])
  return { almanacs, reload }
}

export function SceneBadgeButton({ session }: { session: SessionMeta | null }) {
  const { almanacs } = useAlmanacsList()
  const openFor = useSceneUi((s) => (session ? Boolean(s.openFor[session.id]) : false))
  const toggle = useSceneUi((s) => s.toggle)
  if (!session) return null
  const scene = session.scene
  const meta = scene?.mode === 'meta'
  const bound = scene?.almanacId ? almanacs.find((a) => a.id === scene.almanacId) ?? null : null
  const gameplay = isGameplayScene(scene)
  const clockSec = scene?.worldTime ?? bound?.currentTime ?? 0

  return (
    <Tooltip
      title={
        meta
          ? `Meta-Narrative Scene · Click to toggle stage`
          : gameplay
            ? `Gameplay Chat bound to "${scene?.worldId}"${scene?.placeKey ? ` (${scene.placeKey})` : ''} · Click to toggle scene bar`
            : bound
              ? `Bound to Almanac "${bound.title}" · Click to toggle scene bar`
              : 'Bind this chat to an Almanac scene (campaign, location, characters, world clock)'
      }
    >
      <button
        type="button"
        onClick={() => toggle(session.id)}
        className={cn(
          'flex h-7 items-center gap-1.5 border px-2 text-xs transition-colors',
          meta || bound || openFor
            ? 'border-accent/55 bg-accent/10 text-ink hover:border-accent'
            : gameplay
              ? 'border-secondary-ink/60 bg-secondary-ink/10 text-ink hover:border-secondary-ink'
              : 'border-line/60 tone-well-50 text-dim hover:border-line hover:text-ink'
        )}
      >
        <BookOpen className={cn('h-3.5 w-3.5', gameplay ? 'text-secondary-ink' : 'text-accent')} />
        {meta ? (
          <>
            <span className="font-label text-[9.5px] font-bold caps-5 text-accent">Meta</span>
            <span className="max-w-[140px] truncate font-medium">{session.title.replace(/^Meta · /, '')}</span>
          </>
        ) : gameplay ? (
          <>
            <span className="font-label text-[9.5px] font-bold caps-5 text-secondary-ink">Gameplay</span>
            <span className="max-w-[130px] truncate font-medium">{bound?.title ?? scene?.worldId}</span>
            {scene?.worldTime != null && <span className="font-ui text-[10.5px] text-dim">{formatAlmanacClock(clockSec)}</span>}
          </>
        ) : bound ? (
          <>
            <span className="max-w-[130px] truncate font-medium">{bound.title}</span>
            <span className="font-ui text-[10.5px] text-dim">{formatAlmanacClock(clockSec)}</span>
          </>
        ) : (
          <span>Scene</span>
        )}
      </button>
    </Tooltip>
  )
}

export function SceneStrip({ session }: { session: SessionMeta | null }) {
  const conv = useConversation()
  const playEnabled = useTools((s) => s.list.some((m) => m.id === 'play' && m.state === 'on'))
  const { almanacs, reload } = useAlmanacsList()
  const pages = useData((s) => s.pages)
  const isOpen = useSceneUi((s) => (session ? Boolean(s.openFor[session.id]) : false))
  const setOpen = useSceneUi((s) => s.setOpen)

  const [newAlmanacTitle, setNewAlmanacTitle] = useState('')
  const [makingAlmanac, setMakingAlmanac] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveTitle, setArchiveTitle] = useState('')
  const [archiveSummary, setArchiveSummary] = useState('')
  const [archiveOutcome, setArchiveOutcome] = useState('')
  const [archiveSecret, setArchiveSecret] = useState('')
  const [archiveThreads, setArchiveThreads] = useState<string[]>([])
  const [archiving, setArchiving] = useState(false)
  const placed = useChatWorld(session?.id)

  if (!session) return null
  const scene = session.scene ?? null
  if (scene?.mode === 'meta') return null
  if (!scene && !isOpen) return null

  const worldAlmanacs = almanacs.filter((a) => (a.worldId ?? null) === placed.world)
  const splitWorlds = [...new Set(placed.sheets.flatMap((x) => (x.world ? [x.world] : [])))]
  const bound = scene ? almanacs.find((a) => a.id === scene.almanacId) ?? null : null
  const clockSec = scene?.worldTime ?? bound?.currentTime ?? 0
  const wt = worldTimeFromSeconds(clockSec, 1)
  const sheetSuggestions = pages.filter((p) => pageKindOf(p.type) === 'sheet').map((p) => `@sheet:${p.id}`)
  const placeSuggestions = bound ? [...new Set(bound.entries.map((e) => e.where).filter(Boolean))] : []

  const updateScene = (patch: Partial<SessionSceneBinding> | null) => {
    if (patch === null) {
      void engine('sessions.setScene', { id: session.id, scene: null })
        .then(() => setOpen(session.id, false))
        .catch(failed('Could not unbind scene'))
      return
    }
    const targetAlmanacId = patch.almanacId ?? scene?.almanacId ?? worldAlmanacs[0]?.id ?? ''
    if (!targetAlmanacId) return
    const targetAlm = almanacs.find((a) => a.id === targetAlmanacId)
    const next: SessionSceneBinding = {
      almanacId: targetAlmanacId,
      worldId: scene?.worldId ?? null,
      saveId: patch.saveId !== undefined ? patch.saveId : (scene?.saveId ?? targetAlm?.saveId ?? null),
      where: patch.where !== undefined ? patch.where : (scene?.where ?? ''),
      characters: patch.characters !== undefined ? patch.characters : (scene?.characters ?? []),
      worldTime: patch.worldTime !== undefined ? patch.worldTime : (scene?.worldTime ?? targetAlm?.currentTime ?? 0),
      archivedEntryId: patch.archivedEntryId !== undefined ? patch.archivedEntryId : (scene?.archivedEntryId ?? null)
    }
    void engine('sessions.setScene', { id: session.id, scene: next }).catch(failed('Could not update scene binding'))
  }

  const createAndBindAlmanac = () => {
    const title = newAlmanacTitle.trim()
    if (!title) return
    void engine('almanacs.save', { almanac: { title, currentTime: 8 * 3600, ...(placed.world ? { worldId: placed.world } : {}) } })
      .then((created) => {
        setNewAlmanacTitle('')
        setMakingAlmanac(false)
        reload()
        updateScene({ almanacId: created.id, worldTime: created.currentTime })
      })
      .catch(failed('Could not create almanac'))
  }

  const setSceneClock = (nextSec: number) => {
    if (!bound) return
    const safe = Math.max(0, nextSec)
    void engine('almanacs.advanceClock', { id: bound.id, absoluteTime: Math.max(bound.currentTime, safe) })
      .then(() => updateScene({ worldTime: safe }))
      .catch(failed('Could not advance clock'))
  }

  const openArchiveDialog = () => {
    const existing = bound?.entries.find((e) => e.id === scene?.archivedEntryId || e.chatId === session.id)
    setArchiveTitle(existing?.title ?? session.title)
    setArchiveSummary(existing?.summary ?? '')
    setArchiveOutcome(existing?.outcome ?? '')
    setArchiveSecret(existing?.secret ?? '')
    setArchiveThreads(existing?.threadIds ?? [])
    setArchiveOpen(true)
  }

  const runArchive = (deleteChat: boolean) => {
    if (!scene?.almanacId) return
    setArchiving(true)
    void engine('almanacs.archiveChat', {
      almanacId: scene.almanacId,
      sessionId: session.id,
      title: archiveTitle.trim() || session.title,
      summary: archiveSummary.trim() || undefined,
      outcome: archiveOutcome.trim() || undefined,
      secret: archiveSecret.trim() || undefined,
      where: scene.where,
      who: scene.characters,
      threadIds: archiveThreads,
      worldTime: clockSec,
      deleteChat
    })
      .then(({ almanac }) => {
        setArchiveOpen(false)
        reload()
        if (deleteChat) {
          conv.go(null)
          openEntry('almanac', almanac.id)
        }
      })
      .catch(failed('Could not archive chat to Almanac'))
      .finally(() => setArchiving(false))
  }

  return (
    <div className="pointer-events-auto z-20 flex flex-wrap items-center justify-between gap-2 border-b border-line/60 tone-panel-75 px-3 py-1.5 text-xs backdrop-blur-[var(--panel-blur)]">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Almanac Picker Popover */}
        {makingAlmanac || almanacs.length === 0 ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={newAlmanacTitle}
              onChange={(e) => setNewAlmanacTitle(e.target.value)}
              placeholder="New Almanac title…"
              className="h-7 w-52 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && createAndBindAlmanac()}
            />
            <Button size="sm" variant="primary" onClick={createAndBindAlmanac}>
              Create
            </Button>
            {almanacs.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setMakingAlmanac(false)}>
                Cancel
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Popover
              title="Bind Chat to Almanac"
              side="bottom"
              align="start"
              triggerClassName="flex h-6 items-center gap-1.5 border border-line/60 tone-well-60 px-2 font-ui text-[11px] text-ink hover:border-accent/60"
              trigger={
                <>
                  <BookOpen className="h-3 w-3 text-accent" />
                  <span>{bound ? bound.title : 'Pick Almanac…'}</span>
                </>
              }
              className="w-60 p-2"
            >
              <div className="flex flex-col gap-1">
                {worldAlmanacs.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => updateScene({ almanacId: a.id, worldTime: a.currentTime })}
                    className={cn(
                      'px-2 py-1 text-left text-xs',
                      bound?.id === a.id ? 'bg-accent/15 text-ink' : 'text-dim hover:bg-ink/5 hover:text-ink'
                    )}
                  >
                    {a.title}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setMakingAlmanac(true)}
                  className="mt-1 flex items-center gap-1 border-t border-line/40 px-2 pt-1.5 font-ui text-[11px] text-accent hover:underline"
                >
                  <Plus className="h-3 w-3" />
                  <span>New Almanac…</span>
                </button>
              </div>
            </Popover>
            {bound && (
              <Tooltip title="Open Almanac in Data">
                <button
                  type="button"
                  onClick={() => openEntry('almanac', bound.id)}
                  className="flex h-6 w-6 items-center justify-center border border-line/50 tone-well-60 text-dim hover:border-accent/60 hover:text-ink"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
              </Tooltip>
            )}
          </div>
        )}

        {scene && bound && (
          <>
            {/* Inline World Clock */}
            <div className="flex items-center gap-1 border border-line/50 tone-panel-60 px-2 py-0.5 font-ui text-[11px] text-ink">
              <Clock className="h-3 w-3 text-accent" />
              <span className="text-dim">Day</span>
              <InlineNumber
                value={wt.day}
                min={1}
                max={99999}
                onSave={(d) => setSceneClock(worldSecondsFromDayTime(d, wt.hour, wt.minute))}
              />
              <span className="text-dim">·</span>
              <InlineNumber
                value={wt.hour}
                min={0}
                max={23}
                onSave={(h) => setSceneClock(worldSecondsFromDayTime(wt.day, h, wt.minute))}
              />
              <span className="text-dim">:</span>
              <InlineNumber
                value={wt.minute}
                min={0}
                max={59}
                onSave={(m) => setSceneClock(worldSecondsFromDayTime(wt.day, wt.hour, m))}
              />
              <button
                type="button"
                onClick={() => setSceneClock(clockSec + 15 * 60)}
                className="ml-1 border-l border-line/40 pl-1.5 text-[10px] text-dim hover:text-ink"
              >
                +15m
              </button>
              <button
                type="button"
                onClick={() => setSceneClock(clockSec + 3600)}
                className="pl-1 text-[10px] text-dim hover:text-ink"
              >
                +1h
              </button>
            </div>

            {/* Where */}
            <div className="flex items-center gap-1.5 border border-line/50 tone-panel-60 px-2 py-0.5">
              <MapPin className="h-3 w-3 text-secondary-ink" />
              <LinkInlineEdit
                value={scene.where}
                suggestions={placeSuggestions}
                placeholder="@place:... or location"
                onSave={(where) => updateScene({ where: where.trim() })}
                className="font-ui text-[11.5px] text-ink"
              />
            </div>

            {placed.world && <EventsBadge worldId={placed.world} />}
            {splitWorlds.length > 1 && (
              <span className="border border-alert/60 bg-alert/10 px-2 py-0.5 font-ui text-[11px] text-alert">
                {placed.sheets.filter((x) => x.world).map((x) => `${showName(x.sheet)} (${x.world})`).join(' · ')}
              </span>
            )}

            {/* Cast Popover / Chips */}
            <Popover
              title="Scene Cast (who is in this chat)"
              side="bottom"
              align="start"
              triggerClassName="flex h-6 items-center gap-1.5 border border-line/50 tone-well-60 px-2 font-ui text-[11px] text-ink hover:border-accent/60"
              trigger={
                <>
                  <Users className="h-3 w-3 text-accent" />
                  <span>
                    {scene.characters.length > 0
                      ? scene.characters.join(', ')
                      : '+ Cast (X, Y, Z)'}
                  </span>
                </>
              }
              className="w-72 p-2.5"
            >
              <ChipInput
                value={scene.characters}
                suggestions={sheetSuggestions}
                onChange={(characters) => updateScene({ characters })}
                placeholder="@sheet:character or name…"
              />
            </Popover>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Tooltip title={session.dmMode ? 'Turn DM Mode off for this chat' : 'Run this chat in DM Mode: the agent acts as Game Master'}>
          <Button
            size="sm"
            variant="badge"
            active={session.dmMode === true}
            icon={<Dices />}
            onClick={() => void engine('sessions.setDmMode', { id: session.id, on: !session.dmMode }).catch(failed('Could not change DM Mode'))}
          >
            DM Mode
          </Button>
        </Tooltip>
        {scene?.archivedEntryId && <StatusBadge tone="ok">Archived</StatusBadge>}
        {scene && bound && (
          <Button size="sm" variant="primary" icon={<Archive />} onClick={openArchiveDialog}>
            {scene.archivedEntryId ? 'Update Archive' : 'Archive to Almanac'}
          </Button>
        )}
        {scene && isGameplayScene(scene) && (
          <>
            <Tooltip title="Continue in a fresh Gameplay session (zero compaction: live state + last exchange only)">
              <Button
                size="sm"
                variant="badge"
                icon={<RefreshCw />}
                onClick={() => void rolloverGameplaySession(session.id, true).catch(failed('Could not roll over Gameplay Chat'))}
              >
                New Session
              </Button>
            </Tooltip>
            {playEnabled && (
              <Tooltip title="Return to Play view for this world">
                <Button
                  size="sm"
                  variant="badge"
                  icon={<Gamepad2 />}
                  onClick={() => useApp.getState().setView('play')}
                >
                  Play
                </Button>
              </Tooltip>
            )}
            <Tooltip title="Detach from World: turns this Gameplay Chat back into a regular chat (keeps history)">
              <Button
                size="sm"
                variant="badge"
                icon={<Unlink />}
                onClick={() =>
                  void detachGameplaySession(session.id)
                    .then(() => setOpen(session.id, false))
                    .catch(failed('Could not detach Gameplay Chat'))
                }
              >
                Detach
              </Button>
            </Tooltip>
          </>
        )}
        {scene && !isGameplayScene(scene) && (
          <Tooltip title="Unbind this chat from Almanac scene">
            <button
              type="button"
              onClick={() => updateScene(null)}
              className="flex h-6 w-6 items-center justify-center border border-line/50 text-dim hover:border-alert/50 hover:text-alert"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        )}
      </div>

      <Modal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title={`Archive Chat into "${bound?.title ?? 'Almanac'}"`}
      >
        <div className="flex flex-col gap-3">
          <div className="border-l-2 border-accent tone-surface-60 px-3 py-2 text-xs text-dim">
            Copies the literal dialogue and turns of <strong className="text-ink">{session.title}</strong> directly into the Almanac at{' '}
            <strong className="font-ui text-ink">{formatAlmanacClock(clockSec)}</strong> ({scene?.where || 'no location set'}). Even if you delete the live chat session now or later, the full transcript remains preserved inside the Almanac.
          </div>

          <Field label="Chronicle Entry Title">
            <Input value={archiveTitle} onChange={(e) => setArchiveTitle(e.target.value)} placeholder={session.title} />
          </Field>

          <Field label="Summary (ground-level recap)">
            <LinkTextarea rolls={false}
              value={archiveSummary}
              onValue={(v) => setArchiveSummary(v)}
              rows={2}
              placeholder="Leave blank to auto-summarize from the chat turns, or write a 1–2 sentence summary…"
            />
          </Field>

          <Field label="Outcome / Consequence (what changed in the world?)">
            <Input
              value={archiveOutcome}
              onChange={(e) => setArchiveOutcome(e.target.value)}
              placeholder="What changed as a result? (optional)"
            />
          </Field>

          <Field label="Secret / Hidden Note (omitted from #public reads & newspapers)">
            <Input
              value={archiveSecret}
              onChange={(e) => setArchiveSecret(e.target.value)}
              placeholder="Optional hidden truth behind this scene…"
            />
          </Field>

          {bound && bound.threads.length > 0 && (
            <Field label="Linked Story Threads">
              <div className="flex flex-wrap gap-1.5">
                {bound.threads.map((t) => {
                  const tid = t.id ?? t.text
                  const checked = archiveThreads.includes(tid)
                  return (
                    <button
                      key={tid}
                      type="button"
                      onClick={() =>
                        setArchiveThreads((prev) => (prev.includes(tid) ? prev.filter((x) => x !== tid) : [...prev, tid]))
                      }
                      className={cn(
                        'border px-2 py-1 text-xs transition-colors',
                        checked ? 'border-accent bg-accent/15 text-ink' : 'border-line tone-well-50 text-dim hover:text-ink'
                      )}
                    >
                      {t.text}
                    </button>
                  )
                })}
              </div>
            </Field>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
            <Button variant="ghost" onClick={() => setArchiveOpen(false)} disabled={archiving}>
              Cancel
            </Button>
            <Button variant="secondary" icon={<Archive />} onClick={() => runArchive(false)} disabled={archiving}>
              Archive &amp; Keep Chat
            </Button>
            <Button variant="danger" icon={<Trash2 />} onClick={() => runArchive(true)} disabled={archiving}>
              Archive &amp; Delete Live Chat
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
