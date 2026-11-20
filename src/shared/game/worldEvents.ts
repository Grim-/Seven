import { toId } from '../ids'
import { cleanComponents } from './core/params'
import type { ComponentDef } from './core/registry'

export type WorldEventScopeLevel = 'global' | 'map' | 'area' | 'place'
export type WorldEventStatus = 'dormant' | 'active' | 'resolved'

export interface WorldEventRumour {
  id: string
  headline?: string
  text: string
  reach: WorldEventScopeLevel
}

export type WorldEventParticipantKind = 'faction' | 'sheet' | 'creature' | 'monster' | 'figure'

export interface WorldEventParticipant {
  id: string
  kind: WorldEventParticipantKind
  /** Optional Kind entry ID (`factionId`, `sheetId`, `game_creature` id, or D&D `monster` id). Empty for unlisted/improvised figures. */
  refId?: string
  /** Display name (used for unlisted/improvised `'figure'` or as a custom override). */
  name?: string
  /** Optional faction affiliation (for factions, matches `refId`; for individuals/creatures/figures, optional allegiance). */
  factionId?: string
  /** Optional named sheet IDs when `kind === 'faction'`; may be empty so the agent improvises representatives. */
  characters?: string[]
  role: string
  power: number
}

export interface WorldEventScoreFactor {
  label: string
  kind: 'power' | 'flag' | 'fixed'
  factionId?: string
  participantId?: string
  flag?: string
  expected?: string | number | boolean
  weight: number
}

export interface WorldEventOutcome {
  id: string
  label: string
  summary: string
  winnerFactionId?: string | null
  factors: WorldEventScoreFactor[]
  varianceDie?: number
  triggerActionIds: string[]
  effects: ComponentDef[]
}

export interface WorldEventScoreRow {
  outcomeId: string
  label: string
  total: number
  roll: number
  terms: string[]
}

export interface WorldEventResolution {
  outcomeId: string
  outcomeLabel: string
  resolvedAt: number
  mode: 'scored' | 'direct'
  breakdown: WorldEventScoreRow[]
  transcriptSummary?: string
}

export interface WorldEventRuntime {
  status: WorldEventStatus
  resolution?: WorldEventResolution | null
}

export interface WorldEvent {
  id: string
  worldId: string
  title: string
  premise: string
  scope: { level: WorldEventScopeLevel; refId: string }
  status: WorldEventStatus
  rumours: WorldEventRumour[]
  participants: WorldEventParticipant[]
  outcomes: WorldEventOutcome[]
  tags: string[]
  updatedAt: number
}

export interface ResolvedWorldEvent extends WorldEvent {
  resolution?: WorldEventResolution | null
}

const LEVELS: readonly WorldEventScopeLevel[] = ['global', 'map', 'area', 'place']
const STATUSES: readonly WorldEventStatus[] = ['dormant', 'active', 'resolved']
const PARTICIPANT_KINDS: readonly WorldEventParticipantKind[] = ['faction', 'sheet', 'creature', 'monster', 'figure']

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const cleanLevel = (v: unknown): WorldEventScopeLevel => (LEVELS.includes(v as WorldEventScopeLevel) ? (v as WorldEventScopeLevel) : 'global')
const cleanStatus = (v: unknown): WorldEventStatus => (STATUSES.includes(v as WorldEventStatus) ? (v as WorldEventStatus) : 'dormant')
const cleanParticipantKind = (v: unknown): WorldEventParticipantKind =>
  PARTICIPANT_KINDS.includes(v as WorldEventParticipantKind) ? (v as WorldEventParticipantKind) : 'faction'

export function cleanWorldEventRuntime(raw: unknown): WorldEventRuntime | null {
  const v = obj(raw)
  if (!v.status) return null
  const res = v.resolution && typeof v.resolution === 'object' ? obj(v.resolution) : null
  const resolution: WorldEventResolution | null =
    res && str(res.outcomeId)
      ? {
          outcomeId: str(res.outcomeId),
          outcomeLabel: str(res.outcomeLabel),
          resolvedAt: num(res.resolvedAt, Date.now()),
          mode: res.mode === 'direct' ? 'direct' : 'scored',
          breakdown: Array.isArray(res.breakdown)
            ? res.breakdown.map((r) => {
                const row = obj(r)
                return {
                  outcomeId: str(row.outcomeId),
                  label: str(row.label),
                  total: num(row.total, 0),
                  roll: num(row.roll, 0),
                  terms: Array.isArray(row.terms) ? row.terms.map(str).filter(Boolean) : []
                }
              })
            : [],
          ...(str(res.transcriptSummary) ? { transcriptSummary: str(res.transcriptSummary) } : {})
        }
      : null
  return { status: cleanStatus(v.status), ...(resolution ? { resolution } : {}) }
}

