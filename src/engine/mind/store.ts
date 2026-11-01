import fs from 'node:fs'
import path from 'node:path'
import type { JournalEntry, Memory, MindHit, MindIndexing, MindOverview, MindPrefs, Thought } from '@shared/types'
import { appendLine, newId, readJson, readLines, writeJson, writeLines } from '../util/fs'
import { dataRoot } from '../util/paths'
import { secure, vaultEvents } from '../util/secure'
import { isVaultLocked } from '@shared/sealed'
import { Embedder } from './embedder'
import { timeline } from '../timeline/store'
import { sessionAccess } from '../sessions/access'

const INCOGNITO = 'This is an incognito chat: it keeps no memories or thoughts.'

const ROOT = path.join(dataRoot, 'mind')
const PREFS = path.join(dataRoot, 'mind-prefs.json')
const CHUNK_CHARS = 1200
const RRF_K = 60
const MIN_SIMILARITY = 0.25
export const MAX_MEMORY = 1000

type Source = MindHit['source']

interface Chunk {
  id: string
  at: number
  source: Source
  ref: string
  version?: number
  text: string
  model: string | null
  vec: string | null
}

interface Loaded {
  chunks: Chunk[]
  vectors: (Float32Array | null)[]
  tokens: string[][]
  active: boolean[]
  df: Map<string, number>
  avgLen: number
}

interface Events {
  changed: (agentId: string) => void
  indexing: (progress: MindIndexing) => void
  pinned: (sessionId: string) => void
}

function safe(id: string): string {
  return id.replace(/[^\w-]/g, '_')
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1)
}

function encodeVec(v: Float32Array): string {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64')
}

function decodeVec(s: string | null): Float32Array | null {
  if (!s) return null
  const buf = Buffer.from(s, 'base64')
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
}

function normalize(v: Float32Array): Float32Array {
  let n = 0
  for (const x of v) n += x * x
  n = Math.sqrt(n) || 1
  return v.map((x) => x / n)
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) s += a[i] * b[i]
  return s
}

function splitText(text: string, max = CHUNK_CHARS): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim()
  if (!clean) return []
  if (clean.length <= max) return [clean]
  const out: string[] = []
  let current = ''
  const push = () => {
    if (current.trim()) out.push(current.trim())
    current = ''
  }
  for (const para of clean.split(/\n{2,}/)) {
    if (para.length > max) {
      push()
      for (const s of para.split(/(?<=[.!?])\s+/)) {
        if (s.length > max) {
          push()
          for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max))
        } else if (current.length + s.length + 1 > max) {
          push()
          current = s
        } else current = current ? `${current} ${s}` : s
      }
      push()
    } else if (current.length + para.length + 2 > max) {
      push()
      current = para
    } else current = current ? `${current}\n\n${para}` : para
  }
  push()
  return out
}

