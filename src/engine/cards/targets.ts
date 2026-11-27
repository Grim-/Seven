import type { EffectTargetRef } from '@shared/effects'
import { toId } from '@shared/ids'
import { moduleList, type ModuleEntry } from '@shared/moduleList'
import { agentSheets, chatPlayer, type AgentProfile } from '@shared/types'
import { actorLink } from '@shared/worldNpcs'
import { agentAccess } from '../agents/access'
import { getSheet, sheetIds } from '../library/sheets'
import { moduleIsOn } from '../modules/isOn'
import { ToolError, type ToolContext } from '../tools/types'
import { ifMissing } from '../util/report'
import { worlds } from '../worlds/store'
import { bindingOrNull } from '../worlds/ops'

export interface PlayTargetCandidate {
  id: string
  name: string
  link: string
  ref: EffectTargetRef | null
  sheetId: string | null
  hittable: boolean
}

export interface PlayTargetResolveContext {
  agent: AgentProfile
  world: string | null
  playerSheet: string | null
  caster: PlayTargetCandidate
}

export interface PlayTargetSource extends ModuleEntry {
  list: (ctx: PlayTargetResolveContext) => PlayTargetCandidate[]
}

export const playTargetSources = moduleList<PlayTargetSource>()

function sheetCandidate(id: string): PlayTargetCandidate {
  const sheet = getSheet(id)
  return {
    id: `sheet:${sheet.id}`,
    name: sheet.title,
    link: actorLink(sheet.id),
    ref: { sheet: sheet.id },
    sheetId: sheet.id,
    hittable: Boolean(sheet.game)
  }
}

playTargetSources.add({
  id: 'cards-sheets',
  module: 'cards',
  name: 'Character sheets',
  order: 0,
  list: () => sheetIds().map((s) => sheetCandidate(s.id))
})

function casterFor(agent: AgentProfile): PlayTargetCandidate {
  const sheetId = agentSheets(agent)[0] ?? null
  if (sheetId) return sheetCandidate(sheetId)
  return { id: `agent:${agent.id}`, name: agent.name, link: agent.name, ref: null, sheetId: null, hittable: false }
}

function userFor(playerSheet: string | null): PlayTargetCandidate {
  if (playerSheet) return sheetCandidate(playerSheet)
  return { id: 'user', name: 'The user', link: 'the user', ref: null, sheetId: null, hittable: false }
}

function dedupeCandidates(all: PlayTargetCandidate[]): PlayTargetCandidate[] {
  const seen = new Set<string>()
  return all.filter((c) => (seen.has(c.id) ? false : Boolean(seen.add(c.id))))
}

function matchTarget(query: string, candidates: PlayTargetCandidate[]): PlayTargetCandidate {
  const raw = query.trim()
  const qId = toId(raw)
  const lower = raw.toLowerCase()
  const exact = candidates.filter((c) => c.id === raw || c.id.toLowerCase() === lower || (qId && toId(c.name) === qId))
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) {
    throw new ToolError(`Ambiguous target "${raw}". Choose one of: ${exact.map((c) => `${c.name} [${c.id}]`).join(', ')}.`)
  }
  const partial = candidates.filter((c) => (qId && toId(c.name).includes(qId)) || (lower && c.name.toLowerCase().includes(lower)) || c.id.toLowerCase().includes(lower))
  if (partial.length === 1) return partial[0]
  if (partial.length > 1) {
    throw new ToolError(`Ambiguous target "${raw}". Choose one of: ${partial.map((c) => c.name).join(', ')}.`)
  }
  const sample = candidates.slice(0, 12).map((c) => c.name)
  const hint = sample.length ? `Available: self, user, ${sample.join(', ')}.` : 'Available: self, user.'
  throw new ToolError(`Target "${raw}" not found. ${hint}`)
}

export function resolveCardParticipants(
  targetQuery: string | null,
  ctx: ToolContext
): { agent: AgentProfile; world: string | null; playerSheet: string | null; caster: PlayTargetCandidate; target: PlayTargetCandidate } {
  const agent = ctx.agentId ? agentAccess.get(ctx.agentId) : null
  if (!agent) throw new ToolError('Only an agent can play a card here.')
  const world = bindingOrNull(agent.id)?.worldId ?? null
  const worldPlayer = world ? ifMissing(() => worlds.meta(world).player, null) : null
  const playerSheet = chatPlayer(agent, worldPlayer)
  const caster = casterFor(agent)
  const user = userFor(playerSheet)
  const raw = targetQuery?.trim() ?? ''
  const key = toId(raw)
  if (!raw || key === 'user' || key === 'player') {
    return { agent, world, playerSheet, caster, target: user }
  }
  if (key === 'self' || key === 'me') {
    return { agent, world, playerSheet, caster, target: caster }
  }
  const rctx: PlayTargetResolveContext = { agent, world, playerSheet, caster }
  const candidates = dedupeCandidates([caster, user, ...playTargetSources.on(moduleIsOn).flatMap((s) => s.list(rctx))])
  return { agent, world, playerSheet, caster, target: matchTarget(raw, candidates) }
}
