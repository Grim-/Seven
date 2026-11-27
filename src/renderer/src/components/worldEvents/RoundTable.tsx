import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, FastForward, Flame, Play, Shield, Sparkles, Swords } from 'lucide-react'
import type { SessionMeta } from '@shared/types'
import { STANCE_BADGE, getFactionStance, type StoredFaction } from '@shared/game/factions'
import { eventLink } from '@shared/game/worldEvents'
import { cn } from '../../lib/cn'
import { engine } from '../../lib/ipc'
import { openEntry } from '../../lib/library'
import { failed } from '../../lib/notify'
import { useLive } from '../../lib/useLive'
import { Button, Eyebrow, StatusBadge } from '../ui'
import { Markdown } from '../chat/Markdown'
import { parseRoleplay } from '../chat/Roleplay'
import { useEntryPreview } from '../entries/entryPreview'
import { SheetPortrait } from '../data/SheetPortrait'
import { OutcomeChoices } from './OutcomeChoices'
import { useMetaScene } from './useMetaScene'
import { useWorldEvent } from './useWorldEvents'
import { messageText } from './messageText'
import { seatsOf, type TableSeat } from './seats'
import { CONTINUE_PROMPT, aftermathPrompt, beginPrompt } from './metaPrompts'

const DIRECTOR_CUES: { label: string; text: string }[] = [
  { label: 'Escalate', text: 'Raise the stakes and sharpen the conflict between the factions or forces involved.' },
  { label: 'Complication', text: 'Introduce an unexpected turn, secret, or cost that complicates the situation.' },
  { label: 'Push decision', text: 'Bring the scene to a decisive turning point where an outcome must be chosen.' }
]

function lastSpeaker(texts: string[]): string | null {
  for (let i = texts.length - 1; i >= 0; i--) {
    const beats = parseRoleplay(texts[i]).filter((b) => b.speaker)
    if (beats.length) return beats[beats.length - 1].speaker
  }
  return null
}

