import { BrowserWindow, Notification } from 'electron'
import type { EventMessage } from '@shared/protocol'
import type { ChatMessage } from '@shared/types'
import { mainSecure } from './vault'

function textOf(message: ChatMessage): string {
  const text = message.parts
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 140 ? `${text.slice(0, 137)}...` : text
}

export function createNotifier(showApp: (sessionId: string | null) => void): (message: EventMessage) => void {
  const seen = new Set<string>()
  const show = (title: string, body: string, sessionId: string | null) => {
    if (!Notification.isSupported()) return
    const n = new Notification({ title, body, silent: false })
    n.on('click', () => showApp(sessionId))
    n.show()
  }
  const away = () => BrowserWindow.getFocusedWindow() === null

  return ({ event, payload }) => {
    if (event === 'ui.notify') {
      const p = payload as { sessionId: string | null; title: string; message: string }
      if (mainSecure.enabled) show('Seven', 'The agent sent you a notification. Open Seven to read it.', p.sessionId)
      else show(p.title, p.message, p.sessionId)
      return
    }
    if (event === 'reminder.fired') {
      const p = payload as { kind: string; text: string | null; sessionId: string | null }
      const title = p.kind === 'run' ? 'Seven: scheduled task started' : 'Seven: reminder'
      const body = p.text === null ? 'Something is due. Unlock Seven to see it.' : mainSecure.enabled ? 'Open Seven to see it.' : p.text
      show(title, body, p.sessionId)
      return
    }
    if (!away()) return
    if (event === 'turn.finish') {
      const p = payload as { sessionId: string; message: ChatMessage }
      if (p.message.status === 'aborted') return
      const failed = p.message.status === 'error'
      const body = mainSecure.enabled ? (failed ? 'Something went wrong.' : 'The reply is ready.') : failed ? (p.message.error ?? 'Something went wrong') : textOf(p.message) || 'The reply is ready.'
      show(failed ? 'Seven: reply failed' : 'Seven replied', body, p.sessionId)
      return
    }
    if (event === 'message.part') {
      const p = payload as { sessionId: string; part: { name: string; ui?: { id: string; kind: string; status: string; props: { title?: string; question?: string } } } }
      const ui = p.part.ui
      if (!ui || ui.status !== 'pending' || seen.has(ui.id)) return
      seen.add(ui.id)
      const title = ui.kind === 'approval' ? 'Seven needs your approval' : ui.kind === 'unlock' ? 'Seven needs the vault unlocked' : 'Seven has a question'
      const what = mainSecure.enabled
        ? 'Open Seven to answer.'
        : ui.kind === 'approval'
          ? (ui.props.title ?? `Approve ${p.part.name}`)
          : (ui.props.question ?? 'The agent has a question')
      show(title, what, p.sessionId)
    }
  }
}
