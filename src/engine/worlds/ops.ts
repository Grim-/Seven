import { noteFailure } from '../util/report'
import { notFound } from '@shared/errors'
import { normalEntity, normalValue, worldId, type WorldBinding, type WorldEntity, type WorldEntry, type WorldField, type WorldLock, type WorldMapValue, type WorldType } from '@shared/world'
import { WorldError, nowStamp, worlds, type WorldLayer } from './store'
import { Decision } from "@shared/decisions"
import { Action } from "@shared/actions"

type Mode = 'create' | 'update' | 'append' | 'edit'

const SELF = new Set(['me', 'self', 'myself', 'i'])

function writable(lock: WorldLock | undefined, mode: Mode): boolean {
  switch (lock ?? 'open') {
    case 'locked':
      return false
    case 'create_only':
      return mode === 'create'
    case 'append_only':
      return mode === 'create' || mode === 'append'
    default:
      return true
  }
}

function lockMessage(name: string, lock: WorldLock | undefined, t: WorldType): string {
  if (lock === 'locked') return `${name} is fixed by the world and can't be set or changed; leave it out.`
  if (lock === 'create_only') return `${name} can only be set when the ${t.noun} is first created, so leave it as it is.`
  if (lock === 'append_only') return `${name} can only be added to; existing entries are permanent. Add a new entry instead.`
  return `${name} can't be changed that way.`
}

function visibleFields(t: WorldType): [string, WorldField][] {
  return Object.entries(t.fields).filter(([, f]) => f.visible !== false)
}

function fieldOf(t: WorldType, name: string): [string, WorldField] {
  const hit = visibleFields(t).find(([n]) => n.toLowerCase() === name.trim().toLowerCase())
  if (!hit) throw new WorldError(`A ${t.noun} has no field "${name}". Use one of these field names: ${visibleFields(t).map(([n]) => n).join(', ')}${t.backrefs ? `, ${Object.keys(t.backrefs).join(', ')}` : ''}.`)
  return hit
}

function labelOf(worldIdv: string, typeKey: string, key: string): string {
  try {
    const t = worlds.type(worldIdv, typeKey)
    const e = worlds.get(worldIdv, typeKey, key)
    const label = e?.[t.label]
    return typeof label === 'string' && label ? label : key
  } catch (err) {
    noteFailure(err, 'worlds', "Could not read a world record's label")
    return key
  }
}

function refText(worldIdv: string, to: string | undefined, id: string): string {
  if (!to) return id
  const exists = worlds.get(worldIdv, to, id) !== null
  if (!exists) return `${id} (not recorded)`
  const label = labelOf(worldIdv, to, id)
  return label !== id ? `${id} (${label})` : id
}

function entryLine(e: WorldEntry, i: number, worldIdv: string, f: WorldField): string {
  const ts = e.timestamp ? ` (${e.timestamp})` : ''
  const w = f.weighted ? ` [w${e.weight ?? 5}]` : ''
  const link = e.ref ? ` → ${refText(worldIdv, f.entryRef?.to, e.ref)}` : ''
  return `  [${i}]${ts}${w} ${e.text}${link}${e.locked ? ' [fixed]' : ''}`
}

function backrefIds(worldIdv: string, t: WorldType, key: string, name: string): string[] {
  const spec = t.backrefs?.[name]
  if (!spec) return []
  const bucket = worlds.entities(worldIdv, spec.from)
  return Object.entries(bucket)
    .filter(([, e]) => {
      const v = e[spec.via]
      return Array.isArray(v) ? (v as unknown[]).includes(key) : v === key
    })
    .map(([k]) => k)
}

