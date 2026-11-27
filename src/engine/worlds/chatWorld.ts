import { isGameplayScene, type SessionSceneBinding } from '@shared/almanac'
import { agentSheets, type AgentProfile, type ChatWorld } from '@shared/types'
import { agentAccess } from '../agents/access'
import { sessionAccess } from '../sessions/access'
import { worldEvents } from './events'
import { worldOfSheet } from './members'

export function chatWorld(scene: SessionSceneBinding | null | undefined, agent: AgentProfile | null): ChatWorld {
  if (scene?.mode === 'meta' && scene.eventId) return { world: worldEvents.find(scene.eventId)?.worldId || null, sheets: [] }
  if (scene && isGameplayScene(scene)) return { world: scene.worldId ?? null, sheets: [] }
  const refs = [...new Set([...agentSheets(agent), ...(scene?.playerSheet ? [scene.playerSheet] : []), ...(agent?.player ? [agent.player] : [])])]
  const sheets = refs.map((sheet) => ({ sheet, world: worldOfSheet(sheet) }))
  const found = [...new Set(sheets.flatMap((s) => (s.world ? [s.world] : [])))]
  return { world: found.length === 1 ? found[0] : null, sheets }
}

export function sessionWorld(sessionId: string | null | undefined, agentId: string | null | undefined): string | null {
  const session = sessionId ? sessionAccess.get(sessionId) : undefined
  const agent = agentAccess.get(agentId ?? session?.agentId ?? '')
  return chatWorld(session?.scene, agent).world
}

export function sheetsOutside(world: string, sheets: string[]): { sheet: string; world: string | null }[] {
  return sheets.map((sheet) => ({ sheet, world: worldOfSheet(sheet) })).filter((s) => s.world !== world)
}
