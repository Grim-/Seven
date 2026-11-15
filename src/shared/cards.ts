export const FIELD_TYPES = ['text', 'longtext', 'number', 'picture', 'choice', 'list'] as const
export type FieldType = (typeof FIELD_TYPES)[number]
export const FIELD_TYPE_LABELS: Record<FieldType, string> = { text: 'Text', longtext: 'Long text', number: 'Number', picture: 'Picture', choice: 'Choice', list: 'List' }

export const PLACES = ['title', 'badge_left', 'badge_right', 'art', 'type_line', 'body', 'rows', 'bar', 'footer', 'none'] as const
export type Place = (typeof PLACES)[number]
export const PLACE_LABELS: Record<Place, string> = {
  title: 'Title',
  badge_left: 'Top-left badge',
  badge_right: 'Top-right badge',
  art: 'Art',
  type_line: 'Type line',
  body: 'Body',
  rows: 'Rows',
  bar: 'Bottom bar',
  footer: 'Footer',
  none: 'Not on the card'
}

export interface CardField {
  id: string
  label: string
  type: FieldType
  place: Place
  options: string[]
}

export interface CardLayout {
  name: string
  color: string
  fields: CardField[]
}

export type CardValue = string | number | string[] | null

export const DEFAULT_CARD_COLOR = '#2dd4bf'

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export function isCardColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v)
}

export function fieldId(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function readLayout(data: unknown, name: string): CardLayout {
  const d = obj(data)
  const seen = new Set<string>()
  const fields = (Array.isArray(d.fields) ? d.fields : []).flatMap((raw): CardField[] => {
    const f = obj(raw)
    const label = str(f.label)
    const id = fieldId(str(f.id) || label)
    if (!label || !id || seen.has(id)) return []
    seen.add(id)
    return [
      {
        id,
        label,
        type: FIELD_TYPES.includes(f.type as FieldType) ? (f.type as FieldType) : 'text',
        place: PLACES.includes(f.place as Place) ? (f.place as Place) : 'none',
        options: Array.isArray(f.options) ? f.options.map(str).filter(Boolean) : []
      }
    ]
  })
  return { name: str(d.name) || name, color: isCardColor(d.color) ? d.color : DEFAULT_CARD_COLOR, fields }
}

export function readValues(data: unknown): Record<string, CardValue> {
  const out: Record<string, CardValue> = {}
  for (const [k, v] of Object.entries(obj(data))) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'string') out[k] = v
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string')
    else out[k] = null
  }
  return out
}

export function valueText(field: CardField, value: CardValue, picture: (id: string) => string): string {
  if (value === null || value === '' || (Array.isArray(value) && !value.length)) return ''
  if (field.type === 'picture' && typeof value === 'string') return picture(value)
  return Array.isArray(value) ? value.join('; ') : String(value)
}

export function cardText(name: string, layout: CardLayout, values: Record<string, CardValue>, picture: (id: string) => string): string {
  const parts = layout.fields.flatMap((f) => {
    const text = valueText(f, values[f.id] ?? null, picture)
    return text ? [`${f.label}: ${text}`] : []
  })
  return `${name} (${layout.name})${parts.length ? `: ${parts.join(', ')}` : ''}`
}
