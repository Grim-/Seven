import { notFound } from '@shared/errors'
import { compactId, stripRef, toId } from '@shared/ids'
import { referencePattern, splitLink, withoutTitle } from '@shared/text'
import { pageKindOf, type EntryPreview, type EntryViewData, type KindInfo, type KindLinkActionInfo, type LibrarySection, type ViewRef } from '@shared/types'
import MiniSearch from 'minisearch'
import { agentAccess } from '../../agents/access'
import '../../avatars/kind'
import { data } from '../../data/hub'
import { setWidgetKinds } from '../../data/widgetSources'
import { timeline } from '../../timeline/store'
import { ToolError } from '../../tools/types'
import { noteFailure } from '../../util/report'
import { fieldText, resolveIncludes } from '../includes'
import { ownedKinds, type OwnedKind } from '../kindRegistry'
import { modules } from '../../modules/registry'
import { moduleOnForAgent } from '../../modules/isOn'
import { matchesWhere, parseQuery, scoreDoc } from '../query'
import { cleanTag, splitTags, tags as tagStore } from '../tags'
import './activity'
import './agents'
import './content'
import { setKindRuntime } from './runtime'
import { accessOf, checkPart, clip, kindFlags, USER, type FindOptions, type FindResult, type Hit, type Kind, type KindChild, type KindChildInput, type KindContext, type KindHit, type TrailStep } from './types'
import './worlds'

function everyKind(): Kind[] {
  return ownedKinds().map((o) => o.kind)
}

function resolvable(ctx: KindContext): OwnedKind[] {
  const hidden = new Set(accessOf(ctx).hidden)
  return ownedKinds().filter(({ kind, module }) => {
    if (module && !modules.isOn(module)) return false
    if (hidden.has(kind.kind)) return false
    try {
      return kind.available(ctx)
    } catch (err) {
      noteFailure(err, 'library', 'Could not check whether a kind is available')
      return false
    }
  })
}

function onForAgent(module: string | null, agentId: string | null): boolean {
  return !module || moduleOnForAgent(module, agentId)
}

export function kinds(ctx: KindContext = USER): Kind[] {
  return resolvable(ctx).map((o) => o.kind)
}

export function kindsOwnedBy(module: string | null): Kind[] {
  return ownedKinds()
    .filter((o) => o.module === module && (!o.module || modules.isOn(o.module)))
    .map((o) => o.kind)
}

export function allKinds(): { kind: string; label: string; description: string; short: string; rollable: boolean; parts: { name: string; description: string }[]; linkActions: KindLinkActionInfo[] }[] {
  const list = kinds(USER).filter((k) => k.inKindList !== false)
  const shortOf = (k: Kind) => {
    const label = k.label.toLowerCase()
    return /^[a-z][\w-]*$/.test(label) && !list.some((o) => o !== k && (o.kind === label || o.label.toLowerCase() === label)) ? label : k.kind
  }
  const actionsOf = (k: Kind): KindLinkActionInfo[] =>
    k.linkActions?.map((a) => ({ name: a.name, label: a.label ?? `:${a.name}`, detail: a.detail, mode: a.mode })) ??
    (k.roll ? [{ name: 'roll', label: 'roll', detail: 'put a random value from it here', mode: 'insert' }] : [])
  return list.map((k) => ({ kind: k.kind, label: k.label, description: k.description, short: shortOf(k), rollable: Boolean(k.roll), parts: k.linkParts ?? [], linkActions: actionsOf(k) }))
}

export function hiddenActions(agentId: string): Set<string> {
  const hidden = new Set(accessOf({ agentId }).hidden)
  const incognito = agentAccess.get(agentId)?.incognito === true
  const out = new Set<string>()
  if (!hidden.size && !incognito) return out
  for (const k of everyKind()) if (!k.actionsStayWhenHidden && (hidden.has(k.kind) || (incognito && k.lasting))) for (const a of k.actions) out.add(a)
  return out
}

