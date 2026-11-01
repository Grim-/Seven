import { EventEmitter } from 'node:events'
import { cleanBackdrop, type Backdrop, type ChatBackdrops } from '@shared/types'
import { chatFiles } from './sessions/access'

const EMPTY: ChatBackdrops = { chat: null, timed: null }
const FILE = 'backdrop.json'

class BackdropStore extends EventEmitter {
  get(sessionId: string): ChatBackdrops {
    const raw = chatFiles(sessionId).readJson<Partial<ChatBackdrops>>(FILE, EMPTY)
    const chat = cleanBackdrop(raw.chat)
    const timedBackdrop = cleanBackdrop(raw.timed?.backdrop)
    const until = typeof raw.timed?.until === 'number' ? raw.timed.until : 0
    return { chat, timed: timedBackdrop && until > Date.now() ? { backdrop: timedBackdrop, until } : null }
  }

  set(sessionId: string, scope: 'chat' | 'timed', backdrop: Backdrop | null, minutes = 10): ChatBackdrops {
    const current = this.get(sessionId)
    const clean = cleanBackdrop(backdrop)
    const next: ChatBackdrops =
      scope === 'chat'
        ? { chat: clean, timed: clean ? current.timed : null }
        : { chat: current.chat, timed: clean ? { backdrop: clean, until: Date.now() + Math.min(120, Math.max(1, minutes)) * 60_000 } : null }
    chatFiles(sessionId).writeJson(FILE, next)
    this.emit('changed', sessionId, next)
    return next
  }

  setApp(backdrop: Backdrop | null): void {
    this.emit('app', cleanBackdrop(backdrop))
  }
}

export const backdrops = new BackdropStore()
