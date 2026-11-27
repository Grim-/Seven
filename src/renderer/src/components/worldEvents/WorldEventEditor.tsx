import { Plus, Trash2, X } from 'lucide-react'
import { eventPlace, placeScope, type WorldEvent, type WorldEventParticipantKind, type WorldEventScopeLevel } from '@shared/game/worldEvents'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { Button, Field, Fold, Input, Select, Toggle } from '../ui'
import { LinkTextarea } from '../data/LinkTextarea'
import { WorldScopeProvider } from '../game/worldScope'
import { WorldPlacePick } from '../worlds/WorldPlacePick'
import { EventTriggerEditor } from './EventTriggerEditor'
import { OutcomeActions } from './OutcomeActions'

export type EditableWorldEvent = WorldEvent & { name: string }

export function WorldEventEditor({
  value,
  onChange
}: {
  value: EditableWorldEvent
  onChange: (next: EditableWorldEvent) => void
}) {
  const factions =
    useLive(
      () => engine('factions.list', value.worldId ? { world: value.worldId } : undefined),
      'factions.changed',
      [value.worldId]
    ) ?? []
  const allSheets = useLive(() => engine('library.find', { query: '', kind: 'sheet' }), 'page.changed') ?? []
  const allCreatures = useLive(() => engine('library.find', { query: '', kind: 'game_creature' }), 'game.changed') ?? []
  const allMonsters = useLive(() => engine('library.find', { query: '', kind: 'monster' }), 'dnd.changed') ?? []

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

  return (
    <WorldScopeProvider worldId={value.worldId || null}>
    <div className="flex flex-col gap-4 font-ui text-[11.5px]">
      {/* WORLD EVENT DEFINITION */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Title">
          <Input value={value.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Border Skirmish at North Crossing" />
        </Field>
        <Field label="Takes place at">
          <WorldPlacePick world={value.worldId} value={eventPlace(value) || null} onChange={(place) => patch({ scope: placeScope(place) })} />
        </Field>
        <Field label="Initial State" hint="Play state (active/resolved) is tracked per save.">
          <div className="flex h-8 items-center">
            <Toggle
              checked={Boolean(value.startsActive)}
              onChange={(startsActive) => patch({ startsActive })}
              label="Active when a new save starts"
            />
          </div>
        </Field>
      </div>

      <Field label="Premise (Meta-Scene Only — never leaked to Gameplay Chat)">
        <LinkTextarea
          rolls={false}
          rows={3}
          value={value.premise}
          onValue={(premise) => patch({ premise })}
          placeholder="What is happening off-screen between factions or figureheads?"
        />
      </Field>

      <EventTriggerEditor world={value.worldId} value={value.trigger} onChange={(trigger) => patch({ trigger })} />

      {/* DIEGETIC RUMOURS */}
      <div className="flex flex-col gap-2 border border-line/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold caps-5 text-secondary-ink">Diegetic Rumours &amp; News</span>
          <Button
            size="sm"
            variant="badge"
            icon={<Plus className="h-2.5 w-2.5" />}
            onClick={() =>
              patch({
                rumours: [...value.rumours, { id: `rumour_${value.rumours.length + 1}`, headline: '', text: '', reach: eventPlace(value) ? 'place' : 'global' }]
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
              <LinkTextarea
                rolls={false}
                rows={1}
                value={r.text}
                onValue={(text) =>
                  patch({
                    rumours: value.rumours.map((x, i) => (i === idx ? { ...x, text } : x))
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
          <span className="text-[10px] font-bold caps-5 text-accent">Participants (Factions, Individuals &amp; Figures)</span>
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
              <div key={p.id || idx} className="flex flex-col gap-2 border border-line/40 tone-panel-50 p-2">
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
                  <LinkTextarea
                    rolls={false}
                    rows={1}
                    value={p.role}
                    onValue={(role) => updatePart({ role })}
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
                        className="inline-flex items-center gap-1 border border-secondary-ink/50 bg-secondary-ink/10 px-1.5 py-0.5 text-[10.5px] text-ink"
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
          <span className="text-[10px] font-bold caps-5 text-tint-purple">Outcomes &amp; Trigger Actions</span>
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
                    known: '',
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
            <div key={o.id || idx} className="flex flex-col gap-1.5 border border-line/40 tone-panel-50 p-2">
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
                <button
                  type="button"
                  onClick={() => patch({ outcomes: value.outcomes.filter((_, i) => i !== idx) })}
                  className="p-1 text-dim hover:text-alert cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <LinkTextarea
                rolls={false}
                rows={1}
                value={o.summary}
                onValue={(summary) =>
                  patch({
                    outcomes: value.outcomes.map((x, i) => (i === idx ? { ...x, summary } : x))
                  })
                }
                placeholder="What really happens"
              />
              <LinkTextarea
                rolls={false}
                rows={1}
                value={o.known}
                onValue={(known) =>
                  patch({
                    outcomes: value.outcomes.map((x, i) => (i === idx ? { ...x, known } : x))
                  })
                }
                placeholder="What people know"
              />
              <OutcomeActions
                inline={o.effects}
                onInline={(effects) => patch({ outcomes: value.outcomes.map((x, i) => (i === idx ? { ...x, effects } : x)) })}
              />
              <Fold label="Scoring weights" count={o.factors.length || undefined}>
                <div className="flex flex-col gap-2 pt-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] text-dim">Variance die (dN):</span>
                    <Input
                      type="number"
                      min={0}
                      value={String(o.varianceDie ?? 0)}
                      onChange={(e) =>
                        patch({
                          outcomes: value.outcomes.map((x, i) =>
                            i === idx ? { ...x, varianceDie: Math.max(0, Number(e.target.value) || 0) } : x
                          )
                        })
                      }
                      className="h-7 w-20"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Plus className="h-3 w-3" />}
                      onClick={() =>
                        patch({
                          outcomes: value.outcomes.map((x, i) =>
                            i === idx
                              ? { ...x, factors: [...x.factors, { label: 'Factor', kind: 'fixed', weight: 2 }] }
                              : x
                          )
                        })
                      }
                    >
                      Add factor
                    </Button>
                  </div>
                  {o.factors.map((fac, fIdx) => (
                    <div key={fIdx} className="grid grid-cols-[1fr_100px_1fr_64px_auto] items-center gap-1.5">
                      <Input
                        value={fac.label}
                        placeholder="Label"
                        onChange={(e) =>
                          patch({
                            outcomes: value.outcomes.map((x, i) =>
                              i === idx
                                ? { ...x, factors: x.factors.map((f, j) => (j === fIdx ? { ...f, label: e.target.value } : f)) }
                                : x
                            )
                          })
                        }
                        className="h-7"
                      />
                      <Select
                        value={fac.kind}
                        options={[
                          { value: 'fixed', label: 'Fixed' },
                          { value: 'power', label: 'Faction Power' },
                          { value: 'flag', label: 'Save Flag' }
                        ]}
                        onChange={(k) =>
                          patch({
                            outcomes: value.outcomes.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    factors: x.factors.map((f, j) =>
                                      j === fIdx ? { ...f, kind: k as 'fixed' | 'power' | 'flag' } : f
                                    )
                                  }
                                : x
                            )
                          })
                        }
                        className="h-7"
                      />
                      {fac.kind === 'power' ? (
                        <div className="flex items-center gap-1">
                          <Select
                            value={fac.factionId ?? ''}
                            options={[{ value: '', label: '— Faction —' }, ...factionOptions]}
                            onChange={(factionId) =>
                              patch({
                                outcomes: value.outcomes.map((x, i) =>
                                  i === idx
                                    ? { ...x, factors: x.factors.map((f, j) => (j === fIdx ? { ...f, factionId } : f)) }
                                    : x
                                )
                              })
                            }
                            className="h-7 flex-1"
                          />
                          <Select
                            value={fac.stat ?? 'power'}
                            options={[
                              { value: 'power', label: 'Power' },
                              { value: 'might', label: 'Might' },
                              { value: 'intrigue', label: 'Intrigue' },
                              { value: 'diplomacy', label: 'Diplomacy' },
                              { value: 'cohesion', label: 'Cohesion' }
                            ]}
                            onChange={(stat) =>
                              patch({
                                outcomes: value.outcomes.map((x, i) =>
                                  i === idx
                                    ? {
                                        ...x,
                                        factors: x.factors.map((f, j) =>
                                          j === fIdx
                                            ? { ...f, stat: stat as 'power' | 'might' | 'intrigue' | 'diplomacy' | 'cohesion' }
                                            : f
                                        )
                                      }
                                    : x
                                )
                              })
                            }
                            className="h-7 w-28"
                          />
                        </div>
                      ) : fac.kind === 'flag' ? (
                        <Input
                          value={fac.flag ?? ''}
                          placeholder="flag_name"
                          onChange={(e) =>
                            patch({
                              outcomes: value.outcomes.map((x, i) =>
                                i === idx
                                  ? { ...x, factors: x.factors.map((f, j) => (j === fIdx ? { ...f, flag: e.target.value } : f)) }
                                  : x
                              )
                            })
                          }
                          className="h-7"
                        />
                      ) : (
                        <span className="text-[10.5px] text-faint">Always adds weight</span>
                      )}
                      <Input
                        type="number"
                        value={String(fac.weight)}
                        onChange={(e) =>
                          patch({
                            outcomes: value.outcomes.map((x, i) =>
                              i === idx
                                ? { ...x, factors: x.factors.map((f, j) => (j === fIdx ? { ...f, weight: Number(e.target.value) || 0 } : f)) }
                                : x
                            )
                          })
                        }
                        className="h-7"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patch({
                            outcomes: value.outcomes.map((x, i) =>
                              i === idx ? { ...x, factors: x.factors.filter((_, j) => j !== fIdx) } : x
                            )
                          })
                        }
                        className="p-1 text-dim hover:text-alert"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </Fold>
            </div>
          ))
        )}
      </div>
    </div>
    </WorldScopeProvider>
  )
}
