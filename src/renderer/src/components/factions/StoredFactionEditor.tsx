import { Shield, Users, X } from 'lucide-react'
import {
  FACTION_STANCES,
  FACTION_TEMPERAMENTS,
  type FactionStance,
  type StoredFaction
} from '@shared/game/factions'
import { Button, Field, Input, Segmented, Select, TagInput } from '../ui'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { cn } from '../../lib/cn'
import { LinkTextarea } from '../data/LinkTextarea'
import { useGameDefs } from '../game/useGameDefs'
import { FactionStanceMatrix } from './FactionMatrix'

interface Props {
  worldId?: string | null
  value: StoredFaction
  onChange: (next: StoredFaction) => void
}

const STANCE_CONFIG: Record<FactionStance, { label: string; badgeClass: string; hint: string }> = {
  allied: {
    label: 'Allied',
    badgeClass: 'text-ok border-ok/40 bg-ok/10',
    hint: 'Shares goals, resources, and fights together in combat'
  },
  friendly: {
    label: 'Friendly',
    badgeClass: 'text-secondary-ink border-secondary-ink/40 bg-secondary-ink/10',
    hint: 'Welcoming, trades freely, shares intelligence'
  },
  neutral: {
    label: 'Neutral',
    badgeClass: 'text-dim border-line bg-transparent',
    hint: 'Passive, indifferent, minds their own business unless provoked'
  },
  unfriendly: {
    label: 'Unfriendly',
    badgeClass: 'text-accent border-accent/40 bg-accent/10',
    hint: 'Suspicious, reluctant to help, hostile if pushed'
  },
  hostile: {
    label: 'Hostile',
    badgeClass: 'text-alert border-alert/40 bg-alert/10',
    hint: 'Sworn enemy, attacks on sight or aggressively confronts'
  }
}