export function cleanWorldEvent(raw: unknown): WorldEvent | null {
  const v = obj(raw)
  const title = str(v.title)
  if (!title) return null
  const id = (str(v.id) && toId(str(v.id))) || toId(title)
  const sc = obj(v.scope)
  const rumours: WorldEventRumour[] = Array.isArray(v.rumours)
    ? v.rumours
        .map((r, i) => {
          const item = obj(r)
          const text = str(item.text)
          if (!text) return null
          return {
            id: str(item.id) || `rumour_${i + 1}`,
            ...(str(item.headline) ? { headline: str(item.headline) } : {}),
            text,
            reach: cleanLevel(item.reach)
          }
        })
        .filter((x): x is WorldEventRumour => Boolean(x))
    : []
  const participants: WorldEventParticipant[] = Array.isArray(v.participants)
    ? v.participants
        .map((p, i): WorldEventParticipant | null => {
          const item = obj(p)
          const kind = cleanParticipantKind(item.kind)
          const legacyFaction = str(item.factionId)
          const refId = str(item.refId) || (kind === 'faction' ? legacyFaction : '')
          const name = str(item.name)
          const factionId = kind === 'faction' ? refId : legacyFaction
          if (!refId && !name && !factionId) return null
          const legacyLeader = str(item.leaderSheet)
          const rawChars = Array.isArray(item.characters) ? item.characters.map(str).filter(Boolean) : []
          const characters = [...new Set([...rawChars, ...(legacyLeader ? [legacyLeader] : [])])]
          return {
            id: str(item.id) || `part_${i + 1}`,
            kind,
            ...(refId ? { refId } : {}),
            ...(name ? { name } : {}),
            ...(factionId ? { factionId } : {}),
            ...(characters.length ? { characters } : {}),
            role: str(item.role),
            power: num(item.power, 0)
          }
        })
        .filter((x): x is WorldEventParticipant => Boolean(x))
    : []
  const outcomes: WorldEventOutcome[] = Array.isArray(v.outcomes)
    ? v.outcomes
        .map((o, i): WorldEventOutcome | null => {
          const item = obj(o)
          const label = str(item.label)
          if (!label) return null
          const factors: WorldEventScoreFactor[] = Array.isArray(item.factors)
            ? item.factors
                .map((f) => {
                  const fac = obj(f)
                  const kind = fac.kind === 'power' || fac.kind === 'flag' ? fac.kind : 'fixed'
                  return {
                    label: str(fac.label) || kind,
                    kind,
                    ...(str(fac.factionId) ? { factionId: str(fac.factionId) } : {}),
                    ...(str(fac.participantId) ? { participantId: str(fac.participantId) } : {}),
                    ...(str(fac.flag) ? { flag: str(fac.flag) } : {}),
                    ...(fac.expected !== undefined ? { expected: fac.expected as string | number | boolean } : {}),
                    weight: num(fac.weight, 1)
                  }
                })
            : []
          return {
            id: (str(item.id) && toId(str(item.id))) || toId(label) || `outcome_${i + 1}`,
            label,
            summary: str(item.summary),
            winnerFactionId: str(item.winnerFactionId) || null,
            factors,
            ...(typeof item.varianceDie === 'number' && item.varianceDie > 0 ? { varianceDie: Math.floor(item.varianceDie) } : {}),
            triggerActionIds: Array.isArray(item.triggerActionIds) ? item.triggerActionIds.map(str).filter(Boolean) : [],
            effects: cleanComponents(item.effects)
          }
        })
        .filter((x): x is WorldEventOutcome => Boolean(x))
    : []

  const tags = Array.isArray(v.tags) ? v.tags.map(str).filter(Boolean).map((t) => toId(t)) : []

  return {
    id,
    worldId: str(v.worldId),
    title,
    premise: str(v.premise),
    scope: { level: cleanLevel(sc.level), refId: str(sc.refId) },
    status: cleanStatus(v.status),
    rumours,
    participants,
    outcomes,
    tags,
    updatedAt: num(v.updatedAt, Date.now())
  }
}

export function blankWorldEvent(worldId = ''): WorldEvent {
  return {
    id: '',
    worldId,
    title: '',
    premise: '',
    scope: { level: 'global', refId: '' },
    status: 'active',
    rumours: [],
    participants: [],
    outcomes: [],
    tags: [],
    updatedAt: Date.now()
  }
}

/** Public, non-clairvoyant markdown view of a World Event (never exposes meta premise or hidden outcomes). */
export function worldEventPublicMarkdown(event: ResolvedWorldEvent): string {
  const lines = [
    `# ${event.title}`,
    `- Status: ${event.status}`,
    `- Scope: ${event.scope.level}${event.scope.refId ? ` (${event.scope.refId})` : ''}`
  ]
  if (event.status === 'active' && event.rumours.length) {
    lines.push('\n## Rumours & News')
    for (const r of event.rumours) {
      lines.push(`- ${r.headline ? `**${r.headline}:** ` : ''}${r.text} *(reach: ${r.reach})*`)
    }
  }
  if (event.resolution) {
    lines.push(`\n## Outcome\n- **${event.resolution.outcomeLabel}** (${event.resolution.mode})`)
  }
  return lines.join('\n')
}

