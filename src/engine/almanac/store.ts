import path from 'node:path'
import {
  cleanAlmanac,
  cleanAlmanacEntry,
  sortAlmanacEntries,
  worldTimeFromSeconds,
  type Almanac,
  type AlmanacEntry,
  type ArchivedChatMessage
} from '@shared/almanac'
import { cleanElements } from '@shared/chatElements'
import { stripRef, toId } from '@shared/ids'
import { isVaultLocked } from '@shared/sealed'
import { agentAccess } from '../agents/access'
import { sessionAccess } from '../sessions/access'
import { readJson, writeJson } from '../util/fs'
import { dataRoot } from '../util/paths'
import { secure, vaultEvents } from '../util/secure'

export interface ArchiveChatOptions {
  almanacId: string
  sessionId: string
  title?: string
  summary?: string
  outcome?: string
  secret?: string
  notes?: string
  where?: string
  who?: string[]
  threadIds?: string[]
  worldTime?: number | null
  deleteChat?: boolean
}

export class AlmanacStore {
  private items: Almanac[] | null = null
  private notify: (() => void) | null = null

  constructor() {
    const reset = () => {
      this.items = null
      this.notify?.()
    }
    vaultEvents.on('unlocked', reset)
    vaultEvents.on('locked', reset)
  }

  private get file(): string {
    return path.join(dataRoot, 'almanacs.json')
  }

  private ensure(): Almanac[] {
    if (this.items !== null) return this.items
    if (secure.keys && !secure.keys.privateKey) return []
    let raw: unknown[]
    try {
      raw = readJson<unknown[]>(this.file, [])
    } catch (err) {
      if (isVaultLocked(err)) return []
      throw err
    }
    this.items = Array.isArray(raw)
      ? raw.map((item) => cleanAlmanac(item)).filter((x): x is Almanac => x !== null)
      : []
    return this.items
  }

  onChange(fn: () => void): void {
    this.notify = fn
  }

  private persist(list: Almanac[]): void {
    this.items = list
    writeJson(this.file, list)
    this.notify?.()
  }

  list(): Almanac[] {
    return [...this.ensure()].sort((a, b) => b.updatedAt - a.updatedAt)
  }

  get(id: string): Almanac | undefined {
    const cleanId = stripRef(id).replace(/^almanac:/i, '')
    return this.ensure().find((x) => x.id === cleanId)
  }

  find(ref: string): Almanac | undefined {
    const q = stripRef(ref).replace(/^almanac:/i, '').trim()
    if (!q) return undefined
    const items = this.ensure()
    const lower = q.toLowerCase()
    const slug = toId(q)
    return (
      items.find((x) => x.id === q || x.id === slug) ??
      items.find((x) => x.title.toLowerCase() === lower) ??
      items.find((x) => x.title.toLowerCase().includes(lower))
    )
  }

  save(input: Partial<Almanac> & { title?: string; name?: string }, previousId?: string): Almanac {
    const items = [...this.ensure()]
    const current = previousId ? this.get(previousId) : input.id ? this.get(input.id) : undefined
    const merged = {
      ...(current ?? {}),
      ...input,
      title: (input.title ?? input.name ?? current?.title ?? 'Untitled Almanac').trim() || 'Untitled Almanac',
      updatedAt: Date.now()
    }
    const next = cleanAlmanac(merged, current?.id)
    if (!next) throw new Error('Almanac needs a title')
    const conflict = items.find((x) => x.id === next.id && x.id !== (previousId ?? next.id))
    if (conflict) throw new Error(`An almanac with id "${next.id}" already exists.`)
    const idx = items.findIndex((x) => x.id === (previousId ?? next.id))
    if (idx >= 0) items[idx] = next
    else items.push(next)
    this.persist(items)
    return next
  }

  remove(id: string): boolean {
    const cleanId = stripRef(id).replace(/^almanac:/i, '')
    const items = this.ensure()
    const next = items.filter((x) => x.id !== cleanId)
    if (next.length === items.length) return false
    this.persist(next)
    return true
  }

  advanceClock(id: string, deltaSeconds = 0, absoluteTime?: number): Almanac {
    const alm = this.find(id)
    if (!alm) throw new Error(`Almanac not found: ${id}`)
    const nextTime =
      typeof absoluteTime === 'number' && Number.isFinite(absoluteTime)
        ? Math.max(0, Math.floor(absoluteTime))
        : Math.max(0, alm.currentTime + Math.floor(deltaSeconds))
    return this.save({ ...alm, currentTime: nextTime }, alm.id)
  }

