export type WorldFieldKind = 'text' | 'number' | 'enum' | 'ref' | 'refs' | 'list' | 'log' | 'map'
export type WorldLock = 'open' | 'locked' | 'create_only' | 'append_only'
export type WorldDisplayAs = 'stat' | 'prose' | 'quote' | 'badge' | 'ledger' | 'timeline' | 'chips' | 'gauge' | 'hidden'

export const WORLD_KINDS: WorldFieldKind[] = ['text', 'number', 'enum', 'ref', 'refs', 'list', 'log', 'map']
export const WORLD_LOCKS: WorldLock[] = ['open', 'create_only', 'append_only', 'locked']
export const WORLD_DISPLAY_AS: WorldDisplayAs[] = ['stat', 'prose', 'quote', 'badge', 'ledger', 'timeline', 'chips', 'gauge', 'hidden']
export const WORLD_LAYOUTS = ['flow', 'stats'] as const
export const WORLD_COLUMNS = ['main', 'left', 'rail'] as const

export interface WorldMapSub {
  kind: 'text' | 'number'
  default?: string | number
  min?: number
  max?: number
  describe?: string
}

export interface WorldField {
  kind: WorldFieldKind
  describe?: string
  lock?: WorldLock
  visible?: boolean
  formerly?: string[]
  default?: string | number
  min?: number
  max?: number
  values?: string[]
  to?: string
  resolve?: boolean
  weighted?: boolean
  entryRef?: { to: string; resolve?: boolean }
  keyNoun?: string
  value?: Record<string, WorldMapSub>
  display?: { group?: string; as?: WorldDisplayAs; order?: number; unit?: string; header?: boolean }
}

export interface WorldGroup {
  id: string
  label: string
  layout?: (typeof WORLD_LAYOUTS)[number]
  column?: (typeof WORLD_COLUMNS)[number]
}

export interface WorldType {
  noun: string
  plural: string
  label: string
  describe?: string
  fields: Record<string, WorldField>
  backrefs?: Record<string, { from: string; via: string; empty?: string }>
  display?: { accent?: string; glyph?: string; icon?: string; groups?: WorldGroup[] }
}

export interface WorldSchema {
  version: number
  types: Record<string, WorldType>
}

export interface WorldEntry {
  text: string
  ref: string | null
  locked: boolean
  timestamp?: string | null
  weight?: number
}

export type WorldMapValue = Record<string, Record<string, string | number | null>>
export type WorldValue = string | number | null | string[] | WorldEntry[] | WorldMapValue
export type WorldEntity = Record<string, WorldValue>

export interface WorldChange {
  by: string | null
  at: string
}

export type WorldChanges = Record<string, WorldChange>

export const CHANGES_KEY = '~changed'

export interface WorldPost {
  at: string
  author: string
  to: string
  message: string
  edited?: boolean
}

export interface WorldBinding {
  worldId: string
  type: string
  id: string
}

export interface WorldLaunch {
  setting: string
  timePeriod: string
  startingMap: string | null
  startingPlace: string | null
  startingTime: number
  premise: string
  incitingIncident: string
  tone: string
  openingActionIds: string[]
}

export function cleanWorldLaunch(raw: unknown): WorldLaunch {
  const v = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '')
  const num = (x: unknown, fallback: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, x) : fallback)
  return {
    setting: str(v.setting),
    timePeriod: str(v.timePeriod),
    startingMap: typeof v.startingMap === 'string' && v.startingMap.trim() ? v.startingMap.trim() : null,
    startingPlace: typeof v.startingPlace === 'string' && v.startingPlace.trim() ? v.startingPlace.trim() : null,
    startingTime: num(v.startingTime, 8 * 3600),
    premise: str(v.premise),
    incitingIncident: str(v.incitingIncident),
    tone: str(v.tone),
    openingActionIds: Array.isArray(v.openingActionIds)
      ? [...new Set(v.openingActionIds.filter((x): x is string => typeof x === 'string' && Boolean(x.trim())).map((x) => x.trim()))]
      : []
  }
}

export interface WorldMeta {
  id: string
  name: string
  types: { key: string; plural: string; count: number }[]
  posts: number
  player: string | null
  rules: string
  tags: string[]
  flags?: Record<string, string | number | boolean>
  launch?: WorldLaunch
  updatedAt: number
}

export interface SchemaCheck {
  errors: string[]
  warnings: string[]
}

