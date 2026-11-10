import { registerCondition, type PackFacts } from './registry'
import { hasFlag } from '@shared/modelParams'

const GB = 1024 ** 3
const MB_PER_GB = 1024

function strings(value: unknown): string | null {
  return Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string') ? null : 'must be a list of words'
}

function number(value: unknown): string | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? null : 'must be a number of 0 or more'
}

function limit(name: string, what: string, unit: string, read: (f: PackFacts) => number | null, below: boolean) {
  registerCondition({
    name,
    valid: number,
    check: (value, facts) => {
      const seen = read(facts)
      const n = value as number
      if (seen === null) return `${what} is unknown`
      const holds = below ? seen < n : seen > n
      return holds ? null : `${what} is ${Math.round(seen * 10) / 10} ${unit}; needs ${below ? 'under' : 'over'} ${n} ${unit}`
    }
  })
}

registerCondition({
  name: 'model',
  valid: strings,
  check: (value, facts) => {
    const missing = (value as string[]).filter((t) => facts.traits[t as keyof typeof facts.traits] !== true)
    return missing.length ? `the model isn't ${missing.join(', ')}` : null
  }
})

registerCondition({
  name: 'architecture',
  valid: strings,
  check: (value, facts) => ((value as string[]).some((a) => a.toLowerCase() === facts.architecture?.toLowerCase()) ? null : `the architecture is ${facts.architecture ?? 'unknown'}`)
})

registerCondition({
  name: 'backend',
  valid: strings,
  check: (value, facts) => ((value as string[]).some((b) => facts.backends.some((x) => x.toLowerCase() === b.toLowerCase())) ? null : `the active build sees ${facts.backends.join(', ') || 'no devices'}`)
})

registerCondition({
  name: 'buildHas',
  valid: strings,
  check: (value, facts) => {
    if (!facts.flags) return 'the active llama-server version has not been checked'
    const missing = (value as string[]).filter((f) => !hasFlag(facts.flags!, f))
    return missing.length ? `the active llama-server version has no ${missing.join(', ')}` : null
  }
})

registerCondition({
  name: 'fileExceedsVram',
  valid: (value) => (typeof value === 'boolean' ? null : 'must be true or false'),
  check: (value, facts) => {
    if (facts.fileBytes === null || facts.vramFreeMb === null) return 'the model size or free VRAM is unknown'
    const exceeds = facts.fileBytes / (1024 * 1024) > facts.vramFreeMb
    return exceeds === value ? null : exceeds ? 'the model file fits in free VRAM' : "the model file doesn't fit in free VRAM"
  }
})

limit('paramsAboveB', 'the model size', 'B parameters', (f) => f.paramsB, false)
limit('paramsBelowB', 'the model size', 'B parameters', (f) => f.paramsB, true)
limit('fileAboveGb', 'the model file', 'GB', (f) => (f.fileBytes === null ? null : f.fileBytes / GB), false)
limit('vramBelowGb', 'VRAM', 'GB', (f) => (f.vramTotalMb === null ? null : f.vramTotalMb / MB_PER_GB), true)
limit('vramAboveGb', 'VRAM', 'GB', (f) => (f.vramTotalMb === null ? null : f.vramTotalMb / MB_PER_GB), false)
limit('ramBelowGb', 'RAM', 'GB', (f) => f.ramMb / MB_PER_GB, true)
limit('cpuCoresBelow', 'the CPU', 'cores', (f) => f.cpuCores, true)
