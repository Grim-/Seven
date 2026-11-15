import type { ComponentType } from 'react'
import type { ChatElement } from '@shared/chatElements'

export interface ChatElementProps {
  data: Record<string, unknown>
  messageId: string
}

export type TextCover = 'fold' | 'hide' | null

export interface ChatElementType {
  View: ComponentType<ChatElementProps>
  covers?: (data: Record<string, unknown>) => TextCover
}

const registry = new Map<string, ChatElementType>()

export function registerChatElement(type: string, def: ChatElementType): void {
  registry.set(type, def)
}

export function chatElementType(element: ChatElement): ChatElementType | null {
  return registry.get(element.type) ?? null
}
