import { componentClass, entryLink, type ComponentDef, type ParamSchema, type ParamSpec } from './core'
import { choiceLabel } from './core/params'
import type { EffectBranch, EffectLane } from './components/Action'

export type SentencePart = { text: string } | { param: string } | { optional: SentencePart[]; at: number }

export function parseSentence(sentence: string): SentencePart[] {
  const out: SentencePart[] = []
  let opt: SentencePart[] | null = null
  let at = 0
  for (const piece of sentence.split(/(\{[^}]+\}|\[|\])/)) {
    if (!piece) continue
    if (piece === '[') {
      opt = []
      continue
    }
    if (piece === ']') {
      if (opt) out.push({ optional: opt, at: at++ })
      opt = null
      continue
    }
    const part: SentencePart = piece.startsWith('{') ? { param: piece.slice(1, -1) } : { text: piece }
    ;(opt ?? out).push(part)
  }
  return out
}

export function paramsIn(parts: SentencePart[]): string[] {
  return parts.flatMap((p) => ('param' in p ? [p.param] : 'optional' in p ? paramsIn(p.optional) : []))
}

/**
 * Renders a sentence template using the same `{var}` and `[optional ...]` syntax as ability piece sentences.
 * Optional `[...]` groups are included only when at least one `{var}` inside them resolves to a non-empty value.
 */
export function renderSentenceTemplate(template: string, vars: Record<string, string>): string {
  if (!template) return ''
  const draw = (parts: SentencePart[]): string =>
    parts
      .map((p) => {
        if ('text' in p) return p.text
        if ('param' in p) return vars[p.param] ?? ''
        const hasValue = paramsIn(p.optional).some((k) => Boolean((vars[k] ?? '').trim()))
        return hasValue ? draw(p.optional) : ''
      })
      .join('')
  return draw(parseSentence(template)).replace(/ {2,}/g, ' ').trim()
}

interface Described {
  PARAMS: ParamSchema
  SENTENCE?: string
  BRANCHES?: EffectBranch[]
}

const described = (type: string): Described | null => componentClass(type) as Described | null

export const branchesOfDef = (def: ComponentDef): EffectBranch[] => described(def.type)?.BRANCHES ?? []

export interface EffectNode {
  def: ComponentDef
  arms: EffectArm[]
}

export interface EffectArm {
  branch: EffectBranch
  nodes: EffectNode[]
}

export interface LaneNodes {
  lane: EffectLane
  nodes: EffectNode[]
}

const onOf = (def: ComponentDef): string => (typeof def.on === 'string' && def.on ? def.on : 'OnUse')

export function laneTree(defs: ComponentDef[], lanes: EffectLane[]): LaneNodes[] {
  const used = new Set<ComponentDef>()
  const take = (event: string): EffectNode[] => {
    const found = defs.filter((d) => !used.has(d) && onOf(d) === event)
    for (const d of found) used.add(d)
    return found.map(node)
  }
  const node = (def: ComponentDef): EffectNode => ({
    def,
    arms: branchesOfDef(def).map((branch) => ({ branch, nodes: typeof def[branch.param] === 'string' && def[branch.param] ? take(String(def[branch.param])) : [] }))
  })
  const out = lanes.map((lane) => ({ lane, nodes: take(lane.event) }))
  for (const d of defs) if (!used.has(d)) out.push({ lane: { event: onOf(d), label: `On ${onOf(d)}` }, nodes: take(onOf(d)) })
  return out
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

export function optionalOn(Class: { PARAMS: ParamSchema }, def: ComponentDef, part: { optional: SentencePart[] }): boolean {
  return paramsIn(part.optional).some((k) => !same(def[k], Class.PARAMS[k]?.default))
}

function valueWords(spec: ParamSpec, value: unknown): string {
  const kind = spec.templateKind ?? spec.entryKind
  if (kind && typeof value === 'string' && value) return entryLink(kind, value)
  if (typeof value === 'string') return spec.choices ? choiceLabel(spec, value) : value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (Array.isArray(value)) return value.map((v) => (spec.of ? valueWords(spec.of, v) : String(v))).join(', ')
  if (value && typeof value === 'object') return Object.entries(value).map(([k, n]) => `${kind ? entryLink(kind, k) : k} ${String(n)}`).join(', ')
  return ''
}

export function sentenceWords(def: ComponentDef): string {
  const Class = described(def.type)
  if (!Class?.SENTENCE) return def.type
  const draw = (parts: SentencePart[]): string =>
    parts
      .map((p) => {
        if ('text' in p) return p.text
        if ('param' in p) {
          const spec = Class.PARAMS[p.param]
          return spec ? valueWords(spec, def[p.param] ?? spec.default) || `[${p.param}]` : ''
        }
        return optionalOn(Class, def, p) ? draw(p.optional) : ''
      })
      .join('')
  return draw(parseSentence(Class.SENTENCE)).replace(/\s+/g, ' ').trim()
}

function nodeLines(nodes: EffectNode[], depth: number): string[] {
  const pad = '  '.repeat(depth)
  return nodes.flatMap((n) => [
    `${pad}${sentenceWords(n.def)}.`,
    ...n.arms.flatMap((arm) => (arm.nodes.length ? [`${pad}  ${arm.branch.label}:`, ...nodeLines(arm.nodes, depth + 2)] : []))
  ])
}

export function effectsWords(defs: ComponentDef[], lanes: EffectLane[]): string {
  if (!defs.length) return ''
  return laneTree(defs, lanes)
    .filter((l) => l.nodes.length)
    .map((l) => [`${l.lane.label}:`, ...nodeLines(l.nodes, 1)].join('\n'))
    .join('\n')
}
