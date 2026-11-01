import { EventEmitter } from 'node:events'
import type { PanelItem, ViewRef } from '@shared/types'
import { newId } from '../util/fs'
import { chatFiles } from '../sessions/access'

const MAX_ITEMS = 200
const FILE = 'panel.json'

export interface PanelShow {
  view: ViewRef
  key?: string | null
  tab?: string | null
}

export interface PanelAccess {
  show(item: PanelShow): string
  remove(key: string): boolean
}

class PanelStore extends EventEmitter {
  list(sessionId: string): PanelItem[] {
    const items = chatFiles(sessionId).readJson<PanelItem[]>(FILE, [])
    return Array.isArray(items) ? items : []
  }

  private save(sessionId: string, items: PanelItem[]): void {
    const kept = items.slice(-MAX_ITEMS)
    chatFiles(sessionId).writeJson(FILE, kept)
    this.emit('changed', sessionId, kept)
  }

  show(sessionId: string, module: string, defaultTab: string, item: PanelShow): string {
    const items = this.list(sessionId)
    const now = Date.now()
    const key = item.key?.trim() || null
    const tab = item.tab?.trim() || defaultTab
    const existing = key ? items.findIndex((i) => i.module === module && i.key === key) : -1
    if (existing > -1) {
      const updated: PanelItem = { ...items[existing], tab, view: item.view, updatedAt: now }
      items.splice(existing, 1)
      items.push(updated)
      this.save(sessionId, items)
      return updated.id
    }
    const created: PanelItem = { id: newId('p'), key, tab, module, view: item.view, createdAt: now, updatedAt: now }
    items.push(created)
    this.save(sessionId, items)
    return created.id
  }

  remove(sessionId: string, match: (item: PanelItem) => boolean): boolean {
    const items = this.list(sessionId)
    const kept = items.filter((i) => !match(i))
    if (kept.length === items.length) return false
    this.save(sessionId, kept)
    return true
  }

  access(sessionId: string, module: string, defaultTab: string): PanelAccess {
    return {
      show: (item) => this.show(sessionId, module, defaultTab, item),
      remove: (key) => this.remove(sessionId, (i) => i.module === module && i.key === key)
    }
  }
}

export const panel = new PanelStore()