function renderValue(worldIdv: string, name: string, f: WorldField, v: unknown, sort: string | null = null, query: string | null = null): string {
  if (f.kind === 'list' || f.kind === 'log') {
    let entries = (v as WorldEntry[]).map((e, i) => ({ e, i }))
    if (query) entries = entries.filter(({ e }) => e.text.toLowerCase().includes(query.toLowerCase()))
    if (f.kind === 'log' && sort !== 'oldest') entries.reverse()
    if (sort === 'weight') entries.sort((a, b) => (b.e.weight ?? 5) - (a.e.weight ?? 5))
    return `${name} (${entries.length}${f.kind === 'log' && sort !== 'oldest' ? ', newest first' : ''}):${entries.length ? `\n${entries.map(({ e, i }) => entryLine(e, i, worldIdv, f)).join('\n')}` : ' none'}`
  }
  if (f.kind === 'map') {
    let rows = Object.values(v as WorldMapValue)
    if (query) rows = rows.filter((r) => String(r.target).includes(query.toLowerCase()))
    const subs = Object.keys(f.value ?? {})
    const line = (r: Record<string, string | number | null>) => `  ${refText(worldIdv, f.keyNoun && worlds.schema(worldIdv).types[f.keyNoun] ? f.keyNoun : undefined, String(r.target))}: ${subs.map((k) => `${k} ${r[k] ?? ''}`).join(', ')}`
    return `${name} (${rows.length}):${rows.length ? `\n${rows.map(line).join('\n')}` : ' none'}`
  }
  if (f.kind === 'ref') return `${name}: ${v ? refText(worldIdv, f.to, String(v)) : 'none'}`
  if (f.kind === 'refs') return `${name}: ${(v as string[]).length ? (v as string[]).map((x) => refText(worldIdv, f.to, x)).join(', ') : 'none'}`
  return `${name}: ${v === '' ? '(empty)' : String(v)}`
}

export function requireBinding(binding: WorldBinding | null | undefined): WorldBinding {
  if (!binding) throw new WorldError("You aren't linked to a record in a world, so the world tools can't work yet. Tell the user they can link you to one in your agent settings.")
  if (!worlds.exists(binding.worldId)) throw new WorldError(`Your world "${binding.worldId}" no longer exists. Tell the user they can link you to another world in your agent settings.`)
  return binding
}

export function recall(b: WorldBinding, args: { type: string | null; id: string | null; field: string | null; query: string | null; sort: string | null }): string {
  const typeKey = args.type?.trim() || b.type
  const t = worlds.type(b.worldId, typeKey)
  const rawId = args.id?.trim()
  const key = !rawId || SELF.has(rawId.toLowerCase()) ? (typeKey === b.type ? b.id : '') : worldId(rawId)
  if (!key) throw new WorldError(`Set id to the id of the ${t.noun} to read (world_search finds ids), or set type and id to null to read your own record.`)
  const e = worlds.get(b.worldId, typeKey, key, false)
  const mine = typeKey === b.type && key === b.id
  if (!e) throw notFound(new WorldError(mine ? 'You have no record yet. world_remember creates it.' : `No ${t.noun} with id "${key}". Use world_search to find the right id.`))
  if (args.field) {
    const name = args.field.trim()
    const back = t.backrefs && Object.keys(t.backrefs).find((n) => n.toLowerCase() === name.toLowerCase())
    if (back) {
      const ids = backrefIds(b.worldId, t, key, back)
      return `${back}: ${ids.length ? ids.map((x) => refText(b.worldId, t.backrefs?.[back].from, x)).join(', ') : (t.backrefs?.[back].empty ?? 'none')}`
    }
    const [fname, f] = fieldOf(t, name)
    return renderValue(b.worldId, fname, f, e[fname], args.sort, args.query)
  }
  const lines = [`${mine ? 'Your record' : `${t.noun} "${key}"`}:`]
  for (const [fname, f] of visibleFields(t)) lines.push(renderValue(b.worldId, fname, f, e[fname], args.sort, null))
  for (const name of Object.keys(t.backrefs ?? {})) {
    const ids = backrefIds(b.worldId, t, key, name)
    lines.push(`${name}: ${ids.length ? ids.map((x) => refText(b.worldId, t.backrefs?.[name].from, x)).join(', ') : (t.backrefs?.[name].empty ?? 'none')}`)
  }
  return lines.join('\n')
}

function refWarning(worldIdv: string, to: string | undefined, ids: string[]): string {
  if (!to) return ''
  const missing = ids.filter((id) => worlds.get(worldIdv, to, id) === null)
  return missing.length ? ` (Note: no ${worlds.type(worldIdv, to).noun} recorded as ${missing.join(', ')} yet.)` : ''
}

export interface WriteArgs {
  entries: string[] | null
  weight: number | null
  link: string | null
  target: string | null
  values: Record<string, unknown> | null
  shift: Record<string, unknown> | null
  value?: unknown | null
  decisions?: Decision[] | null
  actions?: Action[] | null
}

