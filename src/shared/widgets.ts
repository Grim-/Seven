import type { CollectionViewKind, FieldDef, FieldType, ViewOptions, WidgetLayout } from './types'

export interface OptionType {
  name: string
  needsFields: boolean
  clean(value: unknown, def: ViewOptionDef, fields: FieldDef[]): { value?: unknown; problems?: string[] }
}

export interface ViewOptionDef {
  key: string
  label: string
  type: OptionType
  fieldTypes?: FieldType[]
  choices?: string[]
  hint?: string
}

function fieldByName(fields: FieldDef[], name: unknown): FieldDef | undefined {
  return typeof name === 'string' ? fields.find((f) => f.name.toLowerCase() === name.trim().toLowerCase()) : undefined
}

export const BOOLEAN: OptionType = {
  name: 'boolean',
  needsFields: false,
  clean: (value, def) => {
    if (typeof value === 'boolean') return { value }
    if (value === 'true' || value === 'false') return { value: value === 'true' }
    return { problems: [`"${def.key}" must be true or false`] }
  }
}

export const NUMBER: OptionType = {
  name: 'number',
  needsFields: false,
  clean: (value, def) => {
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) && n > 0 ? { value: Math.round(n) } : { problems: [`"${def.key}" must be a positive number`] }
  }
}

export const CHOICE: OptionType = {
  name: 'choice',
  needsFields: false,
  clean: (value, def) =>
    typeof value === 'string' && def.choices?.includes(value.toLowerCase()) ? { value: value.toLowerCase() } : { problems: [`"${def.key}" must be one of ${def.choices?.join(', ')}`] }
}

export const FIELD: OptionType = {
  name: 'field',
  needsFields: true,
  clean: (value, def, fields) => {
    const field = fieldByName(fields, value)
    if (!field) return { problems: [`"${def.key}": there is no field "${String(value)}" (fields: ${fields.map((f) => f.name).join(', ')})`] }
    if (def.fieldTypes && !def.fieldTypes.includes(field.type)) return { problems: [`"${def.key}" needs a ${def.fieldTypes.join(' or ')} field; "${field.name}" is ${field.type}`] }
    return { value: field.name }
  }
}

export const FIELDS: OptionType = {
  name: 'fields',
  needsFields: true,
  clean: (value, def, fields) => {
    const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
    const names: string[] = []
    const problems: string[] = []
    for (const item of list) {
      const field = fieldByName(fields, item)
      if (field) names.push(field.name)
      else problems.push(`"${def.key}": there is no field "${String(item).trim()}"`)
    }
    return { value: names.length ? [...new Set(names)] : undefined, problems }
  }
}

export const FILTER: OptionType = {
  name: 'filter',
  needsFields: true,
  clean: (value, def, fields) => {
    if (typeof value !== 'object' || Array.isArray(value)) return { problems: [`"${def.key}" must be an object of field names to values, e.g. {"day": "Monday"}`] }
    const filter: Record<string, unknown> = {}
    const problems: string[] = []
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const field = fieldByName(fields, k)
      if (field) filter[field.name] = v
      else problems.push(`"${def.key}": there is no field "${k}"`)
    }
    return { value: Object.keys(filter).length ? filter : undefined, problems }
  }
}

export const ASSET_VIEWS = ['auto', 'files', 'gallery'] as const
export type AssetViewKind = (typeof ASSET_VIEWS)[number]

export const HOME_BOARD = 'home'

export const VIEW_LABELS: Record<string, string> = {
  table: 'Table',
  list: 'List',
  checklist: 'Checklist',
  cards: 'Cards',
  board: 'Board',
  calendar: 'Calendar',
  chart: 'Chart',
  text: 'Text',
  addon: 'Tool view',
  tool: 'Glance',
  part: 'Part',
  auto: 'Auto',
  files: 'Files',
  gallery: 'Gallery',
  html: 'HTML',
  present: 'Presentation'
}

const COMMON: ViewOptionDef[] = [
  { key: 'filter', label: 'Only records where', type: FILTER, hint: 'Field name to the value it must equal' },
  { key: 'sort', label: 'Sort by', type: FIELD },
  { key: 'descending', label: 'Sort high to low', type: BOOLEAN },
  { key: 'limit', label: 'Show at most', type: NUMBER }
]

const SHOWN_FIELDS: ViewOptionDef = { key: 'fields', label: 'Fields shown', type: FIELDS, hint: 'Empty shows all' }

export const COLLECTION_OPTIONS: Record<CollectionViewKind, ViewOptionDef[]> = {
  table: [SHOWN_FIELDS, ...COMMON],
  list: [SHOWN_FIELDS, ...COMMON],
  checklist: [
    { key: 'checkField', label: 'Tick field', type: FIELD, fieldTypes: ['boolean'] },
    { key: 'hideDone', label: 'Hide ticked items', type: BOOLEAN },
    ...COMMON
  ],
  cards: [SHOWN_FIELDS, ...COMMON],
  board: [{ key: 'groupBy', label: 'Columns from', type: FIELD, fieldTypes: ['select'] }, ...COMMON],
  calendar: [{ key: 'dateField', label: 'Date field', type: FIELD, fieldTypes: ['date'] }, ...COMMON],
  chart: [
    { key: 'chart', label: 'Chart', type: CHOICE, choices: ['line', 'bar', 'area'] },
    { key: 'x', label: 'Across', type: FIELD, fieldTypes: ['date', 'select', 'text', 'number', 'boolean'] },
    { key: 'y', label: 'Value', type: FIELD, fieldTypes: ['number'], hint: 'Empty counts records' },
    { key: 'aggregate', label: 'Combine with', type: CHOICE, choices: ['sum', 'average', 'count', 'min', 'max'] },
    { key: 'filter', label: 'Only records where', type: FILTER }
  ]
}

