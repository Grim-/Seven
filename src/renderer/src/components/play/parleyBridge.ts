import { conversationOf, focusedConversation, openChat } from '../../lib/conversation'
import { chatCanAnswer, sendOrQueue } from '../../lib/sendOrQueue'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useAgents } from '../../store/agents'
import { useApp } from '../../store/app'
import { draftOf, useSessions } from '../../store/sessions'
import { toast } from '../../store/toasts'
import { setTabletopMode } from '../chat/tabletopStore'
import { effectLogElement } from './EffectLogElement'
import { findGameplaySession } from './gameplaySession'
import type { PlayOutcome } from './playStore'

export interface ParleyHandoff {
  npcSheet: string | null
  npcName: string
  worldId?: string | null
  saveId?: string | null
  playerSheet?: string | null
  playerName?: string
  placeKey?: string | null
  said: string
  checkLine?: string | null
  outcome?: PlayOutcome | null
  effectLines?: string[]
  switchToChat?: boolean
}

export function sendParleyToChat(handoff: ParleyHandoff): void {
  const sessions = useSessions.getState()
  const gameplaySession = handoff.worldId ? findGameplaySession(sessions.list, handoff.worldId, handoff.saveId) : null

  if (handoff.worldId && !gameplaySession) {
    toast.info('No Gameplay Chat Connected', 'Start a Gameplay Chat in the chat overlay to speak with the agent in this world.')
    return
  }

  const conv = focusedConversation() ?? conversationOf('chat')
  const targetSessionId = gameplaySession?.id ?? conv.sessionId
  const activeAgentId = targetSessionId
    ? (sessions.list.find((s) => s.id === targetSessionId)?.agentId ?? draftOf(sessions, conv.key).agentId)
    : draftOf(sessions, conv.key).agentId
  const agent = useAgents.getState().list.find((a) => a.id === activeAgentId) ?? null
  const canSend = agent ? chatCanAnswer(agent) : false

  const npcRef = handoff.npcSheet ? `${handoff.npcName} (@sheet:${handoff.npcSheet})` : handoff.npcName
  const whereRef = handoff.placeKey
    ? handoff.worldId
      ? ` in @world:${handoff.worldId}/place/${handoff.placeKey}`
      : ` in @place:${handoff.placeKey}`
    : ''
  const playerRef = handoff.playerSheet
    ? ` The user plays ${handoff.playerName ?? handoff.playerSheet} (@sheet:${handoff.playerSheet}).`
    : handoff.playerName
      ? ` The user plays ${handoff.playerName}.`
      : ''

  const lines = [handoff.checkLine, ...(handoff.effectLines ?? [])].filter((x): x is string => Boolean(x))

  const prompt = [
    handoff.npcSheet
      ? `You are now playing as NPC: ${npcRef}${whereRef}.${playerRef}`
      : `In-world player action${whereRef}.${playerRef}`,
    ...lines,
    `The user says: "${handoff.said}"`,
    handoff.npcSheet ? `Reply in character as ${handoff.npcName}.` : 'Respond as the world narrator.'
  ].join('\n')

  const element = effectLogElement({
    title: handoff.checkLine ? 'PARLEY · NPC TAKEOVER' : 'NPC DIALOGUE',
    attempt: `${handoff.playerName ?? 'Player'} speaks with ${handoff.npcName}`,
    said: `"${handoff.said}"`,
    actor: handoff.playerSheet ?? null,
    target: handoff.npcSheet ?? null,
    place: handoff.placeKey ?? null,
    outcome: handoff.outcome ?? { tone: 'purple', label: 'Parley', detail: handoff.npcName },
    lines
  })

  if (gameplaySession) {
    if (!canSend) {
      toast.info('Agent Not Ready', `${agent?.name ?? 'The bound agent'} has no active model configured.`)
      return
    }
    void engine('sessions.send', { id: gameplaySession.id, text: prompt, elements: [element] }).catch(
      failed('Could not send message to Gameplay Chat')
    )
  } else {
    sendOrQueue(conv, prompt, canSend, [element])
  }
  setTabletopMode({ peekTable: false })

  if (handoff.switchToChat) {
    if (gameplaySession) openChat(gameplaySession.id)
    useApp.getState().setView('chat')
  } else if (!gameplaySession && useApp.getState().view !== 'chat') {
    toast.info(`Sent to ${agent?.name ?? 'Agent'} (${handoff.npcName})`, handoff.said, {
      label: 'Open Chat',
      onSelect: () => {
        setTabletopMode({ windowed: true, showPlayTable: true, peekTable: false })
        useApp.getState().setView('chat')
      }
    })
  }
}