function SeatCard({
  seat,
  faction,
  worldId,
  speaking
}: {
  seat: TableSeat
  faction: StoredFaction | null
  worldId: string | null
  speaking: boolean
}) {
  const preview = useEntryPreview(seat.sheet ? `@sheet:${seat.sheet}` : '')
  const image = preview && !('missing' in preview) ? (preview.image ?? null) : null
  const label = (preview && !('missing' in preview) ? preview.title : '') || seat.name || faction?.name || 'Unnamed'
  const canOpen = Boolean(seat.sheet || (faction && (faction.worldId || worldId)))
  const openSeat = () => {
    if (seat.sheet) {
      openEntry('sheet', seat.sheet)
      return
    }
    const w = faction?.worldId || worldId
    if (faction && w) openEntry('world', `${w}/faction/${faction.id}`)
  }

  return (
    <button
      type="button"
      disabled={!canOpen}
      onClick={openSeat}
      title={canOpen ? `Open ${label}` : undefined}
      className={cn(
        'flex min-w-[11.5rem] items-center gap-2.5 border px-2.5 py-2 text-left transition-all',
        canOpen && 'cursor-pointer hover:border-accent/80',
        speaking
          ? 'border-accent bg-accent/10 shadow-[0_0_16px_color-mix(in_srgb,var(--color-accent)_calc(30%*var(--glow)),transparent)]'
          : 'border-line/55 tone-well-50'
      )}
    >
      <div className={cn('h-11 w-11 shrink-0 overflow-hidden border', speaking ? 'border-accent' : 'border-line-strong tone-well-80')}>
        {seat.sheet ? (
          <SheetPortrait image={image} className="h-full w-full" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-label text-[16px] text-secondary-ink">
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn('truncate font-ui text-[12px] font-semibold', speaking ? 'text-accent' : 'text-ink')}>
            {label}
          </span>
          {speaking && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent animate-pulse" />}
        </div>
        {faction && <div className="truncate font-label text-[9.5px] caps-5 text-secondary-ink">{faction.name}</div>}
        <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-dim">
          {seat.role && <span className="truncate">{seat.role}</span>}
          <span className="inline-flex shrink-0 items-center gap-0.5 font-ui text-[10px] text-faint" title="Power">
            <Shield className="h-2.5 w-2.5" />
            {seat.power}
          </span>
        </div>
      </div>
    </button>
  )
}

export function MetaSceneStage({ session }: { session: SessionMeta }) {
  const worldId = session.scene?.worldId ?? null
  const eventId = session.scene?.eventId ?? ''
  const ev = useWorldEvent(eventId, worldId)
  const factions = useLive(() => engine('factions.list'), 'factions.changed') ?? []
  const scene = useMetaScene(worldId, eventId, session.id)
  const [busy, setBusy] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [showOutcomes, setShowOutcomes] = useState(true)

  if (!eventId || !ev) return null

  const seats = seatsOf(ev)
  const said = scene.messages.filter((m) => m.role === 'assistant').map(messageText)
  const speaker = lastSpeaker(said)?.toLowerCase() ?? null
  const factionById = new Map(factions.map((f) => [f.id, f]))
  const involvedFactionIds = [...new Set(seats.map((s) => s.faction).filter((x): x is string => Boolean(x)))]
  const tensions: { id: string; a: string; b: string; stance: keyof typeof STANCE_BADGE }[] = []
  for (let i = 0; i < involvedFactionIds.length; i++) {
    for (let j = i + 1; j < involvedFactionIds.length; j++) {
      const a = involvedFactionIds[i]
      const b = involvedFactionIds[j]
      const stance = getFactionStance(factions, a, b)
      tensions.push({
        id: `${a}:${b}`,
        a: factionById.get(a)?.name ?? a,
        b: factionById.get(b)?.name ?? b,
        stance
      })
    }
  }

  const scopeText = ev.scope.refId ? `${ev.scope.level} · ${ev.scope.refId}` : ev.scope.level
  const started = scene.messages.some((m) => m.role === 'assistant' || m.role === 'user')

  const resolve = (outcomeId: string | null) => {
    setBusy(true)
    void engine('worldEvents.resolve', { id: ev.id, worldId: worldId ?? ev.worldId ?? null, outcomeId })
      .catch(failed('Could not resolve the event'))
      .finally(() => setBusy(false))
  }

  return (
    <div className="pointer-events-auto relative z-20 border-b border-line/60 tone-surface-70 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Flame className="h-3.5 w-3.5 text-accent" />
        <span className="font-display text-[13px] font-semibold text-ink">{ev.title}</span>
        <StatusBadge tone={ev.resolution ? 'ok' : ev.status === 'active' ? 'warn' : 'idle'}>
          {ev.resolution ? ev.resolution.outcomeLabel : ev.status === 'active' ? 'Active' : 'Dormant'}
        </StatusBadge>
        <StatusBadge tone="idle">{scopeText}</StatusBadge>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {!started ? (
            <Button
              size="sm"
              variant="primary"
              icon={<Sparkles />}
              disabled={scene.running || busy}
              onClick={() => scene.send(beginPrompt(ev.title))}
            >
              Begin scene
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              icon={<FastForward />}
              disabled={scene.running}
              onClick={() => scene.send(CONTINUE_PROMPT)}
            >
              Continue
            </Button>
          )}
          {!scene.running &&
            DIRECTOR_CUES.map((c) => (
              <Button key={c.label} size="sm" variant="ghost" onClick={() => scene.send(c.text)}>
                {c.label}
              </Button>
            ))}
          {ev.status === 'dormant' && !ev.resolution && (
            <Button
              size="sm"
              variant="secondary"
              icon={<Play />}
              disabled={busy}
              onClick={() => {
                setBusy(true)
                void engine('worldEvents.setStatus', { id: ev.id, status: 'active', worldId: worldId ?? ev.worldId ?? null })
                  .catch(failed('Could not activate event'))
                  .finally(() => setBusy(false))
              }}
            >
              Activate
            </Button>
          )}
          {ev.resolution && !scene.running && (
            <Button size="sm" variant="ghost" icon={<Play />} onClick={() => scene.send(aftermathPrompt(ev.resolution!.outcomeLabel))}>
              Aftermath
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<ExternalLink />}
            title="Edit event"
            onClick={() => openEntry('world', eventLink(ev.worldId || worldId || '', ev.id))}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={collapsed ? <ChevronDown /> : <ChevronUp />}
            title={collapsed ? 'Expand scene stage' : 'Collapse scene stage'}
            onClick={() => setCollapsed((v) => !v)}
          />
        </div>
      </div>

      {!collapsed && (
        <div className="mt-2.5 flex flex-col gap-2.5">
          {ev.premise && <Markdown text={ev.premise} className="font-body text-[12.5px] leading-relaxed text-dim" />}

          {seats.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {seats.map((seat) => {
                const faction = seat.faction ? (factionById.get(seat.faction) ?? null) : null
                const nameHint = (seat.name || faction?.name || '').toLowerCase()
                const speaking = Boolean(speaker && nameHint && (nameHint === speaker || nameHint.includes(speaker) || speaker.includes(nameHint)))
                return <SeatCard key={seat.key} seat={seat} faction={faction} worldId={worldId} speaking={speaking} />
              })}
            </div>
          )}

          {tensions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 font-label text-[9.5px] caps-10 text-faint">
                <Swords className="h-3 w-3" />
                Tensions
              </span>
              {tensions.map((t) => {
                const badge = STANCE_BADGE[t.stance]
                return (
                  <span
                    key={t.id}
                    className={cn('inline-flex items-center gap-1.5 border px-2 py-0.5 font-ui text-[10.5px]', badge.cls)}
                  >
                    <span>
                      {t.a} ↔ {t.b}
                    </span>
                    <span className="font-label text-[9px] font-bold caps-5">{badge.label}</span>
                  </span>
                )
              })}
            </div>
          )}

          {(ev.outcomes.length > 0 || ev.resolution) && (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setShowOutcomes((v) => !v)}
                className="flex w-fit items-center gap-1 text-left text-dim hover:text-ink"
              >
                <Eyebrow>Resolution & outcomes</Eyebrow>
                {showOutcomes ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showOutcomes && <OutcomeChoices ev={ev} busy={busy || scene.running} onResolve={resolve} />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