export const OTHER_OPTIONS: Record<string, ViewOptionDef[]> = {
  text: [{ key: 'editable', label: 'Allow editing', type: BOOLEAN }],
  addon: [],
  tool: [],
  part: [],
  auto: [],
  files: [],
  gallery: [],
  html: [{ key: 'network', label: 'Allow network (any site)', type: BOOLEAN, hint: 'Off: only scripts and fonts from cdnjs, jsdelivr, unpkg and Google Fonts' }]
}

export function optionsFor(view: string): ViewOptionDef[] {
  return COLLECTION_OPTIONS[view as CollectionViewKind] ?? OTHER_OPTIONS[view] ?? []
}

const SIZES: Record<string, Pick<WidgetLayout, 'w' | 'h'>> = {
  present: { w: 6, h: 8 },
  table: { w: 8, h: 7 },
  list: { w: 4, h: 7 },
  checklist: { w: 4, h: 7 },
  cards: { w: 8, h: 7 },
  board: { w: 12, h: 7 },
  calendar: { w: 8, h: 9 },
  chart: { w: 6, h: 6 },
  text: { w: 4, h: 7 },
  addon: { w: 6, h: 8 },
  tool: { w: 4, h: 7 },
  part: { w: 4, h: 8 },
  auto: { w: 4, h: 6 },
  files: { w: 4, h: 6 },
  gallery: { w: 6, h: 6 },
  html: { w: 6, h: 6 }
}

export interface SizePreset {
  id: string
  label: string
  w: number
  h: number
}

export const GRID_COLS = 12

export const SIZE_PRESETS: SizePreset[] = [
  { id: '1x2', label: 'Micro', w: 1, h: 2 },
  { id: '1x4', label: 'Slim', w: 1, h: 4 },
  { id: '2x4', label: 'Narrow', w: 2, h: 4 },
  { id: '2x2', label: 'Tile', w: 2, h: 2 },
  { id: '3x4', label: 'Quarter', w: 3, h: 4 },
  { id: '6x2', label: 'Half Strip', w: 6, h: 2 },
  { id: 'small', label: 'Small', w: 4, h: 5 },
  { id: 'medium', label: 'Medium', w: 6, h: 6 },
  { id: 'large', label: 'Large', w: 8, h: 8 },
  { id: '12x2', label: 'Banner', w: 12, h: 2 },
  { id: 'wide', label: 'Wide', w: 12, h: 6 },
  { id: '12x10', label: 'Full', w: 12, h: 10 },
  { id: '3x8', label: 'Quarter Tall', w: 3, h: 8 },
  { id: 'tall', label: 'Tall', w: 4, h: 10 },
  { id: '6x10', label: 'Half Tall', w: 6, h: 10 }
]

export const NAMED_SIZES: Record<string, Pick<WidgetLayout, 'w' | 'h'>> = Object.fromEntries(
  SIZE_PRESETS.map((p) => [p.id, { w: p.w, h: p.h }])
)

export function defaultSize(view: string): Pick<WidgetLayout, 'w' | 'h'> {
  return SIZES[view] ?? { w: 6, h: 6 }
}

export function placeWidget(existing: WidgetLayout[], size: Pick<WidgetLayout, 'w' | 'h'>): WidgetLayout {
  const w = Math.min(GRID_COLS, Math.max(1, size.w))
  const h = Math.max(1, size.h)
  const overlaps = (x: number, y: number) => existing.some((l) => x < l.x + l.w && x + w > l.x && y < l.y + l.h && y + h > l.y)
  for (let y = 0; y < 400; y++) {
    for (let x = 0; x + w <= GRID_COLS; x++) if (!overlaps(x, y)) return { x, y, w, h }
  }
  return { x: 0, y: existing.reduce((m, l) => Math.max(m, l.y + l.h), 0), w, h }
}

export function cleanViewOptions(view: string, input: unknown, fields: FieldDef[] | null, strict: boolean): ViewOptions {
  const defs = optionsFor(view)
  const out: ViewOptions = {}
  const problems: string[] = []
  if (input === null || input === undefined) return out
  if (typeof input !== 'object' || Array.isArray(input)) {
    if (strict) throw new Error('options must be an object of option names to values')
    return out
  }
  for (const [rawKey, value] of Object.entries(input as Record<string, unknown>)) {
    if (value === null || value === undefined || value === '') continue
    const def = defs.find((d) => d.key.toLowerCase() === rawKey.toLowerCase())
    if (!def) {
      problems.push(`"${rawKey}" is not an option of the ${view} view${defs.length ? ` (options: ${defs.map((d) => d.key).join(', ')})` : ''}`)
      continue
    }
    if (def.type.needsFields && !fields) continue
    const cleaned = def.type.clean(value, def, fields ?? [])
    if (cleaned.value !== undefined) out[def.key] = cleaned.value
    problems.push(...(cleaned.problems ?? []))
  }
  if (strict && problems.length) throw new Error(problems.join('; '))
  return out
}

export const SUGGESTED_ICONS = [
  'layout-dashboard',
  'dumbbell',
  'heart-pulse',
  'list-checks',
  'book-open',
  'calendar',
  'briefcase',
  'home',
  'shopping-cart',
  'music',
  'image',
  'gamepad-2',
  'code',
  'wallet',
  'utensils',
  'plane',
  'star'
]
