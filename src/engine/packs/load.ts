import fs from 'node:fs'
import path from 'node:path'
import type { ParamDef } from '@shared/types'
import { PARAMS, coerce } from '../model/params'
import { conditionOf } from './registry'

export interface Pack {
  id: string
  title: string
  for: string
  why: string
  source: string
  shipped: boolean
  file: string
  when: Record<string, unknown>
  set: Record<string, ParamDef['default']>
  invalid: string | null
}

const TEXT_FIELDS = ['id', 'title', 'for', 'why', 'source'] as const

const byKey = new Map(PARAMS.map((p) => [p.key, p]))

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function errorOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function valueProblem(def: ParamDef, value: unknown): string | null {
  try {
    const used = coerce(def, value)
    return JSON.stringify(used) === JSON.stringify(value) ? null : `isn't a valid value; Seven would use ${JSON.stringify(used)}`
  } catch (err) {
    return `could not be read: ${errorOf(err)}`
  }
}

function conditionProblem(name: string, value: unknown): string | null {
  const condition = conditionOf(name)
  if (!condition) return 'is not a condition Seven knows'
  try {
    return condition.valid(value)
  } catch (err) {
    return `could not be read: ${errorOf(err)}`
  }
}

function problems(raw: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const field of TEXT_FIELDS) if (typeof raw[field] !== 'string' || !(raw[field] as string).trim()) out.push(`"${field}" is missing`)
  if (!isObject(raw.when)) out.push('"when" is missing')
  for (const [name, value] of Object.entries(isObject(raw.when) ? raw.when : {})) {
    const bad = conditionProblem(name, value)
    if (bad) out.push(`when.${name} ${bad}`)
  }
  const set = isObject(raw.set) ? raw.set : {}
  if (!Object.keys(set).length) out.push('"set" is missing or empty')
  for (const [key, value] of Object.entries(set)) {
    const def = byKey.get(key)
    const bad = def ? valueProblem(def, value) : 'is not a model setting'
    if (bad) out.push(`set.${key} ${bad}`)
  }
  return out
}

export function readPack(file: string, shipped: boolean): Pack {
  const name = path.basename(file)
  let raw: Record<string, unknown> = {}
  let issues: string[]
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (isObject(parsed)) {
      raw = parsed
      issues = problems(raw)
    } else issues = ['is not a pack; the file must hold one JSON object']
  } catch (err) {
    issues = [err instanceof SyntaxError ? `is not valid JSON: ${err.message}` : `could not be read: ${errorOf(err)}`]
  }
  const text = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string).trim() : '')
  return {
    id: text('id') || name,
    title: text('title') || name,
    for: text('for'),
    why: text('why'),
    source: text('source'),
    shipped,
    file,
    when: isObject(raw.when) ? raw.when : {},
    set: (isObject(raw.set) ? raw.set : {}) as Record<string, ParamDef['default']>,
    invalid: issues.length ? issues.join('; ') : null
  }
}

function readFolder(dir: string, shipped: boolean): Pack[] {
  let names: string[] = []
  try {
    names = fs.readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.json'))
  } catch {
    return []
  }
  const seen = new Map<string, string>()
  return names.map((name) => {
    const pack = readPack(path.join(dir, name), shipped)
    const first = seen.get(pack.id)
    if (first) return { ...pack, id: name, invalid: [`uses the id "${pack.id}", which ${first} already uses`, pack.invalid].filter(Boolean).join('; ') }
    seen.set(pack.id, name)
    return pack
  })
}

export function loadPacks(shippedDir: string, ownDir: string): Pack[] {
  const own = readFolder(ownDir, false)
  return [...readFolder(shippedDir, true).filter((p) => !own.some((o) => o.id === p.id)), ...own]
}
