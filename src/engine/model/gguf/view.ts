type Section = Record<string, unknown>

export type GgufMeta = Record<string, unknown>

export interface GgufView {
  general: Section
  adapter: Section
  architecture: string | null
  arch: Section
  tokenizer: Section
  quantize: Section
  split: Section
  tensorNames: string[]
}

const section = (v: unknown): Section => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Section) : {})

export function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export function count(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function viewOf(meta: GgufMeta, tensorNames: string[] = []): GgufView {
  const general = section(meta.general)
  const architecture = text(general.architecture)
  return {
    general,
    adapter: section(meta.adapter),
    architecture,
    arch: section(architecture ? meta[architecture] : null),
    tokenizer: section(meta.tokenizer),
    quantize: section(meta.quantize),
    split: section(meta.split),
    tensorNames
  }
}
