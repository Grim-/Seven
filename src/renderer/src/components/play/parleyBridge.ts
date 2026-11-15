import { conversationOf, focusedConversation } from '../../lib/conversation'
import { chatCanAnswer, sendOrQueue } from '../../lib/sendOrQueue'
import { useAgents } from '../../store/agents'
import { useApp } from '../../store/app'
import { draftOf, useSessions } from '../../store/sessions'
import { toast } from '../../store/toasts'
import { setTabletopMode } from '../chat/tabletopStore'
import { effectLogElement } from './EffectLogElement'
import type { PlayOutcome } from './playStore'

export interface ParleyHandoff {
  npcSheet: string | null
  npcName: string
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
  const conv = focusedConversation() ?? conversationOf('chat')
  const sessions = useSessions.getState()
  const activeAgentId = conv.sessionId
    ? (sessions.list.find((s) => s.id === conv.sessionId)?.agentId ?? draftOf(sessions, conv.key).agentId)
    : draftOf(sessions, conv.key).agentId
  const agent = useAgents.getState().list.find((a) => a.id === activeAgentId) ?? null
  const canSend = agent ? chatCanAnswer(agent) : false

  const npcRef = handoff.npcSheet ? `${handoff.npcName} (@sheet:${handoff.npcSheet})` : handoff.npcName
  const whereRef = handoff.placeKey ? ` in @place:${handoff.placeKey}` : ''
  const playerRef = handoff.playerSheet
    ? ` The user plays ${handoff.playerName ?? handoff.playerSheet} (@sheet:${handoff.playerSheet}).`
    : handoff.playerName
      ? ` The user plays ${handoff.playerName}.`
      : ''

  const lines = [handoff.checkLine, ...(handoff.effectLines ?? [])].filter((x): x is string => Boolean(x))

  const prompt = [
    `You are now playing as NPC: ${npcRef}${whereRef}.${playerRef}`,
    ...lines,
    `The user says: "${handoff.said}"`,
    `Reply in character as ${handoff.npcName}.`
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

  sendOrQueue(conv, prompt, canSend, [element])
  setTabletopMode({ peekTable: false })

  if (handoff.switchToChat) {
    useApp.getState().setView('chat')
  } else if (useApp.getState().view !== 'chat') {
    toast.info(`Sent to ${agent?.name ?? 'Agent'} (${handoff.npcName})`, handoff.said, {
      label: 'Open Chat',
      onSelect: () => {
        setTabletopMode({ windowed: true, showPlayTable: true, peekTable: false })
        useApp.getState().setView('chat')
      }
    })
  }
}