export function writeField(worldIdv: string, typeKey: string, key: string, fieldName: string, args: WriteArgs, creatingLabel: string | null, layer: WorldLayer = 'template'): string {
  const t = worlds.type(worldIdv, typeKey)
  const [name, f] = fieldOf(t, fieldName)
  const existing = worlds.get(worldIdv, typeKey, key, true, layer)
  const creating = existing === null
  const entity: WorldEntity = existing ?? normalEntity(t, { [t.label]: creatingLabel ?? key })
  const mode: Mode = creating ? 'create' : f.kind === 'list' || f.kind === 'log' ? 'append' : 'update'
  if (!writable(f.lock, mode)) throw new WorldError(lockMessage(name, f.lock, t))
  let reply: string
  if (f.kind === 'list' || f.kind === 'log') {
    const texts = (args.entries ?? []).map((x) => String(x).trim()).filter(Boolean)
    if (!texts.length) throw new WorldError(`${name} is a list, so give the new entries as text in entries, e.g. ["first", "second"]. With world_set, use world_entries with add instead.`)
    const at = nowStamp()
    const link = args.link?.trim() ? worldId(args.link) : null
    const added: WorldEntry[] = texts.map((text) => ({
      text,
      ref: f.entryRef ? link : null,
      locked: false,
      ...(f.kind === 'log' ? { timestamp: at } : {}),
      ...(f.weighted ? { weight: Math.min(10, Math.max(1, Math.round(args.weight ?? 5))) } : {})
    }))
    const list = [...(entity[name] as WorldEntry[]), ...added]
    entity[name] = list
    reply = `Added ${added.length} to ${name}; it now holds ${list.length}.${link && f.entryRef ? refWarning(worldIdv, f.entryRef.to, [link]) : ''}`
  } else if (f.kind === 'map') {
    const target = args.target?.trim() ? worldId(args.target) : ''
    if (!target) throw new WorldError(`${name} is kept per ${f.keyNoun ?? 'target'}: set target to the id of the ${f.keyNoun ?? 'record'} it is about, with values or shift.`)
    const subs = f.value ?? {}
    const map = { ...(entity[name] as WorldMapValue) }
    const row: Record<string, string | number | null> = { ...(map[target] ?? Object.fromEntries(Object.entries(subs).map(([k, s]) => [k, s.kind === 'number' ? Number(s.default ?? 0) : String(s.default ?? '')]))) }
    const bad = [...Object.keys(args.values ?? {}), ...Object.keys(args.shift ?? {})].filter((k) => !(k in subs))
    if (bad.length) throw new WorldError(`${name} has no ${bad.join(', ')}. In values and shift use only: ${Object.keys(subs).join(', ')}.`)
    for (const [k, v] of Object.entries(args.values ?? {})) row[k] = subs[k].kind === 'number' ? Number(v) : String(v)
    for (const [k, v] of Object.entries(args.shift ?? {})) {
      if (subs[k].kind !== 'number') throw new WorldError(`${k} is text; set it with values instead of shift`)
      row[k] = Number(row[k] ?? 0) + Number(v)
    }
    row.last_updated = nowStamp()
    map[target] = row
    entity[name] = normalValue(f, map)
    const now = (entity[name] as WorldMapValue)[target]
    reply = `${name} for ${target}: ${Object.keys(subs).map((k) => `${k} ${now[k]}`).join(', ')}.${f.keyNoun && worlds.schema(worldIdv).types[f.keyNoun] ? refWarning(worldIdv, f.keyNoun, [target]) : ''}`
  } else {
    if (args.value === null || args.value === undefined) throw new WorldError(`Give the new ${name} in value`)
    if (f.kind === 'enum' && !(f.values ?? []).includes(String(args.value))) throw new WorldError(`${name} can't be "${String(args.value)}". Set value to one of: ${(f.values ?? []).join(', ')}.`)
    if (f.kind === 'number' && !Number.isFinite(Number(args.value))) throw new WorldError(`${name} is a number. Set value to a number, e.g. 3.`)
    entity[name] = normalValue(f, args.value)
    const ids = f.kind === 'ref' && entity[name] ? [String(entity[name])] : f.kind === 'refs' ? (entity[name] as string[]) : []
    reply = `${name} is now ${Array.isArray(entity[name]) ? (entity[name] as string[]).join(', ') : String(entity[name])}.${ids.length ? refWarning(worldIdv, f.to, ids) : ''}`
  }
  worlds.put(worldIdv, typeKey, key, entity, layer)
  return creating ? `Created the ${t.noun} "${key}". ${reply}` : reply
}

export function remember(b: WorldBinding, field: string, args: WriteArgs): string {
  return writeField(b.worldId, b.type, b.id, field, args, null, 'play')
}

