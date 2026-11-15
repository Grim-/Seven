import type { EffectOutcome } from '@shared/effects'
import { agentSheets } from '@shared/types'
import { useAgents } from '../../store/agents'
import { useReactions } from '../../store/reactions'
import { useSessions } from '../../store/sessions'
import { triggerVfx, type VfxCue } from '../../store/vfx'

const CARD_TONE_VFX: Record<string, VfxCue> = {
  ok: { preset: 'pulse', color: 'ok' },
  alert: { preset: 'hit', color: 'alert' },
  purple: { preset: 'glow', color: 'purple' },
  cyan: { preset: 'flash', color: 'cyan' }
}

/**
 * Triggers a reaction clip across any open sessions whose agent wears one of the matching character sheet ids.
 */
export function triggerReactionForSheets(sheetIds: (string | null | undefined)[], kind: string, seconds = 1.4): void {
  const wanted = new Set(sheetIds.filter((s): s is string => Boolean(s)))
  if (!wanted.size) return
  const matchingAgents = new Set(
    useAgents
      .getState()
      .list.filter((agent) => agentSheets(agent).some((sheet) => wanted.has(sheet)))
      .map((agent) => agent.id)
  )
  if (!matchingAgents.size) return
  const { trigger } = useReactions.getState()
  for (const session of useSessions.getState().list) {
    if (matchingAgents.has(session.agentId)) trigger(session.id, kind, seconds)
  }
}

/**
 * Maps numeric HP deltas in an `EffectOutcome` to visual hit/heal VFX and character avatar reactions.
 */
export function triggerOutcomeVfx(outcome: EffectOutcome | null | undefined, fallbackTargets: (string | null | undefined)[] = []): void {
  if (!outcome?.results.length) return
  for (const result of outcome.results) {
    if (typeof result.values.from !== 'number' || typeof result.values.to !== 'number' || result.values.from === result.values.to) continue
    const hurt = result.values.to < result.values.from
    const cue: VfxCue = hurt ? { preset: 'hit', color: 'alert' } : { preset: 'flash', color: 'ok' }
    const targets = result.target
      ? [`sheet:${result.target}`, `creature:${result.target}`, `token:${result.target}`]
      : fallbackTargets
    triggerVfx(targets, cue)
    if (result.target) triggerReactionForSheets([result.target], hurt ? 'hit' : 'heal')
  }
}

/**
 * Fires card-record and caster avatar VFX when a card play element arrives in chat.
 */
export function triggerCardPlayVfx(sessionId: string, cardName: string, tone: string | null | undefined): void {
  const cue = (tone && CARD_TONE_VFX[tone]) || { preset: 'glow' }
  triggerVfx([`avatar:${sessionId}`, cardName ? `card:${cardName}` : null], cue)
}
