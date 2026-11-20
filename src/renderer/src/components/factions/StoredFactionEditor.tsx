import { Shield, Users, X } from 'lucide-react'
import {
  FACTION_STANCES,
  type FactionStance,
  type StoredFaction
} from '@shared/game/factions'
import { Field, Input, Segmented, Select, TagInput, Textarea } from '../ui'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { cn } from '../../lib/cn'

interface Props {
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
    badgeClass: 'text-cyan border-cyan/40 bg-cyan/10',
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

export function StoredFactionEditor({ value, onChange }: Props) {
  const allFactions = useLive(() => engine('factions.list'), 'factions.changed') ?? []
  const allCreatures = useLive(() => engine('library.find', { query: '', kind: 'game_creature' }), 'game.changed') ?? []
  const allCharTemplates = useLive(() => engine('library.find', { query: '', kind: 'game_character' }), 'game.changed') ?? []
  const allMonsters = useLive(() => engine('library.find', { query: '', kind: 'monster' }), 'dnd.changed') ?? []
  const otherFactions = allFactions.filter((f) => f.id !== value.id)

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

  return (
    <div className="flex flex-col gap-4 font-mono select-none">
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
          <div className="flex h-8 items-center border border-line/60 bg-black/40 px-3 font-mono text-[12px] text-accent">
            @faction:{value.id || '(will be generated from name)'}
          </div>
        </Field>
      </div>

      {/* DEFAULT STANCE */}
      <div className="flex flex-col gap-1.5 border border-line/40 bg-black/30 p-3">
        <div className="flex items-center gap-2 text-dim">
          <Shield className="h-3.5 w-3.5 text-cyan" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-white">
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
        <Textarea
          value={value.description}
          placeholder="Describe their tenets, motives, behavioral quirks, and negotiation limits. When an agent plays an NPC of this faction, it reads this markdown to guide dialogue and combat decisions..."
          rows={4}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          className="text-[12.5px] leading-relaxed"
        />
      </Field>

      {/* ASSOCIATED CHARACTERS & NPC ROSTER (OPTIONAL) */}
      <div className="flex flex-col gap-3 border border-line/40 bg-black/30 p-3">
        <div className="flex items-center justify-between border-b border-line/40 pb-2">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-accent" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-white">
              Named Characters &amp; NPC Roster (Optional)
            </span>
          </div>
          <span className="text-[11px] text-dim">
            {(value.members ?? []).length} sheet{(value.members ?? []).length === 1 ? '' : 's'} · {(value.roster ?? []).length} template{(value.roster ?? []).length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-dim">Named Character Sheets</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {(value.members ?? []).map((sheetId) => (
              <span
                key={sheetId}
                className="inline-flex items-center gap-1 border border-accent/50 bg-accent/10 px-2 py-0.5 text-[11px] text-white"
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
          <span className="text-[10px] uppercase tracking-wider text-dim">
            Generic NPC / Creature / Monster Roster (leave empty for an open shell)
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {(value.roster ?? []).map((ref) => (
              <span
                key={ref}
                className="inline-flex items-center gap-1 border border-cyan/50 bg-cyan/10 px-2 py-0.5 text-[11px] text-white"
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
      <div className="flex flex-col gap-2 border border-line/40 bg-black/30 p-3">
        <div className="flex items-center justify-between border-b border-line/40 pb-2">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-cyan" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-white">
              Diplomatic Relations &amp; Hostility Matrix
            </span>
          </div>
          <span className="text-[11px] text-dim">
            {Object.keys(value.relations).length} custom relationship override{Object.keys(value.relations).length === 1 ? '' : 's'}
          </span>
        </div>

        {otherFactions.length === 0 ? (
          <div className="py-4 text-center text-[12px] text-faint">
            No other factions registered yet. Create more factions in Data to configure relations.
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-line/20">
            {otherFactions.map((target) => {
              const currentStance = value.relations[target.id] ?? value.defaultStance
              const isOverridden = Boolean(value.relations[target.id])

              return (
                <div key={target.id} className="flex items-center justify-between py-2.5">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-semibold text-white/90">
                      {target.name}
                    </span>
                    <span className="text-[10.5px] text-accent">
                      @faction:{target.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {FACTION_STANCES.map((stance) => {
                      const active = currentStance === stance
                      const cfg = STANCE_CONFIG[stance]

                      return (
                        <button
                          key={stance}
                          type="button"
                          title={cfg.hint}
                          onClick={() => setStanceFor(target.id, stance)}
                          className={cn(
                            'border px-2 py-0.5 text-[11px] font-bold uppercase transition-all',
                            active
                              ? cfg.badgeClass
                              : 'border-transparent text-faint hover:border-line/40 hover:text-dim'
                          )}
                        >
                          {cfg.label}
                        </button>
                      )
                    })}

                    {isOverridden && (
                      <button
                        type="button"
                        title="Reset relation to default stance"
                        onClick={() => setStanceFor(target.id, null)}
                        className="ml-2 text-[10.5px] text-faint hover:text-alert"
                      >
                        [Reset]
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
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