export function search(b: WorldBinding, query: string, typeKey: string | null, limit: number | null): string {
  const q = query.trim().toLowerCase()
  if (!q) throw new WorldError('Set query to the text to look for, e.g. a name.')
  const schema = worlds.schema(b.worldId)
  const types = typeKey ? [typeKey] : Object.keys(schema.types)
  const max = Math.min(50, Math.max(1, limit ?? 10))
  const hits: string[] = []
  for (const tk of types) {
    const t = worlds.type(b.worldId, tk)
    for (const [key, e] of Object.entries(worlds.entities(b.worldId, tk, false))) {
      const found: string[] = []
      if (key.includes(q)) found.push(`id: ${key}`)
      for (const [name, f] of visibleFields(t)) {
        const v = e[name]
        if (f.kind === 'list' || f.kind === 'log') (v as WorldEntry[]).forEach((x, i) => x.text.toLowerCase().includes(q) && found.push(`${name}[${i}]: ${x.text}`))
        else if (f.kind === 'map') Object.values(v as WorldMapValue).forEach((r) => JSON.stringify(r).toLowerCase().includes(q) && found.push(`${name} ${r.target}`))
        else if (String(Array.isArray(v) ? v.join(' ') : (v ?? '')).toLowerCase().includes(q)) found.push(`${name}: ${String(v)}`)
      }
      if (found.length) hits.push(`type: ${tk} | id: ${key}\n  ${found.slice(0, 4).join('\n  ')}`)
      if (hits.length >= max) break
    }
    if (hits.length >= max) break
  }
  return hits.length ? `${hits.length} found (pass the type and id to world_recall):\n${hits.join('\n')}` : `Nothing matches "${query}". An id that isn't taken is free to use.`
}

export function postBoard(b: WorldBinding, message: string, to: string | null): string {
  const text = message.trim()
  if (!text) throw new WorldError('Set message to the text to post.')
  const author = `${labelOf(b.worldId, b.type, b.id)} (${b.type}:${b.id})`
  const post = worlds.post(b.worldId, author, to?.trim() || 'ALL', text.slice(0, 4000))
  return `Posted to ${post.to} on the board.`
}

export function readBoard(b: WorldBinding, limit: number | null, query: string | null): string {
  let list = worlds.board(b.worldId).map((p, i) => ({ p, i }))
  if (query?.trim()) list = list.filter(({ p }) => `${p.author} ${p.to} ${p.message}`.toLowerCase().includes(query.trim().toLowerCase()))
  const shown = list.slice(-Math.min(50, Math.max(1, limit ?? 10)))
  if (!shown.length) return query ? `No posts match "${query}".` : 'The board is empty.'
  return shown.map(({ p }) => `[${p.at}] FROM ${p.author} TO ${p.to}${p.edited ? ' (edited)' : ''}\n${p.message}`).join('\n---\n')
}

export function createRecord(worldIdv: string, typeKey: string, id: string, values: Record<string, unknown>): string {
  const t = worlds.type(worldIdv, typeKey)
  const key = worldId(id)
  if (!key) throw new WorldError(`Set id to the new ${t.noun}'s name, e.g. old_mill.`)
  if (worlds.get(worldIdv, typeKey, key, true, 'template')) throw new WorldError(`A ${t.noun} "${key}" already exists. Change it with world_set or world_entries.`)
  const raw: Record<string, unknown> = { [t.label]: id.trim() }
  for (const [name, v] of Object.entries(values)) {
    const [fname, f] = fieldOf(t, name)
    if (!writable(f.lock, 'create')) throw new WorldError(lockMessage(fname, f.lock, t))
    raw[fname] = f.kind === 'list' || f.kind === 'log' ? (Array.isArray(v) ? v : [v]).map((x) => ({ text: String(x), ref: null, locked: false, ...(f.kind === 'log' ? { timestamp: nowStamp() } : {}) })) : v
  }
  worlds.put(worldIdv, typeKey, key, normalEntity(t, raw))
  return `Created the ${t.noun} "${key}".`
}