  recordEntry(almanacRef: string, rawEntry: Partial<AlmanacEntry>): { almanac: Almanac; entry: AlmanacEntry } {
    const alm = this.find(almanacRef)
    if (!alm) throw new Error(`Almanac not found: ${almanacRef}`)

    const requestedTime =
      typeof rawEntry.when?.time === 'number' && Number.isFinite(rawEntry.when.time)
        ? rawEntry.when.time
        : alm.currentTime
    const provisionalWhen = worldTimeFromSeconds(requestedTime, 1)
    const targetDay = typeof rawEntry.when?.day === 'number' ? rawEntry.when.day : provisionalWhen.day
    const maxSeqOnDay = alm.entries
      .filter((e) => e.when.day === targetDay)
      .reduce((max, e) => Math.max(max, e.when.seq), 0)
    const nextSeq =
      typeof rawEntry.when?.seq === 'number' && rawEntry.when.seq > 0 ? rawEntry.when.seq : maxSeqOnDay + 1

    const existingIdx = rawEntry.id ? alm.entries.findIndex((e) => e.id === rawEntry.id) : -1
    const baseEntry = existingIdx >= 0 ? alm.entries[existingIdx] : undefined

    const cleaned = cleanAlmanacEntry(
      {
        ...(baseEntry ?? {}),
        ...rawEntry,
        when: {
          ...(baseEntry?.when ?? {}),
          ...(rawEntry.when ?? {}),
          seq: existingIdx >= 0 && !rawEntry.when?.seq ? baseEntry!.when.seq : nextSeq
        }
      },
      alm.entries.length,
      requestedTime
    )
    if (!cleaned) throw new Error('Almanac entry requires a title, summary, notes, or archived messages.')

    const entries = [...alm.entries]
    if (existingIdx >= 0) entries[existingIdx] = cleaned
    else entries.push(cleaned)

    const nextCast = [...new Set([...alm.cast, ...cleaned.who])]
    const nextTime = Math.max(alm.currentTime, cleaned.when.time)
    const saved = this.save(
      {
        ...alm,
        currentTime: nextTime,
        cast: nextCast,
        entries: sortAlmanacEntries(entries, 'newest')
      },
      alm.id
    )
    return { almanac: saved, entry: cleaned }
  }

  archiveChat(opts: ArchiveChatOptions): { almanac: Almanac; entry: AlmanacEntry } {
    const alm = this.find(opts.almanacId)
    if (!alm) throw new Error(`Almanac not found: ${opts.almanacId}`)

    const session = sessionAccess.get(opts.sessionId)
    if (!session) throw new Error(`Chat session not found: ${opts.sessionId}`)

    const rawMessages = sessionAccess.messages(opts.sessionId)
    const agentName = agentAccess.get(session.agentId)?.name ?? session.agentId

    const archivedMessages: ArchivedChatMessage[] = []
    for (const msg of rawMessages) {
      if (msg.role !== 'user' && msg.role !== 'assistant') continue
      const text = msg.parts
        .map((p) => (p.type === 'text' ? p.text : ''))
        .join('')
        .trim()
      const elements = cleanElements(msg.elements)
      if (!text && !elements.length) continue
      const speaker = msg.role === 'user' ? 'Player' : agentName || 'Narrator'
      archivedMessages.push({
        id: msg.id,
        speaker,
        role: msg.role,
        text,
        ...(elements.length ? { elements } : {})
      })
    }

    const scene = session.scene
    const where = (opts.where ?? scene?.where ?? '').trim()
    const who = [...new Set([...(opts.who ?? []), ...(scene?.characters ?? [])].map((x) => x.trim()).filter(Boolean))]
    const timeSeconds =
      typeof opts.worldTime === 'number' && Number.isFinite(opts.worldTime)
        ? opts.worldTime
        : typeof scene?.worldTime === 'number' && Number.isFinite(scene.worldTime)
          ? scene.worldTime
          : alm.currentTime

    const autoSummary =
      opts.summary?.trim() ||
      (archivedMessages.length
        ? `${archivedMessages.length} turns archived from "${session.title}". ${archivedMessages[archivedMessages.length - 1].text.slice(0, 160)}`
        : `Archived chat "${session.title}".`)

    const existingForChat =
      (scene?.archivedEntryId ? alm.entries.find((e) => e.id === scene.archivedEntryId) : undefined) ??
      alm.entries.find((e) => e.chatId === session.id)

    const result = this.recordEntry(alm.id, {
      ...(existingForChat
        ? { id: existingForChat.id, when: existingForChat.when }
        : { when: { ...worldTimeFromSeconds(timeSeconds, 1), seq: 0 } }),
      kind: 'chat',
      where,
      who,
      threadIds: opts.threadIds ?? existingForChat?.threadIds ?? [],
      title: (opts.title ?? existingForChat?.title ?? session.title).trim() || 'Archived Scene Chat',
      summary: autoSummary,
      outcome: (opts.outcome ?? existingForChat?.outcome ?? '').trim(),
      ...(opts.secret ?? existingForChat?.secret ? { secret: (opts.secret ?? existingForChat?.secret ?? '').trim() } : {}),
      notes: (opts.notes ?? existingForChat?.notes ?? '').trim(),
      chatId: session.id,
      chatTitle: session.title,
      messages: archivedMessages,
      links: [...new Set([where, ...who, ...(existingForChat?.links ?? [])].filter(Boolean))]
    })

    if (opts.deleteChat) {
      sessionAccess.remove(session.id)
    } else {
      sessionAccess.updateScene(session.id, {
        almanacId: result.almanac.id,
        worldId: scene?.worldId ?? result.almanac.worldId,
        saveId: scene?.saveId ?? result.almanac.saveId,
        where,
        characters: who,
        worldTime: result.entry.when.time,
        archivedEntryId: result.entry.id
      })
    }

    return result
  }
}

export const almanacs = new AlmanacStore()
