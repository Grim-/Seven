import { useEffect, useState } from 'react'
import { Check, Dices, Eye, Play, Plus, Square, Trash2, X } from 'lucide-react'
import type { ChatMessage } from '@shared/types'
import type { ResolvedWorldEvent, WorldEventParticipantKind, WorldEventScopeLevel, WorldEventStatus } from '@shared/game/worldEvents'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { failed } from '../../lib/notify'
import { useAgents } from '../../store/agents'
import { useSessions } from '../../store/sessions'
import { toast } from '../../store/toasts'
import { Markdown } from '../chat/Markdown'
import { ModelReadyControl } from '../play/ModelReadyControl'
import { Button, Field, Input, Select, Textarea } from '../ui'

export type EditableWorldEvent = ResolvedWorldEvent & { name: string }

function messageTextOf(m: ChatMessage): string {
  return m.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
    .trim()
}

export function WorldEventEditor({
  value,
  onChange
}: {
  value: EditableWorldEvent
  onChange: (next: EditableWorldEvent) => void
}) {
  const worlds = useLive(() => engine('worlds.list'), 'worlds.changed') ?? []
  const factions = useLive(() => engine('factions.list'), 'factions.changed') ?? []
  const triggerActions = useLive(() => engine('triggerActions.list'), 'triggerActions.changed') ?? []
  const allMaps = useLive(() => engine('maps.list'), 'maps.changed') ?? []
  const allPlaces = useLive(() => engine('library.find', { query: '', kind: 'place' }), 'worlds.changed') ?? []
  const allSheets = useLive(() => engine('library.find', { query: '', kind: 'sheet' }), 'page.changed') ?? []
  const allCreatures = useLive(() => engine('library.find', { query: '', kind: 'game_creature' }), 'game.changed') ?? []
  const allMonsters = useLive(() => engine('library.find', { query: '', kind: 'monster' }), 'dnd.changed') ?? []
  const agents = useAgents((s) => s.list)
  const [pickedAgentId, setPickedAgentId] = useState('')
  const effectiveAgentId = pickedAgentId && agents.some((a) => a.id === pickedAgentId) ? pickedAgentId : (agents[0]?.id ?? '')

  const [metaSessionId, setMetaSessionId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const watchMessages = useSessions((s) => (metaSessionId ? s.messages[metaSessionId] : undefined))
  const watchRunning = useSessions((s) => (metaSessionId ? Boolean(s.running[metaSessionId]) : false))

  useEffect(() => {
    if (!metaSessionId) return
    void useSessions.getState().load(metaSessionId).catch(failed('Could not load meta-scene'))
  }, [metaSessionId])

  const mapOptions = allMaps.map((m) => ({ value: m.id, label: m.name }))
  const placeOptions = allPlaces.map((p) => ({ value: p.id, label: p.title }))
  const factionOptions = factions.map((f) => ({ value: f.id, label: f.name }))
  const sheetOptions = allSheets.map((s) => ({ value: s.id, label: s.title }))
  const creatureOptions = allCreatures.map((c) => ({ value: c.id, label: c.title }))
  const monsterOptions = allMonsters.map((m) => ({ value: m.id, label: m.title }))
  const sheetTitleOf = (id: string) => allSheets.find((s) => s.id === id)?.title ?? id

  const patch = (p: Partial<EditableWorldEvent>) => {
    const next = { ...value, ...p }
    if (p.name !== undefined) next.title = p.name
    if (p.title !== undefined) next.name = p.title
    onChange(next)
  }

  const startWatch = async () => {
    if (!value.id) return
    if (!effectiveAgentId) {
      toast.info('No Agent Selected', 'Pick an agent to voice the Meta-Narrative Scene.')
      return
    }
    setBusy(true)
    try {
      const meta = await engine('sessions.startMetaScene', {
        worldId: value.worldId || worlds[0]?.id || '',
        eventId: value.id,
        agentId: effectiveAgentId
      })
      await useSessions.getState().load(meta.id)
      setMetaSessionId(meta.id)
      const kickOff = `Play out the confrontation for "${value.title}" between the participating figureheads based on their faction tensions and motivations. Stop before deciding who wins.`
      void engine('sessions.send', { id: meta.id, text: kickOff }).catch(failed('Could not run meta-narrative scene'))
    } catch (err) {
      failed('Could not start Meta-Narrative Scene')(err)
    } finally {
      setBusy(false)
    }
  }

  const resolveNow = async (outcomeId?: string) => {
    if (!value.id) return
    setBusy(true)
    try {
      const resolved = await engine('worldEvents.resolve', {
        id: value.id,
        worldId: value.worldId || worlds[0]?.id || null,
        outcomeId: outcomeId ?? null
      })
      toast.success(value.title, `Resolved: ${resolved.resolution?.outcomeLabel ?? 'Done'}`)
    } catch (err) {
      failed('Could not resolve World Event')(err)
    } finally {
      setBusy(false)
    }
  }

  const playAftermath = () => {
    if (!metaSessionId || !value.resolution) return
    const prompt = `The outcome has been decided: "${value.resolution.outcomeLabel}". Play out a brief aftermath reaction from the figureheads.`
    void engine('sessions.send', { id: metaSessionId, text: prompt }).catch(failed('Could not play aftermath'))
  }

  return (
    <div className="flex flex-col gap-4 font-mono text-[11.5px]">
      {/* LIVE PLAY / META-SCENE CONTROLS (WHEN SAVED) */}
      {value.id && (
        <div className="flex flex-col gap-2.5 border border-line/70 bg-black/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Play &amp; Resolution</span>
              <Select
                value={effectiveAgentId}
                options={agents.map((a) => ({ value: a.id, label: a.name }))}
                onChange={setPickedAgentId}
                className="h-6 w-44 text-[10px]"
              />
            </div>
            <ModelReadyControl agent={agents.find((a) => a.id === effectiveAgentId) ?? null} compact />
          </div>

          {value.resolution ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border border-ok/50 bg-ok/10 px-2.5 py-2 text-[11px]">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-ok">
                  RESOLVED ({value.resolution.mode}): {value.resolution.outcomeLabel}
                </span>
                {value.resolution.breakdown.length > 0 && (
                  <span className="text-[10px] text-dim">
                    {value.resolution.breakdown.map((b) => `${b.label} (${b.total})`).join(' · ')}
                  </span>
                )}
              </div>
              {metaSessionId && (
                <Button size="sm" variant="primary" icon={<Play className="h-3 w-3" />} disabled={watchRunning} onClick={playAftermath}>
                  Play Aftermath
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" variant="primary" icon={<Eye className="h-3 w-3" />} disabled={busy} onClick={() => void startWatch()}>
                Watch Scene
              </Button>
              {value.outcomes.length > 0 && (
                <Button size="sm" variant="badge" icon={<Dices className="h-3 w-3" />} disabled={busy} onClick={() => void resolveNow()}>
                  Score &amp; Resolve
                </Button>
              )}
              {value.outcomes.map((o) => (
                <Button key={o.id} size="sm" variant="badge" icon={<Check className="h-3 w-3" />} disabled={busy} onClick={() => void resolveNow(o.id)}>
                  {o.label}
                </Button>
              ))}
            </div>
          )}

          {metaSessionId && (
            <div className="flex flex-col gap-2 border-t border-line/50 pt-2">
              <div className="flex items-center justify-between text-[10px] uppercase text-purple">
                <span>Meta-Narrative Scene</span>
                {watchRunning && (
                  <Button
                    size="sm"
                    variant="badge"
                    icon={<Square className="h-2.5 w-2.5" />}
                    onClick={() => void engine('sessions.abort', { id: metaSessionId }).catch(failed('Could not stop'))}
                    className="h-5 border-alert/70 text-alert"
                  >
                    Stop
                  </Button>
                )}
              </div>
              <div className="flex max-h-72 flex-col gap-2 overflow-y-auto bg-black/60 p-2.5 select-text">
                {!watchMessages?.length ? (
                  <span className="animate-pulse text-[11px] text-dim">Staging Meta-Narrative Scene…</span>
                ) : (
                  watchMessages
                    .filter((m) => m.role === 'assistant')
                    .map((m) => {
                      const body = messageTextOf(m)
                      return (
                        <div key={m.id} className="border-l-2 border-purple/70 bg-purple/5 p-2">
                          {body ? (
                            <Markdown text={body} className="font-sans text-[12px] leading-relaxed text-neutral-100" />
                          ) : (
                            <span className="animate-pulse text-[11px] text-dim">Voicing figureheads…</span>
                          )}
                        </div>
                      )
                    })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CORE FIELDS (WORLD-AGNOSTIC & REUSABLE) */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Title">
          <Input value={value.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Border Skirmish at North Crossing" />
        </Field>
        <Field label="Status">
          <Select
            value={value.status}
            options={[
              { value: 'dormant', label: 'Dormant' },
              { value: 'active', label: 'Active' },
              { value: 'resolved', label: 'Resolved' }
            ]}
            onChange={(status) => patch({ status: status as WorldEventStatus })}
          />
        </Field>
        <Field label="Scope">
          <Select
            value={value.scope.level}
            options={[
              { value: 'global', label: 'Global' },
              { value: 'map', label: 'Map' },
              { value: 'area', label: 'Area' },
              { value: 'place', label: 'Place' }
            ]}
            onChange={(level) => patch({ scope: { ...value.scope, level: level as WorldEventScopeLevel, refId: '' } })}
          />
        </Field>
      </div>

      {value.scope.level !== 'global' && (
        <Field label={value.scope.level === 'map' ? 'Target Map' : 'Target Place / Area'}>
          <Select
            value={value.scope.refId}
            options={
              value.scope.level === 'map'
                ? [{ value: '', label: '— Choose Map —' }, ...mapOptions]
                : [{ value: '', label: '— Choose Place —' }, ...placeOptions]
            }
            onChange={(refId) => patch({ scope: { ...value.scope, refId } })}
          />
        </Field>
      )}

      <Field label="Premise (Meta-Scene Only — never leaked to Gameplay Chat)">
        <Textarea
          rows={3}
          value={value.premise}
          onChange={(e) => patch({ premise: e.target.value })}
          placeholder="What is happening off-screen between factions or figureheads?"
        />
      </Field>

      {/* DIEGETIC RUMOURS */}
      <div className="flex flex-col gap-2 border border-line/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan">Diegetic Rumours &amp; News</span>
          <Button
            size="sm"
            variant="badge"
            icon={<Plus className="h-2.5 w-2.5" />}
            onClick={() =>
              patch({
                rumours: [...value.rumours, { id: `rumour_${value.rumours.length + 1}`, headline: '', text: '', reach: value.scope.level }]
              })
            }
          >
            Add Rumour
          </Button>
        </div>
        {value.rumours.length === 0 ? (
          <span className="text-[10.5px] text-faint">No rumours — stays completely secret from Gameplay Chat.</span>
        ) : (
          value.rumours.map((r, idx) => (
            <div key={r.id} className="flex items-center gap-1.5">
              <Input
                value={r.text}
                onChange={(e) =>
                  patch({
                    rumours: value.rumours.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x))
                  })
                }
                placeholder="Word is the crossing guards stopped letting outsiders through…"
                className="flex-1"
              />
              <Select
                value={r.reach}
                options={[
                  { value: 'place', label: 'Place' },
                  { value: 'area', label: 'Area' },
                  { value: 'map', label: 'Map' },
                  { value: 'global', label: 'Global' }
                ]}
                onChange={(reach) =>
                  patch({
                    rumours: value.rumours.map((x, i) => (i === idx ? { ...x, reach: reach as WorldEventScopeLevel } : x))
                  })
                }
                className="w-24"
              />
              <button
                type="button"
                onClick={() => patch({ rumours: value.rumours.filter((_, i) => i !== idx) })}
                className="p-1 text-dim hover:text-alert cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* FLEXIBLE PARTICIPANTS (FACTIONS, INDIVIDUAL SHEETS, CREATURES/MONSTERS, OR UNLISTED FIGURES) */}
      <div className="flex flex-col gap-2 border border-line/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Participants (Factions, Individuals &amp; Figures)</span>
          <Button
            size="sm"
            variant="badge"
            icon={<Plus className="h-2.5 w-2.5" />}
            onClick={() =>
              patch({
                participants: [
                  ...value.participants,
                  {
                    id: `part_${value.participants.length + 1}_${Date.now().toString(36).slice(-3)}`,
                    kind: 'faction',
                    refId: factions[0]?.id ?? '',
                    factionId: factions[0]?.id ?? '',
                    characters: [],
                    role: '',
                    power: 5
                  }
                ]
              })
            }
          >
            Add Participant
          </Button>
        </div>
        {value.participants.length === 0 ? (
          <span className="text-[10.5px] text-faint">
            Mix any number of factions (even empty shells with no named leader), individual character sheets, creature/monster blocks, or unlisted/distant figures.
          </span>
        ) : (
          value.participants.map((p, idx) => {
            const updatePart = (next: Partial<typeof p>) =>
              patch({
                participants: value.participants.map((x, i) => (i === idx ? { ...x, ...next } : x))
              })
            const fac = p.kind === 'faction' ? factions.find((f) => f.id === (p.refId || p.factionId)) : null
            const memberIds = new Set(fac?.members ?? [])
            const chosen = p.characters ?? []
            const charOptions = [
              ...(fac?.members ?? [])
                .filter((id) => !chosen.includes(id))
                .map((id) => ({ value: id, label: `${sheetTitleOf(id)} (${fac?.name ?? 'Member'})` })),
              ...allSheets
                .filter((s) => !memberIds.has(s.id) && !chosen.includes(s.id))
                .map((s) => ({ value: s.id, label: s.title }))
            ]
            return (
              <div key={p.id || idx} className="flex flex-col gap-2 border border-line/40 bg-black/50 p-2">
                <div className="grid grid-cols-[125px_1fr_72px_auto] items-center gap-1.5">
                  <Select
                    value={p.kind}
                    options={[
                      { value: 'faction', label: 'Faction' },
                      { value: 'sheet', label: 'Character Sheet' },
                      { value: 'creature', label: 'Creature / NPC' },
                      { value: 'monster', label: 'D&D Monster' },
                      { value: 'figure', label: 'Named Figure' }
                    ]}
                    onChange={(k) => {
                      const kind = k as WorldEventParticipantKind
                      updatePart({
                        kind,
                        refId: '',
                        name: kind === 'figure' ? p.name ?? '' : '',
                        factionId: kind === 'faction' ? '' : p.factionId ?? '',
                        characters: kind === 'faction' ? p.characters ?? [] : []
                      })
                    }}
                  />

                  {p.kind === 'faction' && (
                    <Select
                      value={p.refId || p.factionId || ''}
                      options={[{ value: '', label: '— Choose Faction —' }, ...factionOptions]}
                      onChange={(fid) => updatePart({ refId: fid, factionId: fid })}
                    />
                  )}
                  {p.kind === 'sheet' && (
                    <Select
                      value={p.refId || ''}
                      options={[{ value: '', label: '— Choose Character Sheet —' }, ...sheetOptions]}
                      onChange={(refId) => updatePart({ refId, name: sheetTitleOf(refId) })}
                    />
                  )}
                  {p.kind === 'creature' && (
                    <Select
                      value={p.refId || ''}
                      options={[{ value: '', label: '— Choose Creature / NPC —' }, ...creatureOptions]}
                      onChange={(refId) =>
                        updatePart({ refId, name: allCreatures.find((c) => c.id === refId)?.title ?? refId })
                      }
                    />
                  )}
                  {p.kind === 'monster' && (
                    <Select
                      value={p.refId || ''}
                      options={[{ value: '', label: '— Choose D&D Monster —' }, ...monsterOptions]}
                      onChange={(refId) =>
                        updatePart({ refId, name: allMonsters.find((m) => m.id === refId)?.title ?? refId })
                      }
                    />
                  )}
                  {p.kind === 'figure' && (
                    <Input
                      value={p.name ?? ''}
                      onChange={(e) => updatePart({ name: e.target.value })}
                      placeholder="Unlisted / distant character name (e.g. High Lord Vane)"
                    />
                  )}

                  <Input
                    type="number"
                    value={String(p.power)}
                    onChange={(e) => updatePart({ power: Number(e.target.value) || 0 })}
                    placeholder="Power"
                    title="Influence / strength weight"
                  />
                  <button
                    type="button"
                    onClick={() => patch({ participants: value.participants.filter((_, i) => i !== idx) })}
                    className="p-1 text-dim hover:text-alert cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  <Input
                    value={p.role}
                    onChange={(e) => updatePart({ role: e.target.value })}
                    placeholder="Role / stake in this event (optional)"
                  />
                  {p.kind !== 'faction' && (
                    <Select
                      value={p.factionId ?? ''}
                      options={[{ value: '', label: 'Independent (no faction)' }, ...factionOptions]}
                      onChange={(factionId) => updatePart({ factionId })}
                    />
                  )}
                </div>

                {/* OPTIONAL NAMED CHARACTERS WHEN PARTICIPANT IS A FACTION */}
                {p.kind === 'faction' && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {chosen.map((cid) => (
                      <span
                        key={cid}
                        className="inline-flex items-center gap-1 border border-cyan/50 bg-cyan/10 px-1.5 py-0.5 text-[10.5px] text-white"
                      >
                        <span>{sheetTitleOf(cid)}</span>
                        <button
                          type="button"
                          onClick={() => updatePart({ characters: chosen.filter((c) => c !== cid) })}
                          className="text-dim hover:text-alert cursor-pointer"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                    <Select
                      value=""
                      options={[{ value: '', label: '+ Optional named character (or leave empty)…' }, ...charOptions]}
                      onChange={(cid) => {
                        if (!cid || chosen.includes(cid)) return
                        updatePart({ characters: [...chosen, cid] })
                      }}
                      className="h-6 w-64 text-[10.5px]"
                    />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* OUTCOMES (ARBITRARY COUNT — NEVER HARDCODED TO 2) */}
      <div className="flex flex-col gap-2 border border-line/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple">Outcomes &amp; Trigger Actions</span>
          <Button
            size="sm"
            variant="badge"
            icon={<Plus className="h-2.5 w-2.5" />}
            onClick={() =>
              patch({
                outcomes: [
                  ...value.outcomes,
                  {
                    id: `outcome_${value.outcomes.length + 1}`,
                    label: '',
                    summary: '',
                    winnerFactionId: null,
                    factors: [],
                    varianceDie: 6,
                    triggerActionIds: [],
                    effects: []
                  }
                ]
              })
            }
          >
            Add Outcome
          </Button>
        </div>
        {value.outcomes.length === 0 ? (
          <span className="text-[10.5px] text-faint">Add as many outcomes as this event can lead to.</span>
        ) : (
          value.outcomes.map((o, idx) => (
            <div key={o.id || idx} className="flex flex-col gap-1.5 border border-line/40 bg-black/50 p-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Input
                  value={o.label}
                  onChange={(e) =>
                    patch({
                      outcomes: value.outcomes.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x))
                    })
                  }
                  placeholder="Outcome label"
                  className="min-w-[140px] flex-1"
                />
                <Select
                  value={o.winnerFactionId ?? ''}
                  options={[{ value: '', label: '— Winner Faction —' }, ...factionOptions]}
                  onChange={(v) =>
                    patch({
                      outcomes: value.outcomes.map((x, i) => (i === idx ? { ...x, winnerFactionId: v || null } : x))
                    })
                  }
                  className="w-44"
                />
                <Select
                  value={o.triggerActionIds[0] ?? ''}
                  options={[{ value: '', label: '— Trigger Action —' }, ...triggerActions.map((a) => ({ value: a.id, label: a.name }))]}
                  onChange={(v) =>
                    patch({
                      outcomes: value.outcomes.map((x, i) => (i === idx ? { ...x, triggerActionIds: v ? [v] : [] } : x))
                    })
                  }
                  className="w-48"
                />
                <button
                  type="button"
                  onClick={() => patch({ outcomes: value.outcomes.filter((_, i) => i !== idx) })}
                  className="p-1 text-dim hover:text-alert cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <Input
                value={o.summary}
                onChange={(e) =>
                  patch({
                    outcomes: value.outcomes.map((x, i) => (i === idx ? { ...x, summary: e.target.value } : x))
                  })
                }
                placeholder="What changes in the world if this outcome wins?"
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