export function editEntries(worldIdv: string, typeKey: string, id: string, field: string, args: { add: string[] | null; edit: { index: number; text: string } | null; remove: number[] | null; clear: boolean }): string {
  const t = worlds.type(worldIdv, typeKey)
  const key = worldId(id)
  const e = worlds.get(worldIdv, typeKey, key, true, 'template')
  if (!e) throw notFound(new WorldError(`No ${t.noun} with id "${key}". Use world_search to find the right id.`))
  const [name, f] = fieldOf(t, field)
  if (f.kind !== 'list' && f.kind !== 'log') throw new WorldError(`${name} is not a list or log, so world_entries can't change it. Use world_set instead.`)
  let list = [...(e[name] as WorldEntry[])]
  const changes = args.edit || args.remove?.length || args.clear
  if (changes && !writable(f.lock, 'edit')) throw new WorldError(lockMessage(name, f.lock, t))
  if (args.clear) list = list.filter((x) => x.locked)
  if (args.remove?.length) {
    const bad = args.remove.find((i) => i < 0 || i >= list.length)
    if (bad !== undefined) throw new WorldError(`Index ${bad} is out of range: ${list.length ? `use 0 to ${list.length - 1}` : `${name} is empty`}. world_recall with field ${name} shows each entry's index.`)
    const fixed = args.remove.find((i) => list[i].locked)
    if (fixed !== undefined) throw new WorldError(`Entry ${fixed} is fixed and can't be removed; leave it out of remove.`)
    list = list.filter((_, i) => !args.remove?.includes(i))
  }
  if (args.edit) {
    const { index, text } = args.edit
    if (index < 0 || index >= list.length) throw new WorldError(`Index ${index} is out of range: ${list.length ? `use 0 to ${list.length - 1}` : `${name} is empty`}. world_recall with field ${name} shows each entry's index.`)
    if (list[index].locked) throw new WorldError(`Entry ${index} is fixed and can't be edited; add a new entry with add instead.`)
    list[index] = { ...list[index], text }
  }
  worlds.put(worldIdv, typeKey, key, { ...e, [name]: list })
  if (args.add?.length) return writeField(worldIdv, typeKey, key, name, { entries: args.add, weight: null, link: null, target: null, values: null, shift: null, value: null }, null)
  return `${name} now holds ${list.length}.`
}

export function worldGuide(b: WorldBinding | null | undefined, builder: boolean): string {
  if (!b) return "## World\nYou aren't linked to a record in a world yet, so the world tools won't work until the user links you in your agent settings."
  if (!worlds.exists(b.worldId)) return `## World\nYour world "${b.worldId}" no longer exists.`
  const schema = worlds.schema(b.worldId)
  const meta = worlds.meta(b.worldId)
  const me = schema.types[b.type]
  const lines = [`## World: ${meta.name}`]
  lines.push(`You are the ${me?.noun ?? b.type} "${b.id}". world_recall reads any record (yours by default); world_remember changes only your own record; world_search finds records; world_post and world_board are the shared board everyone in the world sees.${builder ? ' As a world builder you can also create, change and delete any record with the world_* tools.' : ''}`)
  lines.push('Types (ids are lower-case; [kind, lock]):')
  for (const [key, t] of Object.entries(schema.types)) {
    const fields = Object.entries(t.fields)
      .filter(([, f]) => f.visible !== false)
      .map(([name, f]) => {
        const bits: string[] = [f.kind]
        if (f.kind === 'enum') bits[0] = `one of ${(f.values ?? []).join('/')}`
        if ((f.kind === 'ref' || f.kind === 'refs') && f.to) bits[0] = `${f.kind} to ${f.to}`
        if (f.kind === 'number' && (f.min !== undefined || f.max !== undefined)) bits[0] = `number ${f.min ?? ''}..${f.max ?? ''}`
        if (f.kind === 'map') bits[0] = `map by ${f.keyNoun ?? 'target'} of ${Object.entries(f.value ?? {}).map(([k, s]) => `${k}${s.kind === 'number' && (s.min !== undefined || s.max !== undefined) ? ` ${s.min ?? ''}..${s.max ?? ''}` : ''}`).join(', ')}`
        if (f.weighted) bits.push('weighted 1-10')
        if (f.entryRef) bits.push(`links to ${f.entryRef.to}`)
        if (f.lock && f.lock !== 'open') bits.push(f.lock === 'locked' ? 'fixed' : f.lock === 'create_only' ? 'set at creation' : 'append only')
        return `${name} [${bits.join(', ')}]${f.describe ? `: ${f.describe}` : ''}`
      })
    const backs = Object.entries(t.backrefs ?? {}).map(([n, s]) => `${n} [derived: ${s.from} whose ${s.via} is this]`)
    lines.push(`- ${key}${t.describe ? ` (${t.describe})` : ''}: ${[...fields, ...backs].join('; ')}`)
  }
  return lines.join('\n')
}

let bindingOf: (agentId: string | null) => WorldBinding | null = () => null

export function setBindingResolver(fn: (agentId: string | null) => WorldBinding | null): void {
  bindingOf = fn
}

export function bindingFor(agentId: string | null): WorldBinding {
  return requireBinding(bindingOf(agentId))
}

export function bindingOrNull(agentId: string | null): WorldBinding | null {
  return bindingOf(agentId)
}