export function kindInfo(): KindInfo[] {
  return kinds(USER).map((k) => {
    let count = 0
    try {
      count = k.search('', 10_000, USER).length
    } catch (err) {
      noteFailure(err, 'library', 'Could not count a kind')
      count = 0
    }
    let agents = true
    try {
      agents = k.available({ agentId: '_any' })
    } catch (err) {
      noteFailure(err, 'library', 'Could not check whether agents can use a kind')
      agents = false
    }
    return { kind: k.kind, label: k.label, plural: k.plural, icon: k.icon, description: k.description, count, parts: k.parts, actions: k.actions, source: k.source ?? null, agents, ...kindFlags(k) }
  })
}

function tagged(hits: KindHit[]): KindHit[] {
  return hits.map((h) => {
    const t = tagStore.of(h.kind, h.id)
    return t.length ? { ...h, tags: t } : h
  })
}

function fuzzyHits(k: Kind, all: KindHit[], text: string, limit: number, ctx: KindContext): KindHit[] {
  const { clauses, exclude } = parseQuery(text)
  const searchTerms = clauses.flatMap((c) => c.include).join(' ').trim()
  if (!all.length || !searchTerms) return []
  const docs = all.map((h, i) => {
    const fieldsText = k.fields ? k.fields(h.id, ctx).map((f) => `${f.name}: ${f.text}`).join(' ') : ''
    return { i, title: h.title, summary: k.line(h.id, ctx), tags: (h.tags ?? []).join(' '), fields: fieldsText }
  })
  const index = new MiniSearch<{ i: number; title: string; summary: string; tags: string; fields: string }>({
    idField: 'i',
    fields: ['title', 'summary', 'tags', 'fields'],
    searchOptions: { boost: { title: 3, tags: 2, fields: 2 }, prefix: (term) => term.length > 2, fuzzy: (term) => (term.length > 3 ? 0.2 : false), combineWith: 'OR' }
  })
  index.addAll(docs)
  return index
    .search(searchTerms)
    .filter((r) => {
      if (!exclude.length) return true
      const d = docs[r.id as number]
      const hay = `${d.title} ${d.summary} ${d.tags} ${d.fields}`.toLowerCase()
      return !exclude.some((ex) => hay.includes(ex))
    })
    .slice(0, limit)
    .map((r) => all[r.id as number])
}

function lined(k: Kind, hits: KindHit[], ctx: KindContext): Hit[] {
  return hits.map((h) => ({ ...h, summary: k.line(h.id, ctx) }))
}

function searchKind(k: Kind, query: string, limit: number, ctx: KindContext): KindHit[] {
  const { text, tags } = splitTags(query)
  if (!tags.length) {
    const direct = tagged(k.search(text, limit, ctx))
    const word = cleanTag(text)
    let out = direct
    if (word && tagStore.counts(k.kind).some((c) => c.tag === word)) {
      const seen = new Set(direct.map((h) => h.id))
      const byTag = tagged(k.search('', 10_000, ctx)).filter((h) => !seen.has(h.id) && h.tags?.includes(word))
      out = [...byTag, ...direct].slice(0, limit)
    }
    if (!text.trim() || out.length >= limit) return out
    const seen = new Set(out.map((h) => h.id))
    const near = fuzzyHits(k, tagged(k.search('', 10_000, ctx)), text, limit, ctx).filter((h) => !seen.has(h.id))
    return [...out, ...near].slice(0, limit)
  }
  const hasTags = (h: KindHit) => tags.every((t) => h.tags?.includes(t))
  const direct = tagged(k.search(text, 10_000, ctx)).filter(hasTags)
  if (!text.trim() || direct.length >= limit) return direct.slice(0, limit)
  const seen = new Set(direct.map((h) => h.id))
  const pool = tagged(k.search('', 10_000, ctx)).filter((h) => !seen.has(h.id) && hasTags(h))
  const near = fuzzyHits(k, pool, text, limit - direct.length, ctx)
  return [...direct, ...near].slice(0, limit)
}