const KEY = /^[a-z][a-z0-9_]*$/
const FIELD = /^[A-Za-z][A-Za-z0-9_]*$/
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export const worldId = (value: string): string => value.trim().toLowerCase()

export const recordKey = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, '_')

export function inspectSchema(input: unknown): SchemaCheck {
  const errors: string[] = []
  const warnings: string[] = []
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { errors: ['The schema must be a JSON object'], warnings }
  const schema = input as Partial<WorldSchema>
  if (typeof schema.version !== 'number') errors.push('version must be a number')
  const types = schema.types
  if (!types || typeof types !== 'object' || Array.isArray(types)) {
    errors.push('types must be an object')
    return { errors, warnings }
  }
  for (const [key, t] of Object.entries(types)) {
    const at = `Type "${key}"`
    if (!KEY.test(key)) errors.push(`${at}: the key must be lower-case letters, numbers and _, starting with a letter`)
    if (!t || typeof t !== 'object') {
      errors.push(`${at} must be an object`)
      continue
    }
    if (!t.noun) errors.push(`${at} needs a noun`)
    if (!t.plural) errors.push(`${at} needs a plural`)
    const fields = t.fields && typeof t.fields === 'object' ? t.fields : null
    if (!fields || !Object.keys(fields).length) {
      errors.push(`${at} needs at least one field`)
      continue
    }
    if (!t.label || !(t.label in fields)) errors.push(`${at}: label must name one of its fields`)
    else if (fields[t.label].kind !== 'text') warnings.push(`${at}: the label field "${t.label}" is not a text field`)
    const groups = new Set((t.display?.groups ?? []).map((g) => g.id))
    const usedGroups = new Set<string>()
    const orders = new Map<string, Set<number>>()
    if (t.display?.accent && !HEX.test(t.display.accent)) errors.push(`${at}: accent must be a colour like #4ee1ff`)
    if (t.display?.glyph && t.display.glyph.length > 2) warnings.push(`${at}: glyph should be one or two characters`)
    for (const g of t.display?.groups ?? []) {
      if (g.layout && !WORLD_LAYOUTS.includes(g.layout)) errors.push(`${at}: group "${g.id}" layout must be ${WORLD_LAYOUTS.join(' or ')}`)
      if (g.column && !WORLD_COLUMNS.includes(g.column)) errors.push(`${at}: group "${g.id}" column must be ${WORLD_COLUMNS.join(', ')}`)
    }
    for (const [name, f] of Object.entries(fields)) {
      const fat = `${at}, field "${name}"`
      if (!FIELD.test(name)) errors.push(`${fat}: the name must be letters, numbers and _, starting with a letter`)
      if (!f || !WORLD_KINDS.includes(f.kind)) {
        errors.push(`${fat}: kind must be one of ${WORLD_KINDS.join(', ')}`)
        continue
      }
      if (f.lock && !WORLD_LOCKS.includes(f.lock)) errors.push(`${fat}: lock must be one of ${WORLD_LOCKS.join(', ')}`)
      if (f.kind === 'number' && typeof f.min === 'number' && typeof f.max === 'number' && f.min > f.max) errors.push(`${fat}: min is above max`)
      if (f.kind === 'number' && typeof f.default === 'number' && ((typeof f.min === 'number' && f.default < f.min) || (typeof f.max === 'number' && f.default > f.max))) warnings.push(`${fat}: the default is outside min..max`)
      if (f.kind === 'enum') {
        if (!Array.isArray(f.values) || !f.values.length) errors.push(`${fat}: an enum needs values`)
        else if (f.default !== undefined && !f.values.includes(String(f.default))) warnings.push(`${fat}: the default is not one of the values`)
      }
      if ((f.kind === 'ref' || f.kind === 'refs') && (!f.to || !(f.to in types))) errors.push(`${fat}: "to" must name a type`)
      if (f.entryRef && (!f.entryRef.to || !(f.entryRef.to in types))) errors.push(`${fat}: entryRef.to must name a type`)
      if (f.entryRef && f.kind !== 'list' && f.kind !== 'log') warnings.push(`${fat}: entryRef only applies to list and log fields`)
      if (f.weighted && f.kind !== 'log') warnings.push(`${fat}: weighted only applies to log fields`)
      if (f.resolve && f.kind !== 'ref' && f.kind !== 'refs') warnings.push(`${fat}: resolve only applies to ref fields`)
      if (f.kind === 'map') {
        const subs = f.value && typeof f.value === 'object' ? Object.entries(f.value) : []
        if (!subs.length) errors.push(`${fat}: a map needs at least one value key`)
        for (const [sk, sv] of subs) {
          if (sk === 'target' || sk === 'last_updated') errors.push(`${fat}: "${sk}" is a reserved key`)
          if (!sv || (sv.kind !== 'text' && sv.kind !== 'number')) errors.push(`${fat}: value key "${sk}" must be text or number`)
        }
        if (!f.keyNoun) warnings.push(`${fat}: keyNoun (what the map is keyed by) is missing`)
      }
      if (f.visible === false && f.display) warnings.push(`${fat}: hidden fields don't need display hints`)
      if (f.lock === 'locked' && f.default === undefined && (f.kind === 'text' || f.kind === 'number' || f.kind === 'enum')) warnings.push(`${fat}: locked with no default, so agents will always see it empty`)
      if (f.display?.as && !WORLD_DISPLAY_AS.includes(f.display.as)) errors.push(`${fat}: display.as must be one of ${WORLD_DISPLAY_AS.join(', ')}`)
      if (f.display?.group) {
        usedGroups.add(f.display.group)
        if (!groups.has(f.display.group)) warnings.push(`${fat}: group "${f.display.group}" is not defined in display.groups`)
        if (typeof f.display.order === 'number') {
          const set = orders.get(f.display.group) ?? new Set<number>()
          if (set.has(f.display.order)) warnings.push(`${fat}: another field in group "${f.display.group}" has order ${f.display.order}`)
          set.add(f.display.order)
          orders.set(f.display.group, set)
        }
      }
    }
    for (const g of groups) if (!usedGroups.has(g)) warnings.push(`${at}: group "${g}" has no fields`)
    for (const [name, b] of Object.entries(t.backrefs ?? {})) {
      const bat = `${at}, backref "${name}"`
      if (name in fields) errors.push(`${bat}: has the same name as a field`)
      const from = b?.from ? types[b.from] : undefined
      if (!from) errors.push(`${bat}: "from" must name a type`)
      else if (!b.via || !(b.via in from.fields)) errors.push(`${bat}: "via" must name a field of ${b.from}`)
      else {
        const via = from.fields[b.via]
        if ((via.kind !== 'ref' && via.kind !== 'refs') || via.to !== key) warnings.push(`${bat}: ${b.from}.${b.via} is not a ref to ${key}`)
      }
    }
  }
  return { errors, warnings }
}

