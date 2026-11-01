import type { FieldChange, FieldDef, FieldType } from '@shared/types'

export interface FieldRow {
  key: number
  original: FieldDef | null
  name: string
  type: FieldType
  options: string[]
  required: boolean
}

let rowKey = 1

export function rowOf(field: FieldDef | null, fallback: Partial<FieldRow> = {}): FieldRow {
  return {
    key: rowKey++,
    original: field,
    name: field?.name ?? fallback.name ?? '',
    type: field?.type ?? fallback.type ?? 'text',
    options: field ? [...field.options] : (fallback.options ?? []),
    required: field?.required ?? fallback.required ?? false
  }
}

export function changesFor(rows: FieldRow[], original: FieldDef[]): FieldChange[] {
  const changes: FieldChange[] = []
  for (const f of original) if (!rows.some((r) => r.original === f)) changes.push({ action: 'remove', field: f.name })
  for (const r of rows) if (r.original && r.name.trim() !== r.original.name) changes.push({ action: 'rename', field: r.original.name, newName: r.name.trim() })
  for (const r of rows) {
    if (!r.original) continue
    const options = r.type === 'select' ? r.options : []
    const changed = r.type !== r.original.type || (r.type === 'select' && options.join('\u0000') !== r.original.options.join('\u0000')) || r.required !== r.original.required
    if (changed) changes.push({ action: 'update', field: r.name.trim(), type: r.type, options: r.type === 'select' ? options : null, required: r.required })
  }
  for (const r of rows) if (!r.original && r.name.trim()) changes.push({ action: 'add', field: r.name.trim(), type: r.type, options: r.type === 'select' ? r.options : [], required: r.required })
  return changes
}

export function problemsOf(rows: FieldRow[]): string[] {
  const out: string[] = []
  const names = rows.map((r) => r.name.trim().toLowerCase()).filter(Boolean)
  const repeated = names.filter((n, i) => names.indexOf(n) !== i)
  if (repeated.length) out.push(`Two fields are called ${[...new Set(repeated)].join(', ')}. Give each a different name.`)
  for (const r of rows) if (r.type === 'select' && !r.options.length) out.push(`${r.name.trim() || 'A choice field'} needs at least one option.`)
  return out
}