export function StoredFactionEditor({ worldId, value, onChange }: Props) {
  const effectiveWorld = worldId ?? value.worldId ?? null
  const allFactions =
    useLive(() => engine('factions.list', effectiveWorld ? { world: effectiveWorld } : undefined), 'factions.changed', [
      effectiveWorld
    ]) ?? []
  const allCreatures = useLive(() => engine('library.find', { query: '', kind: 'game_creature' }), 'game.changed') ?? []
  const allCharTemplates = useLive(() => engine('library.find', { query: '', kind: 'game_character' }), 'game.changed') ?? []
  const allMonsters = useLive(() => engine('library.find', { query: '', kind: 'monster' }), 'dnd.changed') ?? []
  const statDefs = useGameDefs('stat').list ?? []
  const otherFactions = allFactions.filter((f) => f.id !== value.id)
  const statById = new Map(statDefs.map((s) => [s.id, s]))
  const currentStats = value.stats ?? {}
  const availableStats = statDefs.filter((s) => !(s.id in currentStats))

  const rosterOptions = [
    ...allCreatures.map((c) => ({ value: `game:${c.id}`, label: `${c.title} (Creature)` })),
    ...allCharTemplates.map((c) => ({ value: `game_character:${c.id}`, label: `${c.title} (Character Template)` })),
    ...allMonsters.map((m) => ({ value: `dnd:${m.id}`, label: `${m.title} (D&D Monster)` }))
  ].filter((o) => !(value.roster ?? []).includes(o.value))

  const rosterLabelOf = (ref: string) => {
    const [src, id] = ref.includes(':') ? ref.split(':') : ['', ref]
    if (src === 'game') return allCreatures.find((c) => c.id === id)?.title ?? ref
    if (src === 'game_character') return allCharTemplates.find((c) => c.id === id)?.title ?? ref
    if (src === 'dnd') return allMonsters.find((m) => m.id === id)?.title ?? ref
    return ref
  }

  const setStanceFor = (otherId: string, stance: FactionStance | null) => {
    const nextRelations = { ...value.relations }
    if (stance === null || stance === value.defaultStance) {
      delete nextRelations[otherId]
    } else {
      nextRelations[otherId] = stance
    }
    onChange({ ...value, relations: nextRelations })
  }

  const setNoteFor = (otherId: string, note: string) => {
    const relationNotes = { ...(value.relationNotes ?? {}) }
    if (note) relationNotes[otherId] = note
    else delete relationNotes[otherId]
    onChange({ ...value, relationNotes })
  }

  return (
    <div className="flex flex-col gap-4 font-ui select-none">
      {/* BASIC INFO */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Faction Name">
          <Input
            value={value.name}
            placeholder="e.g. Riverwood Guard, Undead Legion, Iron Fang Ogres..."
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            className="h-8 text-[13px]"
          />
        </Field>

        <Field label="Kind Link Identifier">
          <div className="flex h-8 items-center border border-line/60 tone-well-40 px-3 font-ui text-[12px] text-accent">
            {effectiveWorld ? `@world:${effectiveWorld}/faction/` : '@faction:'}
            {value.id || '(will be generated from name)'}
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Leader (Optional)">
          <SheetSelect
            value={value.leaderSheet ?? null}
            noneLabel="— No named leader —"
            onChange={(leaderSheet) => onChange({ ...value, leaderSheet })}
            className="h-8 text-[12px]"
          />
        </Field>
        <Field label="Relative Power (0–100)" tip="Overall relative power on a fixed 0–100 scale so factions can be compared at a glance.">
          <Input
            type="number"
            min={0}
            max={100}
            value={value.power !== undefined ? String(value.power) : ''}
            placeholder="0–100 (e.g. 50)"
            onChange={(e) => {
              const raw = e.target.value.trim()
              if (!raw) {
                onChange({ ...value, power: undefined })
                return
              }
              const n = Math.max(0, Math.min(100, Math.round(Number(raw) || 0)))
              onChange({ ...value, power: n })
            }}
            className="h-8 text-[12px]"
          />
        </Field>
      </div>

      {/* FACTION STATS (FROM STAT KINDS) & CHARACTER */}
      <div className="flex flex-col gap-3 border border-line/40 tone-panel-30 p-3">
        <div className="flex items-center justify-between border-b border-line/40 pb-2">
          <span className="font-label text-[11px] font-bold caps-5 text-ink">
            Faction Stats &amp; Character (Used by Agents &amp; Event Scoring)
          </span>
          <span className="text-[10.5px] text-faint">Uses Stat kinds or 0–100 Power</span>
        </div>

        <div className="flex flex-col gap-2">
          {Object.entries(currentStats).length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.entries(currentStats).map(([statId, val]) => {
                const def = statById.get(statId)
                const min = typeof def?.values?.min === 'number' ? def.values.min : 0
                const max = typeof def?.values?.max === 'number' ? def.values.max : 100
                const label = def?.name ?? statId
                const boundsText = `${min}–${max}`
                return (
                  <div
                    key={statId}
                    className="flex items-center justify-between gap-2 border border-line/40 tone-well-40 px-2.5 py-1.5"
                    title={def?.notes || undefined}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[12px] font-medium text-ink">{label}</span>
                        <span className="text-[10px] text-faint">{boundsText}</span>
                      </div>
                      {def?.notes && (
                        <div className="truncate text-[10.5px] text-dim">{def.notes}</div>
                      )}
                    </div>
                    <Input
                      type="number"
                      min={min}
                      max={max}
                      value={String(val)}
                      onChange={(e) => {
                        const raw = e.target.value.trim()
                        const n = raw ? Math.max(min, Math.min(max, Number(raw) || 0)) : min
                        onChange({ ...value, stats: { ...currentStats, [statId]: n } })
                      }}
                      className="h-7 w-20 text-right text-[12px]"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<X className="h-3.5 w-3.5" />}
                      title={`Remove ${label}`}
                      onClick={() => {
                        const next = { ...currentStats }
                        delete next[statId]
                        onChange({ ...value, stats: Object.keys(next).length ? next : undefined })
                      }}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {availableStats.length > 0 ? (
            <Select
              value=""
              options={[
                { value: '', label: '+ Add Stat kind to this faction…' },
                ...availableStats.map((s) => ({
                  value: s.id,
                  label: s.notes ? `${s.name} — ${s.notes}` : s.name
                }))
              ]}
              onChange={(statId) => {
                if (!statId) return
                const def = statById.get(statId)
                const min = typeof def?.values?.min === 'number' ? def.values.min : 0
                const max = typeof def?.values?.max === 'number' ? def.values.max : 100
                const dflt = typeof def?.values?.default === 'number' ? def.values.default : 50
                const initial = Math.max(min, Math.min(max, dflt))
                onChange({ ...value, stats: { ...currentStats, [statId]: initial } })
              }}
              className="h-8 w-full text-[11.5px] sm:w-80"
            />
          ) : (
            <span className="text-[11px] text-faint">
              Define Stat kinds in Data → Game → Stats to attach custom faction stats.
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] caps-5 text-dim">Temperament</span>
          <div className="flex flex-wrap gap-1">
            {FACTION_TEMPERAMENTS.map((trait) => {
              const active = (value.temperament ?? []).includes(trait)
              return (
                <button
                  key={trait}
                  type="button"
                  onClick={() => {
                    const cur = value.temperament ?? []
                    const next = active ? cur.filter((t) => t !== trait) : [...cur, trait]
                    onChange({ ...value, temperament: next.length ? next : undefined })
                  }}
                  className={cn(
                    'border px-2 py-0.5 text-[11px] transition-colors',
                    active ? 'border-accent bg-accent/15 font-semibold text-ink' : 'border-line/40 text-dim hover:border-line hover:text-ink'
                  )}
                >
                  {trait}
                </button>
              )
            })}
          </div>
          <TagInput
            value={value.temperament ?? []}
            placeholder="Add custom temperament trait…"
            onChange={(list) => onChange({ ...value, temperament: list.length ? list : undefined })}
          />
        </div>

        <Field label="Operating Doctrine / Methods">
          <Input
            value={value.doctrine ?? ''}
            placeholder="e.g. Polite and formal in public, ruthless behind closed doors."
            onChange={(e) => onChange({ ...value, doctrine: e.target.value })}
            className="h-8 text-[12px]"
          />
        </Field>
      </div>

      {/* DEFAULT STANCE */}
      <div className="flex flex-col gap-1.5 border border-line/40 tone-panel-30 p-3">
        <div className="flex items-center gap-2 text-dim">
          <Shield className="h-3.5 w-3.5 text-secondary-ink" />
          <span className="font-label text-[11px] font-bold caps-5 text-ink">
            Default Diplomatic Stance
          </span>
          <span className="text-[11px] text-faint">
            (used when interacting with unlisted factions or travelers)
          </span>
        </div>
        <div className="mt-1">
          <Segmented
            value={value.defaultStance}
            options={FACTION_STANCES.map((s) => ({
              value: s,
              label: STANCE_CONFIG[s].label,
              hint: STANCE_CONFIG[s].hint
            }))}
            onChange={(defaultStance) => onChange({ ...value, defaultStance })}
          />
        </div>
      </div>

      {/* DESCRIPTION & AGENT ROLEPLAY GUIDELINES */}
      <Field label="Ideology & Agent Roleplay Guidelines (Passed to local models)">
        <LinkTextarea rolls={false}
          value={value.description}
          placeholder="Describe their tenets, motives, behavioral quirks, and negotiation limits. When an agent plays an NPC of this faction, it reads this markdown to guide dialogue and combat decisions..."
          rows={4}
          onValue={(v) => onChange({ ...value, description: v })}
          className="text-[12.5px] leading-relaxed"
        />
      </Field>

      {/* ASSOCIATED CHARACTERS & NPC ROSTER (OPTIONAL) */}
      <div className="flex flex-col gap-3 border border-line/40 tone-panel-30 p-3">
        <div className="flex items-center justify-between border-b border-line/40 pb-2">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-accent" />
            <span className="font-label text-[11px] font-bold caps-5 text-ink">
              Named Characters &amp; NPC Roster (Optional)
            </span>
          </div>
          <span className="text-[11px] text-dim">
            {(value.members ?? []).length} sheet{(value.members ?? []).length === 1 ? '' : 's'} · {(value.roster ?? []).length} template{(value.roster ?? []).length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] caps-5 text-dim">Named Character Sheets</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {(value.members ?? []).map((sheetId) => (
              <span
                key={sheetId}
                className="inline-flex items-center gap-1 border border-accent/50 bg-accent/10 px-2 py-0.5 text-[11px] text-ink"
              >
                <span>@sheet:{sheetId}</span>
                <button
                  type="button"
                  onClick={() => onChange({ ...value, members: (value.members ?? []).filter((m) => m !== sheetId) })}
                  className="text-dim hover:text-alert cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <SheetSelect
              value={null}
              noneLabel="+ Add character sheet…"
              onChange={(id) => {
                if (!id || (value.members ?? []).includes(id)) return
                onChange({ ...value, members: [...(value.members ?? []), id] })
              }}
              className="h-7 w-56 text-[11px]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-line/30 pt-2">
          <span className="text-[10px] caps-5 text-dim">
            Generic NPC / Creature / Monster Roster (leave empty for an open shell)
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {(value.roster ?? []).map((ref) => (
              <span
                key={ref}
                className="inline-flex items-center gap-1 border border-secondary-ink/50 bg-secondary-ink/10 px-2 py-0.5 text-[11px] text-ink"
              >
                <span>{rosterLabelOf(ref)}</span>
                <button
                  type="button"
                  onClick={() => onChange({ ...value, roster: (value.roster ?? []).filter((r) => r !== ref) })}
                  className="text-dim hover:text-alert cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <Select
              value=""
              options={[{ value: '', label: '+ Add NPC / creature / monster block…' }, ...rosterOptions]}
              onChange={(ref) => {
                if (!ref || (value.roster ?? []).includes(ref)) return
                onChange({ ...value, roster: [...(value.roster ?? []), ref] })
              }}
              className="h-7 w-64 text-[11px]"
            />
          </div>
        </div>
      </div>

      {/* HOSTILITY & DIPLOMATIC MATRIX */}
      <div className="flex flex-col gap-2 border border-line/40 tone-panel-30 p-3">
        <div className="flex items-center justify-between border-b border-line/40 pb-2">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-secondary-ink" />
            <span className="font-label text-[11px] font-bold caps-5 text-ink">
              Diplomatic Relations &amp; Hostility Matrix
            </span>
          </div>
          <span className="text-[11px] text-dim">
            {Object.keys(value.relations).length} custom relationship override{Object.keys(value.relations).length === 1 ? '' : 's'}
          </span>
        </div>

        {otherFactions.length === 0 ? (
          <div className="py-4 text-center text-[12px] text-faint">
            No other factions registered yet. Create more factions in this world to configure relations.
          </div>
        ) : (
          <FactionStanceMatrix
            factionName={value.name}
            defaultStance={value.defaultStance}
            otherFactions={otherFactions}
            relations={value.relations}
            relationNotes={value.relationNotes ?? {}}
            onSetStance={setStanceFor}
            onSetNote={setNoteFor}
          />
        )}
      </div>

      {/* TAGS */}
      <Field label="Tags">
        <TagInput
          value={value.tags}
          onChange={(tags) => onChange({ ...value, tags })}
        />
      </Field>
    </div>
  )
}
