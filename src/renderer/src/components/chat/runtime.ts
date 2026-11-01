import { useMemo, useRef } from 'react'
import { useExternalStoreRuntime, type AppendMessage, type AssistantRuntime, type ThreadMessageLike } from '@assistant-ui/react'
import type { ChatMessage } from '@shared/types'

type ToolCallLike = Extract<Exclude<ThreadMessageLike['content'], string>[number], { type: 'tool-call' }>
import { useSessions } from '../../store/sessions'
import { useCommands } from '../../store/commands'
import { toast } from '../../store/toasts'
import { errorText } from '../../lib/format'
import { useConversation } from '../../lib/conversation'

const EMPTY: ChatMessage[] = []

function convert(message: ChatMessage): ThreadMessageLike {
  const content = message.parts.map((part) => {
    if (part.type === 'thought') return { type: 'reasoning', text: part.text } as const
    if (part.type === 'tool')
      return {
        type: 'tool-call',
        toolCallId: part.id,
        toolName: part.name,
        args: part.args as ToolCallLike['args'],
        argsText: JSON.stringify(part.args),
        result: part.status === 'running' ? undefined : (part.result ?? part.error ?? ''),
        isError: part.status === 'error',
        artifact: part
      } as const
    return { type: 'text', text: part.text } as const
  })
  const status: ThreadMessageLike['status'] =
    message.role === 'user'
      ? undefined
      : message.status === 'running'
        ? { type: 'running' }
        : message.status === 'aborted'
          ? { type: 'incomplete', reason: 'cancelled' }
          : message.status === 'error'
            ? { type: 'incomplete', reason: 'error', error: message.error ?? 'Unknown error' }
            : { type: 'complete', reason: 'stop' }
  return {
    id: message.id,
    role: message.role,
    content,
    createdAt: new Date(message.createdAt),
    status,
    metadata: { custom: { error: message.error ?? null, notice: message.notice ?? null } }
  }
}

function textOf(message: AppendMessage): string {
  return message.content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('\n')
    .trim()
}

export function useSevenRuntime() {
  const conv = useConversation()
  const messages = useSessions((s) => (conv.sessionId ? (s.messages[conv.sessionId] ?? EMPTY) : EMPTY))
  const running = useSessions((s) => (conv.sessionId ? s.running[conv.sessionId] === true : false))
  const self = useRef<AssistantRuntime | null>(null)

  const adapter = useMemo(
    () => ({
      messages,
      isRunning: running,
      convertMessage: convert,
      onNew: async (message: AppendMessage) => {
        const text = textOf(message)
        if (!text) return
        if (text.startsWith('/') && !text.startsWith('//')) return useCommands.getState().run(conv, text)
        try {
          await useSessions.getState().send(conv, text.startsWith('//') ? text.slice(1) : text)
        } catch (err) {
          toast.error('Could not send', errorText(err))
          const composer = self.current?.thread.composer
          if (composer && !composer.getState().text.trim()) composer.setText(text)
        }
      },
      onCancel: async () => {
        if (conv.sessionId) await useSessions.getState().abort(conv.sessionId)
      }
    }),
    [messages, running, conv]
  )

  const runtime = useExternalStoreRuntime<ChatMessage>(adapter)
  self.current = runtime
  return runtime
}