function monthKey(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthOf(id: string): string | null {
  const m = /^[jt]_(\d{4})(\d{2})_/.exec(id)
  return m ? `${m[1]}-${m[2]}` : null
}

export class Minds {
  readonly embedder = new Embedder()
  private loaded = new Map<string, Loaded>()
  private locks = new Map<string, Promise<unknown>>()
  private listeners: { [K in keyof Events]: Events[K][] } = { changed: [], indexing: [], pinned: [] }
  private modelPath: (id: string) => string | null = () => null

  constructor() {
    vaultEvents.on('locked', () => this.loaded.clear())
    vaultEvents.on('unlocked', () => {
      this.loaded.clear()
      this.applyPrefs()
      void this.backfillAll()
    })
  }

  setup(opts: { modelPath: (id: string) => string | null }): void {
    this.modelPath = opts.modelPath
    this.applyPrefs()
    if (!secure.enabled) void this.backfillAll()
  }

  on<K extends keyof Events>(event: K, fn: Events[K]): void {
    this.listeners[event].push(fn)
  }

  private changed(agentId: string): void {
    for (const fn of this.listeners.changed) fn(agentId)
  }

  getPrefs(): MindPrefs {
    let p: Partial<MindPrefs> = {}
    try {
      p = readJson<Partial<MindPrefs>>(PREFS, {})
    } catch (err) {
      if (!isVaultLocked(err)) throw err
    }
    return { embeddingModelId: typeof p.embeddingModelId === 'string' ? p.embeddingModelId : null }
  }

  setPrefs(patch: Partial<MindPrefs>): MindPrefs {
    const next = { ...this.getPrefs(), ...patch }
    writeJson(PREFS, next)
    this.applyPrefs()
    if (!secure.enabled || secure.unlocked) void this.backfillAll()
    return next
  }

  private applyPrefs(): void {
    const id = this.getPrefs().embeddingModelId
    this.embedder.configure(id, id ? this.modelPath(id) : null)
  }

  private file(agentId: string, ...parts: string[]): string {
    return path.join(ROOT, safe(agentId), ...parts)
  }

  private serial<T>(agentId: string, fn: () => Promise<T> | T): Promise<T> {
    const prev = this.locks.get(agentId) ?? Promise.resolve()
    const next = prev.then(fn, fn)
    this.locks.set(
      agentId,
      next.catch(() => undefined)
    )
    return next
  }

  private async addChunks(agentId: string, source: Source, ref: string, text: string, at: number, version?: number): Promise<void> {
    const chunks: Chunk[] = []
    for (const piece of splitText(text)) {
      const emb = await this.embedder.embed(piece)
      chunks.push({ id: newId('c'), at, source, ref, ...(version !== undefined ? { version } : {}), text: piece, model: emb?.model ?? null, vec: emb ? encodeVec(normalize(emb.vector)) : null })
    }
    if (!chunks.length) return
    await this.serial(agentId, () => {
      for (const c of chunks) appendLine(this.file(agentId, 'index.jsonl'), c)
      this.loaded.delete(agentId)
    })
    this.changed(agentId)
  }

  memories(agentId: string): Memory[] {
    return readJson<Memory[]>(this.file(agentId, 'memories.json'), []).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
  }

  memory(agentId: string, id: string): Memory | null {
    return this.memories(agentId).find((m) => m.id === id.trim()) ?? null
  }

  private saveMemories(agentId: string, list: Memory[]): void {
    writeJson(this.file(agentId, 'memories.json'), list)
    this.loaded.delete(agentId)
    this.changed(agentId)
  }

  async remember(agentId: string, input: { id: string | null; text: string; pinned: boolean; by: Memory['by']; sessionId: string | null }): Promise<Memory> {
    if (sessionAccess.isIncognito(input.sessionId)) throw new Error(INCOGNITO)
    const text = input.text.trim()
    if (!text) throw new Error('A memory needs some text. Set text to the thing to remember, in a sentence or two.')
    if (text.length > MAX_MEMORY) throw new Error(`Keep a memory under ${MAX_MEMORY} characters; save separate things as separate memories`)
    const list = this.memories(agentId)
    const existing = input.id ? list.find((m) => m.id === input.id) : undefined
    if (input.id && !existing) throw new Error(`There is no memory ${input.id}. Leave id empty to keep this as a new memory.`)
    const at = Date.now()
    const memory: Memory = existing
      ? { ...existing, text, pinned: input.pinned, updatedAt: at }
      : { id: newId('m'), text, pinned: input.pinned, by: input.by, sessionId: input.sessionId, createdAt: at, updatedAt: at }
    this.saveMemories(agentId, existing ? list.map((m) => (m.id === memory.id ? memory : m)) : [...list, memory])
    timeline.record({ kind: 'memory', entry: agentId, action: 'remembered', by: input.by === 'user' ? null : agentId, chat: input.sessionId })
    if (input.sessionId && (memory.pinned || existing?.pinned)) for (const fn of this.listeners.pinned) fn(input.sessionId)
    await this.addChunks(agentId, 'memory', memory.id, text, at, at)
    return memory
  }

  forget(agentId: string, id: string, sessionId: string | null): Memory {
    const list = this.memories(agentId)
    const memory = list.find((m) => m.id === id.trim())
    if (!memory) throw new Error(`There is no memory ${id}. recall with no query lists the memories and their ids.`)
    this.saveMemories(agentId, list.filter((m) => m.id !== memory.id))
    if (sessionId && memory.pinned) for (const fn of this.listeners.pinned) fn(sessionId)
    return memory
  }

  pinnedForPrompt(agentId: string, cap: number, count: (text: string) => number): string {
    const lines = this.memories(agentId)
      .filter((m) => m.pinned)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((m) => `- ${m.text.replace(/\s*\n\s*/g, ' ')}`)
    while (lines.length > 1 && count(lines.join('\n')) > cap) lines.shift()
    return lines.join('\n')
  }

  think(agentId: string, input: Omit<Thought, 'id' | 'at'>): Thought {
    if (sessionAccess.isIncognito(input.sessionId)) throw new Error(INCOGNITO)
    const at = Date.now()
    const thought: Thought = { id: `t_${monthKey(at).replace('-', '')}_${newId('').slice(1)}`, at, ...input }
    appendLine(this.file(agentId, 'thoughts', `${monthKey(at)}.jsonl`), thought)
    this.changed(agentId)
    return thought
  }

  private months(agentId: string, folder: string): string[] {
    const dir = this.file(agentId, folder)
    if (!fs.existsSync(dir)) return []
    return fs
      .readdirSync(dir)
      .filter((n) => /^\d{4}-\d{2}\.jsonl$/.test(n))
      .map((n) => n.slice(0, 7))
      .sort()
      .reverse()
  }

  thoughts(agentId: string, month: string | null): { months: string[]; month: string | null; thoughts: Thought[] } {
    const months = this.months(agentId, 'thoughts')
    const pick = month && months.includes(month) ? month : (months[0] ?? null)
    const thoughts = pick ? readLines<Thought>(this.file(agentId, 'thoughts', `${pick}.jsonl`)) : []
    return { months, month: pick, thoughts: thoughts.sort((a, b) => b.at - a.at) }
  }

  allThoughts(agentId: string): Thought[] {
    return this.months(agentId, 'thoughts')
      .flatMap((m) => readLines<Thought>(this.file(agentId, 'thoughts', `${m}.jsonl`)))
      .sort((a, b) => b.at - a.at)
  }

  thought(agentId: string, id: string): Thought | null {
    const month = monthOf(id)
    if (!month || !id.startsWith('t_')) return null
    return readLines<Thought>(this.file(agentId, 'thoughts', `${month}.jsonl`)).find((t) => t.id === id) ?? null
  }

  setConclusion(agentId: string, id: string, conclusion: string): boolean {
    const month = monthOf(id)
    if (!month) return false
    const file = this.file(agentId, 'thoughts', `${month}.jsonl`)
    const list = readLines<Thought>(file)
    if (!list.some((t) => t.id === id)) return false
    writeLines(file, list.map((t) => (t.id === id ? { ...t, conclusion } : t)))
    this.changed(agentId)
    return true
  }

  forgetThought(agentId: string, id: string): boolean {
    const month = monthOf(id)
    if (!month) return false
    const file = this.file(agentId, 'thoughts', `${month}.jsonl`)
    const list = readLines<Thought>(file)
    const next = list.filter((t) => t.id !== id)
    if (next.length === list.length) return false
    writeLines(file, next)
    this.changed(agentId)
    return true
  }

  async recordTurn(agentId: string, entry: Omit<JournalEntry, 'id'>): Promise<void> {
    const id = `j_${monthKey(entry.at).replace('-', '')}_${newId('').slice(1)}`
    appendLine(this.file(agentId, 'journal', `${monthKey(entry.at)}.jsonl`), { id, ...entry } satisfies JournalEntry)
    this.changed(agentId)
    const text = [entry.user && `User: ${entry.user}`, entry.reply && `Reply: ${entry.reply}`, entry.tools.length ? `Tools used: ${entry.tools.map((t) => t.name).join(', ')}` : '']
      .filter(Boolean)
      .join('\n\n')
    await this.addChunks(agentId, 'journal', id, text, entry.at)
  }

  journal(agentId: string, month: string | null): { months: string[]; month: string | null; entries: JournalEntry[] } {
    const months = this.months(agentId, 'journal')
    const pick = month && months.includes(month) ? month : (months[0] ?? null)
    const entries = pick ? readLines<JournalEntry>(this.file(agentId, 'journal', `${pick}.jsonl`)) : []
    return { months, month: pick, entries: entries.sort((a, b) => b.at - a.at) }
  }

  async forgetJournal(agentId: string, id: string): Promise<boolean> {
    const month = monthOf(id)
    if (!month || !id.startsWith('j_')) return false
    const removed = await this.serial(agentId, () => {
      const file = this.file(agentId, 'journal', `${month}.jsonl`)
      const list = readLines<JournalEntry>(file)
      const next = list.filter((e) => e.id !== id)
      if (next.length === list.length) return false
      writeLines(file, next)
      const index = this.file(agentId, 'index.jsonl')
      const chunks = readLines<Chunk>(index)
      const kept = chunks.filter((c) => !(c.source === 'journal' && c.ref === id))
      if (kept.length !== chunks.length) writeLines(index, kept)
      this.loaded.delete(agentId)
      return true
    })
    if (removed) this.changed(agentId)
    return removed
  }

  journalEntry(agentId: string, id: string): JournalEntry | null {
    const month = monthOf(id)
    if (!month || !id.startsWith('j_')) return null
    return readLines<JournalEntry>(this.file(agentId, 'journal', `${month}.jsonl`)).find((e) => e.id === id) ?? null
  }

  private load(agentId: string): Loaded {
    const cached = this.loaded.get(agentId)
    if (cached) return cached
    const chunks = readLines<Chunk>(this.file(agentId, 'index.jsonl'))
    const memories = new Map(this.memories(agentId).map((m) => [m.id, m.updatedAt]))
    const vectors = chunks.map((c) => decodeVec(c.vec))
    const tokens = chunks.map((c) => tokenize(c.text))
    const active = chunks.map((c) => c.source !== 'memory' || memories.get(c.ref) === c.version)
    const df = new Map<string, number>()
    let total = 0
    tokens.forEach((t, i) => {
      if (!active[i]) return
      total += t.length
      for (const term of new Set(t)) df.set(term, (df.get(term) ?? 0) + 1)
    })
    const count = active.filter(Boolean).length
    const loaded: Loaded = { chunks, vectors, tokens, active, df, avgLen: count ? total / count : 1 }
    this.loaded.set(agentId, loaded)
    return loaded
  }

  hasIndex(agentId: string): boolean {
    return fs.existsSync(this.file(agentId, 'index.jsonl'))
  }

  embedQuery(query: string): Promise<{ model: string; vector: Float32Array } | null> {
    return this.embedder.embed(query)
  }

  async search(agentId: string, query: string, limit = 8, sources?: Source[], queryVec?: { model: string; vector: Float32Array } | null): Promise<MindHit[]> {
    const data = this.load(agentId)
    const terms = [...new Set(tokenize(query))]
    const n = data.active.filter(Boolean).length
    const usable = (i: number) => data.active[i] && (!sources || sources.includes(data.chunks[i].source))
    const keyword: { i: number; s: number }[] = []
    if (terms.length) {
      data.tokens.forEach((t, i) => {
        if (!usable(i)) return
        let s = 0
        for (const term of terms) {
          const tf = t.filter((x) => x === term).length
          if (!tf) continue
          const df = data.df.get(term) ?? 0
          const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5))
          s += (idf * tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (t.length / data.avgLen)))
        }
        if (s > 0) keyword.push({ i, s })
      })
      keyword.sort((a, b) => b.s - a.s)
    }
    const semantic: { i: number; s: number }[] = []
    const q = queryVec !== undefined ? queryVec : await this.embedder.embed(query)
    if (q) {
      const qv = normalize(q.vector)
      data.vectors.forEach((v, i) => {
        if (!v || !usable(i) || data.chunks[i].model !== q.model) return
        const sim = dot(qv, v)
        if (sim >= MIN_SIMILARITY) semantic.push({ i, s: sim })
      })
      semantic.sort((a, b) => b.s - a.s)
    }
    const fused = new Map<number, number>()
    const sim = new Map<number, number>()
    keyword.slice(0, 50).forEach(({ i }, rank) => fused.set(i, (fused.get(i) ?? 0) + 1 / (RRF_K + rank + 1)))
    semantic.slice(0, 50).forEach(({ i, s }, rank) => {
      fused.set(i, (fused.get(i) ?? 0) + 1 / (RRF_K + rank + 1))
      sim.set(i, s)
    })
    return [...fused.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([i, score]) => {
        const c = data.chunks[i]
        return { id: c.id, source: c.source, ref: c.ref, at: c.at, text: c.text, score, similarity: sim.get(i) ?? null }
      })
  }

  overview(agentId: string): MindOverview {
    const data = this.load(agentId)
    const count = (folder: string) =>
      this.months(agentId, folder).reduce((sum, m) => sum + fs.readFileSync(this.file(agentId, folder, `${m}.jsonl`), 'utf8').split('\n').filter((l) => l.trim()).length, 0)
    const memories = this.memories(agentId)
    const ats = data.chunks.map((c) => c.at)
    return {
      agentId,
      memories: memories.length,
      pinned: memories.filter((m) => m.pinned).length,
      thoughts: count('thoughts'),
      journal: count('journal'),
      chunks: data.chunks.length,
      indexed: data.chunks.filter((c) => c.model && c.model === this.embedder.id).length,
      firstAt: ats.length ? Math.min(...ats) : null
    }
  }

  private async backfill(agentId: string): Promise<void> {
    const model = this.embedder.id
    if (!model || !fs.existsSync(this.file(agentId, 'index.jsonl'))) return
    const todo = readLines<Chunk>(this.file(agentId, 'index.jsonl')).filter((c) => c.model !== model)
    if (!todo.length) return
    const done = new Map<string, string>()
    const report = (count: number) => {
      for (const fn of this.listeners.indexing) fn({ agentId, done: count, total: todo.length })
    }
    const flush = () =>
      this.serial(agentId, () => {
        const current = readLines<Chunk>(this.file(agentId, 'index.jsonl'))
        writeLines(
          this.file(agentId, 'index.jsonl'),
          current.map((c) => (done.has(c.id) ? { ...c, model, vec: done.get(c.id)! } : c))
        )
        this.loaded.delete(agentId)
      })
    report(0)
    for (const c of todo) {
      if (this.embedder.id !== model || (secure.enabled && !secure.unlocked)) return
      const emb = await this.embedder.embed(c.text)
      if (!emb) return
      done.set(c.id, encodeVec(normalize(emb.vector)))
      if (done.size % 100 === 0) {
        await flush()
        report(done.size)
      }
    }
    await flush()
    report(todo.length)
    this.changed(agentId)
  }

  private backfilling: Promise<void> | null = null

  backfillAll(): Promise<void> {
    this.backfilling ??= (async () => {
      try {
        if (!fs.existsSync(ROOT)) return
        for (const name of fs.readdirSync(ROOT)) await this.backfill(name).catch(() => undefined)
      } finally {
        this.backfilling = null
      }
    })()
    return this.backfilling
  }
}

export const minds = new Minds()
