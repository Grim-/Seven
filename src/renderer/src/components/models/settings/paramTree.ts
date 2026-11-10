import type { ModelConfig, ModelTraitSet, PackValue, ParamDef, ServerBuild } from '@shared/types'
import { buildBlock, paramBlock } from '@shared/modelParams'

export interface ParamContext {
  config: ModelConfig
  own: ModelConfig
  packs: Record<string, PackValue>
  traits: ModelTraitSet
  byKey: Map<string, ParamDef>
  build: ServerBuild | null
}

export interface ParamNode {
  def: ParamDef
  children: ParamNode[]
}

export interface SectionView {
  common: ParamNode[]
  more: ParamNode[]
  unavailable: { def: ParamDef; reason: string }[]
}

export function valueOf(def: ParamDef, config: ModelConfig): ParamDef['default'] {
  return config[def.key] ?? def.default
}

export function isChanged(def: ParamDef, config: ModelConfig): boolean {
  return valueOf(def, config) !== def.default
}

export function unavailableReason(def: ParamDef, ctx: ParamContext): string | null {
  return buildBlock(def, ctx.build) ?? (def.needs && ctx.traits[def.needs.trait] === false ? def.needs.reason : null)
}

function metKey(def: ParamDef, ctx: ParamContext): string | null {
  if (!def.when) return null
  const met = def.when.any.find((w) => {
    const other = ctx.byKey.get(w.key)
    const value = ctx.config[w.key] ?? other?.default
    return w.values ? w.values.includes(value as ParamDef['default']) : value !== other?.default
  })
  return (met ?? def.when.any[0]).key
}

export function sectionView(defs: ParamDef[], ctx: ParamContext): SectionView {
  const view: SectionView = { common: [], more: [], unavailable: [] }
  const live: ParamDef[] = []
  for (const def of defs) {
    const reason = unavailableReason(def, ctx)
    if (reason) view.unavailable.push({ def, reason })
    else live.push(def)
  }
  const nodes = new Map(live.map((def) => [def.key, { def, children: [] as ParamNode[] }]))
  const roots: ParamNode[] = []
  for (const def of live) {
    const node = nodes.get(def.key)!
    const parent = metKey(def, ctx)
    const shown = !paramBlock(def, ctx.config, ctx.traits, ctx.byKey, ctx.build)
    if (parent && parent !== def.key && nodes.has(parent)) {
      if (shown) nodes.get(parent)!.children.push(node)
    } else if (shown) roots.push(node)
  }
  for (const node of roots) (node.def.more ? view.more : view.common).push(node)
  return view
}

export function paramMatches(def: ParamDef, query: string): boolean {
  const q = query.trim().toLowerCase()
  return !q || [def.label, def.key, def.hint ?? '', ...(def.flag ?? [])].some((w) => w.toLowerCase().includes(q))
}
