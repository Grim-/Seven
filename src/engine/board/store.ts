import fs from 'node:fs'
import path from 'node:path'
import type { BoardMessage } from '@shared/types'
import { readJson, writeJson } from '../util/fs'
import { dataRoot } from '../util/paths'
import { ToolError } from '../tools/types'

const FILE = path.join(dataRoot, 'moduledata', 'board', 'messages.json')

class BoardStore {
  private notify: () => void = () => undefined
  private nameOf: (agentId: string) => string = () => 'an agent'
  private seen = new Map<string, number>()

  onChange(fn: () => void): void {
    this.notify = fn
  }

  setNames(fn: (agentId: string) => string): void {
    this.nameOf = fn
  }

  list(): BoardMessage[] {
    return readJson<BoardMessage[]>(FILE, [])
  }

  private write(list: BoardMessage[]): void {
    fs.mkdirSync(path.dirname(FILE), { recursive: true })
    writeJson(FILE, list)
    this.notify()
  }

  private find(id: string): BoardMessage {
    const hit = this.list().find((m) => m.id === id)
    if (!hit) throw new ToolError(`No message ${id} on the board.`)
    return hit
  }

  add(agentId: string | null, text: string): BoardMessage {
    const body = text.trim()
    if (!body) throw new ToolError('Give the message some text.')
    const at = Date.now()
    const message: BoardMessage = { id: `m${at.toString(36)}`, agentId, author: agentId ? this.nameOf(agentId) : 'You', text: body, at, editedAt: null }
    this.write([...this.list(), message])
    return message
  }

  update(id: string, text: string): BoardMessage {
    const next = { ...this.find(id), text: text.trim(), editedAt: Date.now() }
    this.write(this.list().map((m) => (m.id === id ? next : m)))
    return next
  }

  remove(id: string): void {
    this.find(id)
    this.write(this.list().filter((m) => m.id !== id))
  }

  recent(count: number): BoardMessage[] {
    return this.list().slice(-Math.max(1, count))
  }

  text(list: BoardMessage[]): string {
    return list.map((m) => `- ${m.author}, ${new Date(m.at).toLocaleString()}: ${m.text}`).join('\n')
  }

  unseen(sessionId: string, count: number): string {
    const latest = this.recent(count)
    const last = latest[latest.length - 1]
    if (!last || (this.seen.get(sessionId) ?? 0) >= (last.editedAt ?? last.at)) return ''
    this.seen.set(sessionId, last.editedAt ?? last.at)
    return `\n\n[Message board, latest:]\n${this.text(latest)}`
  }
}

export const board = new BoardStore()