export function entriesTagged(tag: string, ctx: KindContext = USER): { kind: Kind; id: string }[] {
  const word = cleanTag(tag)
  if (!word) return []
  const out: { kind: Kind; id: string }[] = []
  for (const k of kinds(ctx)) {
    try {
      for (const h of searchKind(k, `#${word}`, 100_000, ctx)) out.push({ kind: k, id: h.id })
    } catch (err) {
      noteFailure(err, 'library', 'Could not search a kind by tag')
      continue
    }
  }
  return out
}

export function clearKind(kindName: string): { removed: number; failed: number } {
  const k = kindFor(kindName, USER)
  if (!k?.remove) throw new Error(`${kindName} can't be cleared here`)
  let removed = 0
  let failed = 0
  for (const h of k.search('', 1_000_000, USER)) {
    try {
      k.remove(h.id, USER)
      tagStore.set(k.kind, h.id, [])
      timeline.forget(k.kind, h.id)
      removed += 1
    } catch (err) {
      noteFailure(err, 'library', 'Could not delete a tagged entry')
      failed += 1
    }
  }
  return { removed, failed }
}

export function removeEntry(entry: string): void {
  const { kind, id } = resolveEntry(entry, null, USER)
  if (!kind.remove) throw new ToolError(`${kind.plural} can't be deleted here`)
  kind.remove(id, USER)
  timeline.forget(kind.kind, id)
}

export function renameEntry(entry: string, name: string): string {
  const { kind, id } = resolveEntry(entry, null, USER)
  if (!kind.rename) throw new Error(`${kind.plural} can't be renamed`)
  if (!name.trim()) throw new Error('Give a name')
  kind.rename(id, name.trim(), USER)
  return kind.title(id)
}

export function setTags(entry: string, add: string[], remove: string[], ctx: KindContext = USER): { kind: Kind; id: string; tags: string[] } {
  const { kind, id } = resolveEntry(entry, null, ctx)
  return { kind, id, tags: tagStore.change(kind.kind, id, add, remove) }
}

export function overview(query: string, perKind: number, ctx: KindContext = USER, only: string[] | null = null, skip: string[] = []): LibrarySection[] {
  const out: LibrarySection[] = []
  for (const k of kinds(ctx)) {
    if ((only && !only.includes(k.kind)) || skip.includes(k.kind)) continue
    let all: KindHit[]
    try {
      all = searchKind(k, query, 10_000, ctx)
    } catch (err) {
      noteFailure(err, 'library', 'Could not search a kind')
      continue
    }
    if (query && !all.length) continue
    const sorted = all.some((h) => h.at !== undefined) ? [...all].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)) : all
    out.push({ kind: k.kind, label: k.label, plural: k.plural, icon: k.icon, description: k.description, count: all.filter((h) => !k.isGenerated?.(h.id)).length, entries: lined(k, sorted.slice(0, perKind), ctx), group: k.group, ...kindFlags(k) })
  }
  return out
}

export function kindNamed(name: string, ctx: KindContext = USER): Kind | undefined {
  return kinds(ctx).find((k) => k.kind === name)
}

function kindFor(name: string, ctx: KindContext): Kind | undefined {
  const n = name.trim().toLowerCase()
  return kinds(ctx).find((k) => k.kind === n || k.aliases?.includes(n) || k.label.toLowerCase() === n || k.plural.toLowerCase() === n)
}

function resolveKindList(kindName: string | string[] | null | undefined, ctx: KindContext): Kind[] {
  const names = Array.isArray(kindName) ? kindName.map((s) => String(s).trim()).filter(Boolean) : typeof kindName === 'string' && kindName.trim() ? [kindName.trim()] : []
  if (!names.length) return kinds(ctx)
  const seen = new Set<string>()
  const out: Kind[] = []
  for (const name of names) {
    const resolved = kindFor(name, ctx)
    if (!resolved) throw new ToolError(`There is no kind "${name}". Set kind to one of: ${kinds(ctx).map((k) => k.kind).join(', ')}, or leave it empty to search every kind.`)
    if (seen.has(resolved.kind)) continue
    seen.add(resolved.kind)
    out.push(resolved)
  }
  return out
}

