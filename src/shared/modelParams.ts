import type { ModelConfig, ModelInfo, ModelTraitSet, ParamDef, ParamValue, ServerBuild } from './types'

export interface WeightedFile {
  path: string
  scale: number
}

export function fileList(value: ParamValue | undefined): WeightedFile[] {
  return String(value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.lastIndexOf('|')
      const scale = at > 0 ? Number(line.slice(at + 1)) : NaN
      return at > 0 && Number.isFinite(scale) ? { path: line.slice(0, at), scale } : { path: line, scale: 1 }
    })
}

export function fileListText(items: WeightedFile[]): string {
  return items.map((f) => `${f.path}|${f.scale}`).join('\n')
}

export function fileListFlag(items: WeightedFile[]): string {
  return items.map((f) => `${f.path}:${f.scale}`).join(',')
}

export function fileListFromFlag(text: string): WeightedFile[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = /^(.*):(-?\d+(?:\.\d+)?)$/.exec(part)
      return m && m[1] && !/^[a-z]$/i.test(m[1]) ? { path: m[1], scale: Number(m[2]) } : { path: part, scale: 1 }
    })
}

export function hasFlag(flags: string[], flag: string): boolean {
  return flags.includes(flag) || (flag.startsWith('--no-') && flags.includes(`--${flag.slice(5)}`))
}

export function buildBlock(def: ParamDef, build: ServerBuild | null): string | null {
  if (!build?.flags || !def.flag?.length) return null
  return def.flag.some((f) => hasFlag(build.flags!, f)) ? null : `Not in llama-server ${build.label}.`
}

export function unsupportedFlags(args: string[], flags: string[]): string[] {
  return [...new Set(args.filter((a) => /^--?[a-zA-Z]/.test(a) && !hasFlag(flags, a)))]
}

export function paramBlock(def: ParamDef, config: ModelConfig, traits: ModelTraitSet, byKey: Map<string, ParamDef>, build: ServerBuild | null = null, seen: Set<string> = new Set()): string | null {
  const missing = buildBlock(def, build)
  if (missing) return missing
  if (def.needs && traits[def.needs.trait] === false) return def.needs.reason
  if (!def.when || seen.has(def.key)) return null
  seen.add(def.key)
  const met = def.when.any.some((w) => {
    const other = byKey.get(w.key)
    if (!other || paramBlock(other, config, traits, byKey, build, new Set(seen))) return false
    const value = config[w.key] ?? other.default
    return w.values ? w.values.includes(value) : value !== other.default
  })
  return met ? null : def.when.reason
}

export function modelTraitSet(info: ModelInfo | null | undefined, vision: boolean | null): ModelTraitSet {
  const seen = vision === null ? {} : { vision }
  if (!info) return seen
  const swa = info.slidingWindow === undefined ? {} : { swa: (info.slidingWindow ?? 0) > 0 }
  return { moe: info.experts !== null, dense: info.experts === null, mtp: Boolean(info.mtpLayers), ...swa, ...seen }
}
