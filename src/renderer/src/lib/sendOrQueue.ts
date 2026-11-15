import type { AgentProfile } from '@shared/types'
import type { ChatElement } from '@shared/chatElements'
import type { Conversation } from './conversation'
import { offerSend, queueComposer } from './composer'
import { failed } from './notify'
import { useModels } from '../store/models'
import { useSessions } from '../store/sessions'

export function chatCanAnswer(agent: AgentProfile): boolean {
  return agent.modelId !== null || useModels.getState().host.modelId !== null
}

export function sendOrQueue(conv: Conversation, text: string, send: boolean, elements: ChatElement[] = []): void {
  if (!send) {
    queueComposer(conv.key, text)
    offerSend(conv.key)
    return useSessions.getState().attachElements(conv.key, elements)
  }
  void useSessions.getState().send(conv, text, elements).catch((err: unknown) => {
    queueComposer(conv.key, text)
    useSessions.getState().attachElements(conv.key, elements)
    failed('Could not send it, so it is in the chat box')(err)
  })
}