export function findPage(opts: FindOptions, ctx: KindContext = USER): FindResult {
  const list = resolveKindList(opts.kind, ctx)
  const tagTerms = Array.isArray(opts.tags) ? opts.tags.map((t) => `#${String(t).replace(/^#/, '').trim()}`).filter((t) => t.length > 1) : []
  const textQuery = opts.query?.trim() ?? ''
  const query = [textQuery, ...tagTerms].filter(Boolean).join(' ')
  const where = opts.where && Object.keys(opts.where).length ? opts.where : null
  const focused = Boolean(opts.kind && (!Array.isArray(opts.kind) || opts.kind.length > 0)) || Boolean(where)
  const rawLimit = typeof opts.limit === 'number' && Number.isFinite(opts.limit) ? Math.floor(opts.limit) : query || focused ? 25 : 8
  const limit = Math.max(1, Math.min(100, rawLimit))
  const offset = typeof opts.offset === 'number' && Number.isFinite(opts.offset) ? Math.max(0, Math.floor(opts.offset)) : 0
  const perKindCap = !query && !focused && offset === 0 ? limit : 10_000
  const matches: { k: Kind; h: KindHit; rank: number }[] = []
  for (const k of list) {
    let rawHits: KindHit[]
    try {
      rawHits = searchKind(k, query, perKindCap, ctx)
    } catch (err) {
      noteFailure(err, 'library', 'Could not search a kind')
      continue
    }
    rawHits.forEach((h, idx) => {
      if (where) {
        const fields = k.fields?.(h.id, ctx).map((f) => ({ name: f.name, value: f.text })) ?? []
        if (!matchesWhere(where, { title: h.title, tags: h.tags, fields })) return
      }
      const crossScore =
        list.length > 1 && textQuery
          ? (scoreDoc(textQuery, { title: h.title, tags: h.tags, labels: [k.label, k.plural, k.kind], body: h.excerpt ?? '' })?.score ?? 0)
          : 0
      matches.push({ k, h, rank: crossScore * 1000 - idx })
    })
  }
  if (list.length > 1 && textQuery) matches.sort((a, b) => b.rank - a.rank)
  const paged = matches.slice(offset, offset + limit).map(({ k, h }) => ({ ...h, summary: k.line(h.id, ctx) }))
  return { hits: paged, total: matches.length, offset, limit }
}

export function find(query: string, kindName: string | string[] | null, limit = 15, ctx: KindContext = USER): Hit[] {
  const list = resolveKindList(kindName, ctx)
  const hits: Hit[] = []
  for (const k of list) {
    try {
      hits.push(...lined(k, searchKind(k, query, limit, ctx), ctx))
    } catch (err) {
      noteFailure(err, 'library', 'Could not search a kind')
      continue
    }
  }
  return hits.slice(0, limit * 2)
}

function byName(k: Kind, ref: string, ctx: KindContext): string | null {
  const raw = stripRef(ref)
  const rawLower = raw.toLowerCase()
  const id = toId(raw)
  if (!id || k.resolveOnly) return null
  try {
    const all = k.search('', 100_000, ctx)
    const exact = all.find((h) => h.id === raw || h.id.toLowerCase() === rawLower || toId(h.title) === id || toId(h.id) === id)
    if (exact) return exact.id
    const compact = compactId(raw)
    if (!compact) return null
    return all.find((h) => compactId(h.id) === compact || compactId(h.title) === compact)?.id ?? null
  } catch (err) {
    noteFailure(err, 'library', 'Could not look up an entry by name')
    return null
  }
}

function resolveIn(k: Kind, ref: string, ctx: KindContext): string | null {
  try {
    return k.resolve(ref, ctx) ?? byName(k, ref, ctx)
  } catch (err) {
    noteFailure(err, 'library', 'Could not resolve an entry')
    return byName(k, ref, ctx)
  }
}