function clampNumber(v: number, f: { min?: number; max?: number }): number {
  let n = v
  if (typeof f.min === 'number') n = Math.max(f.min, n)
  if (typeof f.max === 'number') n = Math.min(f.max, n)
  return n
}

export function normalEntry(value: unknown, log: boolean): WorldEntry {
  if (typeof value === 'string') return { text: value, ref: null, locked: false, ...(log ? { timestamp: null } : {}) }
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const ref = typeof v.ref === 'string' && v.ref ? worldId(v.ref) : typeof v.linked_agent_id === 'string' && v.linked_agent_id ? worldId(v.linked_agent_id) : null
  const out: WorldEntry = { text: String(v.text ?? ''), ref, locked: v.locked === true }
  if (log) out.timestamp = typeof v.timestamp === 'string' ? v.timestamp : null
  if (typeof v.weight === 'number') out.weight = Math.min(10, Math.max(1, Math.round(v.weight)))
  return out
}

export function plainValue(v: WorldValue): string {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : x.text)).join(typeof v[0] === 'string' ? ', ' : '\n')
  if (typeof v === 'object') return Object.values(v).map((row) => Object.entries(row).filter(([k]) => k !== 'last_updated').map(([k, x]) => (k === 'target' ? `${x}:` : `${k} ${x ?? ''}`)).join(' ')).join('\n')
  return String(v)
}

