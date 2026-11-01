import path from 'node:path'
import { EventEmitter } from 'node:events'
import type { ContextPrefs } from '@shared/types'
import { dataRoot } from '../util/paths'
import { readJson, writeJson } from '../util/fs'

const FILE = path.join(dataRoot, 'context-prefs.json')

const DEFAULTS: ContextPrefs = { memoryCap: 2000, saveChatState: false }

function clean(input: unknown): ContextPrefs {
  const value = (input ?? {}) as Partial<ContextPrefs>
  const cap = typeof value.memoryCap === 'number' && Number.isFinite(value.memoryCap) ? value.memoryCap : DEFAULTS.memoryCap
  return {
    memoryCap: Math.round(Math.min(16000, Math.max(200, cap))),
    saveChatState: typeof value.saveChatState === 'boolean' ? value.saveChatState : DEFAULTS.saveChatState
  }
}

class ContextPrefsStore extends EventEmitter {
  private prefs: ContextPrefs = clean(readJson(FILE, null))

  get(): ContextPrefs {
    return this.prefs
  }

  set(patch: Partial<ContextPrefs>): ContextPrefs {
    this.prefs = clean({ ...this.prefs, ...patch })
    writeJson(FILE, this.prefs)
    this.emit('changed')
    return this.prefs
  }
}

export const contextPrefs = new ContextPrefsStore()