function childrenOf(kind: Kind, id: string, ctx: KindContext, trail: TrailStep[]): KindChild[] {
  let list: KindChildInput[] = []
  try {
    list = kind.children?.(id, ctx, trail) ?? []
  } catch (err) {
    noteFailure(err, 'library', 'Could not list what an entry holds')
    list = []
  }
  const used = new Set<string>()
  return list.map((c) => {
    const base = toId(c.title) || toId(c.id)
    let segment = base
    for (let n = 2; used.has(segment); n++) segment = `${base}-${n}`
    used.add(segment)
    return { ...c, segment }
  })
}

function pathVia(steps: [Kind, string][], ctx: KindContext): string | null {
  const [[rootKind, rootId], ...rest] = steps
  let path = `@${rootKind.kind}:${rootId}`
  let cur: [Kind, string] = [rootKind, rootId]
  const trail: TrailStep[] = []
  for (const step of rest) {
    const hit = childrenOf(cur[0], cur[1], ctx, trail).find((c) => c.id === step[1])
    if (!hit) return null
    path += `/${hit.segment}`
    trail.push({ kind: cur[0].kind, id: cur[1] })
    cur = step
  }
  return path
}

function walkPath(k: Kind, ref: string, ctx: KindContext): { kind: Kind; id: string; trail: TrailStep[] } | null {
  const segs = stripRef(ref).split('/').map((s) => s.trim()).filter(Boolean)
  for (let n = segs.length - 1; n >= 1; n--) {
    const rootId = resolveIn(k, segs.slice(0, n).join('/'), ctx)
    if (!rootId) continue
    let cur = { kind: k, id: rootId }
    const trail: TrailStep[] = []
    let reached = true
    for (const seg of segs.slice(n)) {
      const want = toId(seg)
      const hit = childrenOf(cur.kind, cur.id, ctx, trail).find((c) => c.segment === want || toId(c.title) === want || toId(c.id) === want)
      const next = hit ? kindFor(hit.kind, ctx) : undefined
      if (!hit || !next) {
        reached = false
        break
      }
      trail.push({ kind: cur.kind.kind, id: cur.id })
      cur = { kind: next, id: hit.id }
    }
    if (reached) return { ...cur, trail }
  }
  return null
}

export function entryId(kind: Kind, id: string, title: string, ctx: KindContext): string {
  if (kind.root !== undefined && id === kind.root) return kind.root
  const tree = data.pages.tree()
  if (tree.list.some((p) => p.id === id && pageKindOf(p.type) === kind.kind)) return tree.pathOf(id)
  const named = toId(title)
  try {
    return named && resolveEntry(named, kind.kind, ctx).id === id ? named : id
  } catch (err) {
    noteFailure(err, 'library', 'Could not resolve an entry name')
    return id
  }
}

export function entryInside(entry: string, ctx: KindContext = USER): KindChild[] {
  const { kind, id, trail } = resolveEntry(entry, null, ctx)
  return childrenOf(kind, id, ctx, trail ?? [])
}

export function insideText(kind: Kind, id: string, base: string, trail: TrailStep[], ctx: KindContext): string {
  const list = childrenOf(kind, id, ctx, trail)
  if (!list.length) return ''
  const label = (k: string) => kindFor(k, ctx)?.label.toLowerCase() ?? k
  return `\n\nInside it (read any of these by its path):\n${list.map((c) => `- ${base}/${c.segment} — ${label(c.kind)} ${c.title}`).join('\n')}`
}

