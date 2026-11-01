import type { FieldDef, FieldType, FieldValue } from '@shared/types'
import { FIELD_TYPES } from '@shared/types'

export class DataError extends Error {}

const NAME = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,47}$/u
const DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/
const TRUE = new Set(['true', 'yes', 'y', '1', 'done', 'checked', 'x'])
const FALSE = new Set(['false', 'no', 'n', '0', '', 'not done', 'unchecked'])

export function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
}

function describe(value: unknown): string {
  if (typeof value === 'string') return `"${value.length > 40 ? `${value.slice(0, 37)}...` : value}"`
  return JSON.stringify(value) ?? String(value)
}

export function cleanFields(input: unknown): FieldDef[] {
  if (!Array.isArray(input) || input.length === 0) throw new DataError('Give at least one field')
  if (input.length > 40) throw new DataError('A page can have at most 40 fields. Remove some fields first.')
  const problems: string[] = []
  const seen = new Set<string>()
  const fields: FieldDef[] = []
  input.forEach((raw, i) => {
    const f = (raw ?? {}) as Record<string, unknown>
    const name = typeof f.name === 'string' ? f.name.trim() : ''
    const type = typeof f.type === 'string' ? (f.type.trim().toLowerCase() as FieldType) : ('' as FieldType)
    if (!NAME.test(name)) {
      problems.push(`Field ${i + 1}: name ${describe(f.name)} must be 1-48 letters, numbers, spaces, - or _`)
      return
    }
    const key = name.toLowerCase()
    if (seen.has(key)) problems.push(`Field "${name}" is listed twice`)
    seen.add(key)
    if (!FIELD_TYPES.includes(type)) {
      problems.push(`Field "${name}": type ${describe(f.type)} is not one of ${FIELD_TYPES.join(', ')}`)
      return
    }
    const options = Array.isArray(f.options)
      ? [...new Set(f.options.filter((o): o is string => typeof o === 'string').map((o) => o.trim()).filter(Boolean))]
      : []
    if (type === 'select' && options.length === 0) problems.push(`Field "${name}": a select field needs options`)
    fields.push({ name, type, options: type === 'select' ? options : [], required: f.required === true })
  })
  if (problems.length) throw new DataError(problems.join('\n'))
  return fields
}

export function coerce(field: FieldDef, value: unknown, assetExists: (id: string) => boolean): FieldValue {
  if (value === null || value === undefined) return null
  switch (field.type) {
    case 'text':
      if (typeof value === 'string') return value
      if (typeof value === 'number' || typeof value === 'boolean') return String(value)
      if (Array.isArray(value)) return value.map(String).join(', ')
      break
    case 'number': {
      const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value.trim()) : NaN
      if (Number.isFinite(n)) return n
      throw new DataError(`must be a number, got ${describe(value)}`)
    }
    case 'boolean':
      if (typeof value === 'boolean') return value
      if (typeof value === 'number') return value !== 0
      if (typeof value === 'string') {
        const v = value.trim().toLowerCase()
        if (TRUE.has(v)) return true
        if (FALSE.has(v)) return false
      }
      throw new DataError(`must be true or false, got ${describe(value)}`)
    case 'date': {
      const s = typeof value === 'string' ? value.trim() : ''
      if (s === '') return null
      const m = DATE.exec(s)
      if (m) {
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
        if (d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])) return m[4] ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : `${m[1]}-${m[2]}-${m[3]}`
      }
      throw new DataError(`must be a date like 2026-10-03 (or 2026-10-03T14:30), got ${describe(value)}`)
    }
    case 'select': {
      const s = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''
      if (s === '') return null
      const match = field.options.find((o) => o.toLowerCase() === s.toLowerCase())
      if (match) return match
      throw new DataError(`must be one of ${field.options.map((o) => `"${o}"`).join(', ')}, got ${describe(value)}`)
    }
    case 'tags': {
      const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : null
      if (!list) break
      return [...new Set(list.map((t) => String(t).trim()).filter(Boolean))]
    }
    case 'url': {
      const s = typeof value === 'string' ? value.trim() : ''
      if (s === '') return null
      try {
        const u = new URL(s)
        if (['http:', 'https:', 'mailto:'].includes(u.protocol)) return s
      } catch {
        throw new DataError(`must be a full web address starting with https://, got ${describe(value)}`)
      }
      throw new DataError(`must be an http, https or mailto address, got ${describe(value)}`)
    }
    case 'asset': {
      const s = typeof value === 'string' ? value.trim() : ''
      if (s === '') return null
      if (assetExists(s)) return s
      throw new DataError(`must be the id of a file Seven knows about (from show), got ${describe(value)}`)
    }
  }
  throw new DataError(`must be ${field.type === 'tags' ? 'a list of tags, e.g. ["red", "blue"]' : 'text'}, got ${describe(value)}`)
}

export function validateValues(
  fields: FieldDef[],
  input: unknown,
  options: { partial: boolean; label: string; assetExists: (id: string) => boolean }
): Record<string, FieldValue> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new DataError(`${options.label}: give an object of field names to values, e.g. {"title": "Milk", "done": false}`)
  const byName = new Map(fields.map((f) => [f.name.toLowerCase(), f]))
  const out: Record<string, FieldValue> = {}
  const problems: string[] = []
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const field = byName.get(key.trim().toLowerCase())
    if (!field) {
      problems.push(`unknown field "${key}" (fields are: ${fields.map((f) => f.name).join(', ')})`)
      continue
    }
    try {
      const v = coerce(field, value, options.assetExists)
      if (v === null && field.required) problems.push(`"${field.name}" is required and can't be empty`)
      else out[field.name] = v
    } catch (err) {
      problems.push(`"${field.name}" ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (!options.partial) {
    for (const f of fields) if (f.required && (out[f.name] === undefined || out[f.name] === null) && !problems.some((p) => p.includes(`"${f.name}"`))) problems.push(`"${f.name}" is required`)
  }
  if (problems.length) throw new DataError(`${options.label}: ${problems.join('; ')}`)
  return out
}

export { matches, compare } from '@shared/records'
