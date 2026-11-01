import type { AgentProfile, ChatMessage, ChatSearchHit, MemorySearchHit, SessionMeta } from '@shared/types'
import { isVaultLocked } from '@shared/sealed'
import type { SessionStore } from './sessions/store'
import { tokenize, minds } from './mind/store'
import { vaultEvents } from './util/secure'

interface Doc {
  messageId: string
  role: 'user' | 'assistant'
  text: string
  lower: string
  at: number
}

const DAY = 86_400_000

export function snippet(text: string, terms: string[], before = 60, after = 140): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const lower = flat.toLowerCase()
  const at = terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0)
  const start = at.length ? Math.max(0, Math.min(...at) - before) : 0
  const end = Math.min(flat.length, start + before + after)
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`
}

function textOf(m: ChatMessage): string {
  return m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('').trim()
}

export class ChatSearch {
  private cache = new Map<string, { updatedAt: number; docs: Doc[] }>()

  constructor(
    private sessions: SessionStore,
    private agents: () => AgentProfile[]
  ) {
    vaultEvents.on('locked', () => this.cache.clear())
  }

  private docs(meta: SessionMeta): Doc[] {
    const cached = this.cache.get(meta.id)
    if (cached && cached.updatedAt === meta.updatedAt) return cached.docs
    const docs = this.sessions
      .messages(meta.id)
      .map((m) => {
        const text = textOf(m)
        return { messageId: m.id, role: m.role, text, lower: text.toLowerCase(), at: m.createdAt }
      })
      .filter((d) => d.text)
    this.cache.set(meta.id, { updatedAt: meta.updatedAt, docs })
    return docs
  }

  chats(query: string, limit = 30): { chats: ChatSearchHit[]; locked: boolean } {
    const terms = [...new Set(tokenize(query))]
    const phrase = query.trim().toLowerCase()
    if (!terms.length) return { chats: [], locked: false }
    let locked = false
    const now = Date.now()
    const chats: (ChatSearchHit & { score: number })[] = []
    for (const meta of this.sessions.list()) {
      if (meta.incognito) continue
      let docs: Doc[]
      try {
        docs = this.docs(meta)
      } catch (err) {
        if (isVaultLocked(err)) {
          locked = true
          continue
        }
        throw err
      }
      const titleLower = meta.title.toLowerCase()
      const titleHit = terms.every((t) => titleLower.includes(t))
      let best: { doc: Doc; score: number } | null = null
      let matches = 0
      for (const doc of docs) {
        if (!terms.every((t) => doc.lower.includes(t))) continue
        matches++
        let score = 0
        for (const t of terms) score += Math.min(5, doc.lower.split(t).length - 1)
        if (phrase.length > 2 && doc.lower.includes(phrase)) score += 5
        if (doc.role === 'user') score += 0.5
        if (!best || score > best.score) best = { doc, score }
      }
      if (!best && !titleHit) continue
      const recency = Math.max(0, 3 - (now - meta.updatedAt) / (30 * DAY))
      const score = (best?.score ?? 0) + (titleHit ? 6 : 0) + Math.log1p(matches) + recency
      chats.push({
        sessionId: meta.id,
        title: meta.title,
        agentId: meta.agentId,
        messageId: best?.doc.messageId ?? null,
        role: best?.doc.role ?? null,
        at: best?.doc.at ?? meta.updatedAt,
        snippet: best ? snippet(best.doc.text, terms) : '',
        matches,
        score
      })
    }
    chats.sort((a, b) => b.score - a.score || b.at - a.at)
    return { chats: chats.slice(0, limit).map(({ score: _s, ...c }) => c), locked }
  }

  async memory(query: string): Promise<{ memory: MemorySearchHit[]; locked: boolean }> {
    const terms = [...new Set(tokenize(query))]
    if (!terms.length) return { memory: [], locked: false }
    let locked = false
    const agents = this.agents().filter((a) => minds.hasIndex(a.id))
    const vec = agents.length ? await minds.embedQuery(query) : null
    const memory: (MemorySearchHit & { score: number })[] = []
    for (const agent of agents) {
      try {
        const hits = await minds.search(agent.id, query, 4, undefined, vec)
        for (const h of hits) memory.push({ agentId: agent.id, source: h.source, ref: h.ref, at: h.at, snippet: snippet(h.text, terms), similarity: h.similarity, score: h.score })
      } catch (err) {
        if (isVaultLocked(err)) locked = true
      }
    }
    memory.sort((a, b) => b.score - a.score || b.at - a.at)
    return { memory: memory.slice(0, 12).map(({ score: _s, ...m }) => m), locked }
  }
}