export function resolveEntry(entry: string, kindName: string | null = null, ctx: KindContext = USER): { kind: Kind; id: string; trail?: TrailStep[]; path?: string } {
  const link = splitLink(entry)
  if (link.kind && entry.trim().startsWith('@')) {
    const k = kindFor(link.kind, ctx)
    const id = k ? resolveIn(k, link.ref, ctx) : null
    if (k && id) return { kind: k, id }
    const walked = k && link.ref.includes('/') ? walkPath(k, link.ref, ctx) : null
    if (k && walked) return { ...walked, path: `@${k.kind}:${stripRef(link.ref)}` }
  }
  const raw = entry.trim().replace(/^seven:/, '')
  const slash = raw.indexOf('/')
  if (!kindName && slash > 0) {
    const k = kindFor(raw.slice(0, slash), ctx)
    if (k) {
      const ref = decodeURIComponent(raw.slice(slash + 1))
      const id = resolveIn(k, ref, ctx)
      if (id) return { kind: k, id }
      const walked = ref.includes('/') ? walkPath(k, ref, ctx) : null
      if (walked) return { ...walked, path: `@${k.kind}:${stripRef(ref)}` }
    }
  }
  const named = kindName ? kindFor(kindName, ctx) : undefined
  if (kindName && !named) throw notFound(new ToolError(`There is no kind ${kindName}. Kinds: ${kinds(ctx).map((k) => k.kind).join(', ')}.`))
  const list = named ? [named] : kinds(ctx)
  for (const k of list) {
    try {
      const id = k.resolve(raw, ctx)
      if (id) return { kind: k, id }
    } catch (err) {
      noteFailure(err, 'library', 'Could not resolve an entry')
      continue
    }
  }
  for (const k of list) {
    const id = byName(k, raw, ctx)
    if (id) return { kind: k, id }
  }
  if (raw.includes('/'))
    for (const k of list) {
      const walked = walkPath(k, raw, ctx)
      if (walked) return { ...walked, path: `@${k.kind}:${stripRef(raw)}` }
    }
  const asked = toId(link.kind && entry.trim().startsWith('@') ? link.ref : raw) || stripRef(raw)
  const what = named?.kind ?? (link.kind && kindFor(link.kind, ctx) ? link.kind : 'entry')
  if (named?.missing) throw notFound(new ToolError(named.missing(asked)))
  let near: Hit[] = []
  try {
    near = find(asked.split(/[_/]+/).filter(Boolean).pop() ?? asked, named?.kind ?? null, 3, ctx).slice(0, 5)
  } catch (err) {
    noteFailure(err, 'library', 'Could not find close matches')
    near = []
  }
  const tree = data.pages.tree()
  const nearId = (h: Hit) => (tree.list.some((p) => p.id === h.id && pageKindOf(p.type) === h.kind) ? tree.pathOf(h.id) : toId(h.title) || h.id)
  throw notFound(new ToolError(`No ${what} ${asked}.${near.length ? ` Close: ${near.map((h) => `${h.kind} ${nearId(h)}`).join(', ')}.` : ''} find searches everything.`))
}

export function referenceText(kindName: string, ref: string, part: string | null = null): { label: string; title: string; text: string } | null {
  const k = kindFor(kindName, USER)
  if (!k) return null
  const id = k.resolve(ref, USER)
  const field = id && part ? fieldText(k, id, part) : null
  if (id && field !== null) return { label: k.label, title: `${k.title(id)} · ${part}`, text: clip(resolveIncludes(field)) }
  const checked = checkPart(k, part)
  try {
    if (!id) return null
    return { label: k.label, title: k.title(id), text: clip(resolveIncludes(k.full(id, { part: checked }, USER))) }
  } catch (err) {
    noteFailure(err, 'library', 'Could not preview an entry')
    return null
  }
}

export function rollEntry(entry: string, ctx: KindContext = USER): string {
  const { kind, id } = resolveEntry(entry.trim().replace(/^@/, '').replace(/:/, '/').replace(/^"|"$/g, ''), null, ctx)
  if (!kind.roll) throw new ToolError(`${kind.plural} can't be rolled. Roll an entry that can be, such as a repo; find with kind repo lists them.`)
  return kind.roll(id)
}

export function drawEntry(entry: string, count: number, ctx: KindContext = USER): string[] {
  const { kind, id } = resolveEntry(entry, null, ctx)
  if (kind.draw) return kind.draw(id, count)
  const roll = kind.roll
  if (!roll) throw new ToolError(`${kind.plural} can't be drawn from. Draw from an entry that can be rolled, such as a repo.`)
  return Array.from({ length: count }, () => roll(id))
}

