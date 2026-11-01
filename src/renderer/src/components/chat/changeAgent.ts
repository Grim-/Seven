import type { AgentProfile } from '@shared/types'
import { useAgents } from '../../store/agents'
import { useSessions } from '../../store/sessions'
import { failed } from '../../lib/notify'
import { focusedConversation } from '../../lib/conversation'

export async function changeAgent(agent: AgentProfile, patch: Partial<AgentProfile>, what: string): Promise<void> {
  try {
    await useAgents.getState().save({ ...agent, ...patch })
    const sessionId = focusedConversation()?.sessionId
    if (sessionId && useSessions.getState().running[sessionId] !== true) await useSessions.getState().refreshInstructions(sessionId)
  } catch (err) {
    failed(`Could not change the ${what}`)(err)
  }
}