export function normalValue(f: WorldField, raw: unknown): WorldValue {
  switch (f.kind) {
    case 'text':
      return raw === undefined || raw === null ? String(f.default ?? '') : String(raw)
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(raw)
      return clampNumber(Number.isFinite(n) && raw !== undefined && raw !== null && raw !== '' ? n : Number(f.default ?? 0), f)
    }
    case 'enum': {
      const values = f.values ?? []
      const fallback = values.includes(String(f.default)) ? String(f.default) : (values[0] ?? '')
      return typeof raw === 'string' && values.includes(raw) ? raw : fallback
    }
    case 'ref':
      return typeof raw === 'string' && raw.trim() ? worldId(raw) : null
    case 'refs':
      return (Array.isArray(raw) ? raw : typeof raw === 'string' && raw ? [raw] : []).filter((x): x is string => typeof x === 'string' && x.trim() !== '').map(worldId)
    case 'list':
    case 'log':
      return (Array.isArray(raw) ? raw : []).map((e) => normalEntry(e, f.kind === 'log'))
    case 'map': {
      const out: WorldMapValue = {}
      const subs = f.value ?? {}
      for (const [target, rec] of Object.entries(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {})) {
        const r = (rec && typeof rec === 'object' ? rec : {}) as Record<string, unknown>
        const row: Record<string, string | number | null> = { target: worldId(target) }
        for (const [k, sub] of Object.entries(subs)) {
          const v = r[k]
          row[k] = sub.kind === 'number' ? clampNumber(typeof v === 'number' ? v : Number(sub.default ?? 0), sub) : v === undefined || v === null ? String(sub.default ?? '') : String(v)
        }
        row.last_updated = typeof r.last_updated === 'string' ? r.last_updated : null
        out[worldId(target)] = row
      }
      return out
    }
  }
}

export function normalEntity(t: WorldType, raw: unknown, includeHidden = true): WorldEntity {
  const src = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  const out: WorldEntity = {}
  for (const [name, f] of Object.entries(t.fields)) {
    if (!includeHidden && f.visible === false) continue
    let value = src[name]
    if (value === undefined) for (const old of f.formerly ?? []) if (src[old] !== undefined) value = src[old]
    out[name] = normalValue(f, value)
  }
  return out
}

export const PLACE_TYPE_KEY = 'place'

export const PLACE_TYPE: WorldType = {
  noun: 'place',
  plural: 'places',
  label: 'Name',
  describe: 'A place in the world. A place can be inside another place, and can be drawn on maps.',
  fields: {
    Name: { kind: 'text', lock: 'create_only', describe: "The place's name." },
    Inside: { kind: 'ref', to: PLACE_TYPE_KEY, describe: 'The place it is inside, if any.' },
    Looks: { kind: 'text', describe: 'What this place looks like visually at a glance (lighting, layout, materials, atmosphere).', display: { as: 'prose' } },
    Exits: { kind: 'list', entryRef: { to: PLACE_TYPE_KEY, resolve: true }, describe: 'Direct ways out of this place (one per line, e.g. "iron door (locked)") linked to the destination place. Only immediate exits are shown to preserve anti-clairvoyancy.' },
    Files: { kind: 'text', describe: 'Links to what belongs here, e.g. @page:the_den @sheet:mara.', display: { as: 'prose' } },
    Now: { kind: 'text', describe: 'What is happening here right now. Replace it as the story moves; never add to it.', display: { as: 'prose' } },
    Actions: { kind: 'text', describe: 'Actions that can be attempted here, one block each: what is attempted with (any) or (all), a "- stat difficulty" line per check, then "pass:" and "fail:". Rolled with action_check.', display: { as: 'prose' } },
    Decisions: { kind: 'text', describe: 'Choices to be made here, one block each: the question with (you decide) or (<agent id> decides), then a "- option" line per option, "- something else" to allow any answer. Never rolled.', display: { as: 'prose' } }
  },
  backrefs: { Places_inside: { from: PLACE_TYPE_KEY, via: 'Inside', empty: 'none' } },
  display: { glyph: '⌖', icon: 'map-pin' }
}

export function withPlaces(schema: WorldSchema): WorldSchema {
  const own = schema.types[PLACE_TYPE_KEY]
  if (own && Object.keys(PLACE_TYPE.fields).every((f) => f in own.fields)) return schema
  const type: WorldType = own ? { ...own, fields: { ...PLACE_TYPE.fields, ...own.fields }, backrefs: { ...PLACE_TYPE.backrefs, ...own.backrefs } } : PLACE_TYPE
  return { ...schema, types: { ...schema.types, [PLACE_TYPE_KEY]: type } }
}

export const STARTER_SCHEMA: WorldSchema = {
  version: 1,
  types: {}
}