export function drawableEntries(ctx: KindContext = USER): Hit[] {
  return kinds(ctx)
    .filter((k) => k.roll)
    .flatMap((k) => lined(k, k.search('', 2000, ctx), ctx))
}

export function previewEntry(entry: string, ctx: KindContext = USER): EntryPreview {
  const { kind, id } = resolveEntry(entry, null, ctx)
  const page = data.pages.metaFor(id)
  const asset = kind.asset?.(id) ?? null
  const title = kind.title(id)
  const card = withoutTitle(kind.card(id, ctx), title)
  const ownImage = kind.image?.(id) ?? page?.image ?? (asset && (asset.kind === 'image' || asset.kind === 'video') ? asset.id : null)
  let fallbackImage: string | null = null
  if (!ownImage) {
    const m = /@file:("[^"]+"|[^\s,;!?)#]+)/i.exec(card)
    if (m) fallbackImage = data.assets.findByName(m[1].replace(/^"|"$/g, ''))?.id ?? null
  }
  let line = ''
  try {
    line = kind.line(id, ctx)
  } catch (err) {
    noteFailure(err, 'library', 'Could not read entry summary line')
  }
  let fields: { name: string; text: string }[] = []
  try {
    fields = (kind.fields?.(id, ctx) ?? []).filter((f) => f.text.trim().length > 0)
  } catch (err) {
    noteFailure(err, 'library', 'Could not read entry fields')
  }
  return {
    kind: kind.kind,
    label: kind.label,
    icon: kind.icon,
    id,
    title,
    line,
    card,
    image: ownImage ?? fallbackImage,
    fields
  }
}

export function rollText(text: string, ctx: KindContext = USER, depth = 0): { text: string; rolled: { token: string; value: string; error?: string }[] } {
  const rolled: { token: string; value: string; error?: string }[] = []
  let replaced = false
  const out = text.replace(referencePattern(), (full, lead: string, rawKind: string, rawRef: string, rawAction?: string, rawPart?: string) => {
    const cleanRef = rawRef.replace(/^"|"$/g, '')
    const token = full.slice(lead.length)
    if (rawAction) {
      try {
        const { kind, id } = resolveEntry(`${rawKind}/${cleanRef}`, null, ctx)
        const action = kind.linkActions?.find((a) => a.name.toLowerCase() === rawAction.toLowerCase())
        if (!action) return full
        const value = action.run(id, ctx)
        rolled.push({ token, value })
        replaced = true
        return `${lead}${value}`
      } catch (err) {
        rolled.push({ token, value: token, error: err instanceof Error ? err.message : String(err) })
        return full
      }
    }
    if (rawPart?.toLowerCase() === 'random') {
      try {
        const value = rollEntry(`${rawKind}/${cleanRef}`, ctx)
        rolled.push({ token, value })
        replaced = true
        return `${lead}${value}`
      } catch (err) {
        rolled.push({ token, value: token, error: err instanceof Error ? err.message : String(err) })
        return full
      }
    }
    return full
  })
  if (replaced && depth < 4) {
    const next = rollText(out, ctx, depth + 1)
    return { text: next.text, rolled: [...rolled, ...next.rolled] }
  }
  return { text: out, rolled }
}