export interface ScoreContext {
  flags: Record<string, string | number | boolean>
  rng?: () => number
}

/** Deterministically scores all defined outcomes of a WorldEvent using real save flags, participant power, and optional bounded variance. */
export function scoreWorldEventOutcomes(
  event: WorldEvent,
  ctx: ScoreContext
): { winner: WorldEventOutcome | null; breakdown: WorldEventScoreRow[] } {
  if (!event.outcomes.length) return { winner: null, breakdown: [] }
  const rand = ctx.rng ?? Math.random
  const powerByFaction = new Map<string, number>()
  const powerByParticipant = new Map<string, number>()
  for (const p of event.participants) {
    powerByParticipant.set(p.id, p.power)
    const fid = p.factionId || (p.kind === 'faction' ? p.refId : '')
    if (fid) powerByFaction.set(fid, (powerByFaction.get(fid) ?? 0) + p.power)
  }

  const breakdown: WorldEventScoreRow[] = event.outcomes.map((o) => {
    let total = 0
    const terms: string[] = []
    for (const f of o.factors) {
      if (f.kind === 'power') {
        const p = f.participantId
          ? (powerByParticipant.get(f.participantId) ?? 0)
          : f.factionId
            ? (powerByFaction.get(f.factionId) ?? 0)
            : 0
        const add = p * f.weight
        total += add
        terms.push(`${f.label}: ${add >= 0 ? '+' : ''}${add}`)
      } else if (f.kind === 'flag' && f.flag) {
        const cur = ctx.flags[f.flag]
        const matched = f.expected !== undefined ? cur === f.expected : Boolean(cur)
        if (matched) {
          total += f.weight
          terms.push(`${f.label}: ${f.weight >= 0 ? '+' : ''}${f.weight}`)
        }
      } else {
        total += f.weight
        terms.push(`${f.label}: ${f.weight >= 0 ? '+' : ''}${f.weight}`)
      }
    }
    const roll = o.varianceDie && o.varianceDie > 1 ? Math.floor(rand() * o.varianceDie) + 1 : 0
    if (roll > 0) {
      total += roll
      terms.push(`d${o.varianceDie}: +${roll}`)
    }
    return { outcomeId: o.id, label: o.label, total, roll, terms }
  })

  const best = [...breakdown].sort((a, b) => b.total - a.total)[0]
  const winner = event.outcomes.find((o) => o.id === best?.outcomeId) ?? event.outcomes[0]
  return { winner, breakdown }
}

export interface RumourScopeFilter {
  mapId?: string | null
  placeKeys?: string[]
}

/**
 * Returns ONLY diegetic rumours/news from currently ACTIVE events whose reach covers the given scope.
 * Events with no rumours or dormant/resolved status emit nothing (zero meta leakage, zero clairvoyance).
 */
export function worldEventRumours(
  events: ResolvedWorldEvent[],
  filter: RumourScopeFilter
): { eventId: string; headline?: string; text: string }[] {
  const placeSet = new Set(filter.placeKeys ?? [])
  const out: { eventId: string; headline?: string; text: string }[] = []
  for (const ev of events) {
    if (ev.status !== 'active' || !ev.rumours.length) continue
    for (const r of ev.rumours) {
      const reaches =
        r.reach === 'global' ||
        (r.reach === 'map' && (!ev.scope.refId || ev.scope.refId === filter.mapId)) ||
        ((r.reach === 'area' || r.reach === 'place') && (!ev.scope.refId || placeSet.has(ev.scope.refId)))
      if (reaches) out.push({ eventId: ev.id, headline: r.headline, text: r.text })
    }
  }
  return out
}

/** Formats full meta-narrative context strictly for an isolated `mode: 'meta'` scene when the player chooses Watch Scene. */
export function worldEventMetaMarkdown(
  event: ResolvedWorldEvent,
  extra?: { participantDetails?: string[]; factionTensions?: string[] }
): string {
  const lines = [
    `## Meta-Narrative Event: ${event.title}`,
    `- Scope: ${event.scope.level}${event.scope.refId ? ` (${event.scope.refId})` : ''}`,
    ...(event.premise ? [`- Premise: ${event.premise}`] : [])
  ]
  if (extra?.factionTensions?.length) {
    lines.push('- Faction tensions:')
    for (const t of extra.factionTensions) lines.push(`  - ${t}`)
  }
  if (extra?.participantDetails?.length) {
    lines.push('- Participating figureheads:')
    for (const p of extra.participantDetails) lines.push(`  - ${p}`)
  }
  return lines.join('\n')
}