export function libraryGuide(toolNames: string[], agentId: string | null = null, guideLink: (module: string) => string | null = () => null): string {
  if (!toolNames.includes('read_kind')) return ''
  const mine = new Set(toolNames)
  const lines = [
    '## Library and links',
    `Everything Seven keeps is in the library, as entries of the kinds below. Each entry has an id; read_kind(kind, id) gives it.${mine.has('find') ? ' find searches the library.' : ''}${mine.has('show') ? ' show presents an entry.' : ''}`,
    'Link to an entry with @kind:id, e.g. @page:recipes/pancakes. find and read_kind give each entry\'s link: copy it. Links work the same in replies, pages, sheets and tool arguments; never write a markdown link or a [[wiki link]] for an entry.',
    'Pages sit in folders, and a page\'s id is its path, e.g. recipes/pancakes. read_kind(folder, recipes) lists what recipes holds; read_kind(folder, /) lists the top level.',
    'Everything that holds other things is a path the same way. Reading one lists what is inside it, each with its path: @world:my_world lists its maps, @world:my_world/the_map the places, objects and characters on that map, @world:my_world/the_map/the_village what is inside that place. Copy the paths you are given; each one goes a level deeper.'
  ]
  if (mine.has('draw')) lines.push('Draw in replies and pages with a ```svg block (one <svg> element, no scripts or outside links); draw saves one as a file. A ```mermaid block draws a flowchart, sequence diagram or timeline. ![name](seven:file/<id>) puts a library picture in a page.')
  const groups = new Map<string, OwnedKind[]>()
  for (const o of resolvable({ agentId, user: false })) if (onForAgent(o.module, agentId)) groups.set(o.kind.group, [...(groups.get(o.kind.group) ?? []), o])
  for (const [group, list] of groups) {
    const links = [...new Set(list.flatMap((o) => (o.module ? [o.module] : [])))].flatMap((m) => {
      const link = guideLink(m)
      return link ? [link] : []
    })
    lines.push(`### ${group}${links.length ? ` (${links.join(', ')})` : ''}`)
    for (const { kind } of list) lines.push(`- @${kind.kind}: ${kind.description}`)
  }
  return lines.join('\n')
}

function pickPart(kind: Kind, id: string, asked: string | null): string {
  const want = (asked ?? '').trim().toLowerCase()
  return want && kind.parts.includes(want) ? want : kind.defaultPart ? kind.defaultPart(id) : kind.parts[0]
}

export function linkPart(thing: string): string | null {
  return thing.trim().startsWith('@') ? splitLink(thing).part : null
}

export function partMiss(entry: string, part: string | null, ctx: KindContext = USER): string | null {
  const want = (part ?? '').trim().toLowerCase()
  if (!want) return null
  const { kind, id } = resolveEntry(entry, null, ctx)
  if (kind.parts.includes(want)) return null
  return `${kind.title(id)} has no part "${want}", so it is shown the usual way${kind.parts.length > 1 ? ` (its parts: ${kind.parts.join(', ')})` : ''}.`
}

export function partView(entry: string, part: string | null, title: string | null = null, ctx: KindContext = USER): ViewRef {
  const { kind, id } = resolveEntry(entry, null, ctx)
  if (!kind.parts.length) throw new ToolError(`A ${kind.label.toLowerCase()} has no view to show. read it instead and put what matters in your reply.`)
  const chosen = pickPart(kind, id, part)
  const text = kind.textParts?.includes(chosen) ? kind.full(id, {}, ctx) : null
  return { kind: 'part', title: title ?? kind.title(id), data: { kind: kind.kind, id, part: chosen, text } }
}

export function entryView(kind: Kind, id: string, part: string | null, ctx: KindContext = USER): ViewRef {
  const viewData: EntryViewData = { kind: kind.kind, id, part: pickPart(kind, id, part) }
  return { kind: 'entry', title: entryId(kind, id, kind.title(id), ctx), data: viewData }
}

export function linkView(entry: string, ctx: KindContext = USER): ViewRef {
  const { kind, id } = resolveEntry(entry, null, ctx)
  return entryView(kind, id, null, ctx)
}

export function kindOf(entry: string, ctx: KindContext = USER): { kind: Kind; id: string } {
  return resolveEntry(entry, null, ctx)
}

export function kindOfPageType(type: string | null | undefined): string {
  return everyKind().find((k) => k.pageTypes?.includes(type ?? ''))?.kind ?? pageKindOf(type)
}

export function isPageBacked(kind: string): boolean {
  return everyKind().some((k) => k.kind === kind && Boolean(k.pageTypes))
}

setKindRuntime({
  kinds,
  kindFor,
  kindOf,
  resolveEntry,
  entryView,
  entryId,
  pathVia,
  searchKind
})

setWidgetKinds(everyKind)
