export interface StatTerm {
  who: 'user' | 'target'
  stat: string
}

export interface FormulaParts {
  dice: Record<number, number>
  stats: StatTerm[]
  flat: number
}

const TERM = /^(?:(\d+)d(\d+)|(\d+)|(user|target)\.([A-Za-z_]\w*))$/

export function splitFormula(source: string): FormulaParts | null {
  const text = source.trim() || '0'
  const out: FormulaParts = { dice: {}, stats: [], flat: 0 }
  const pieces = text.replace(/\s+/g, '').split(/(?=[+-])/)
  for (const raw of pieces) {
    const sign = raw.startsWith('-') ? -1 : 1
    const body = raw.replace(/^[+-]/, '')
    const m = TERM.exec(body)
    if (!m) return null
    if (m[1]) {
      if (sign < 0) return null
      const sides = Number(m[2])
      out.dice[sides] = (out.dice[sides] ?? 0) + Number(m[1])
    } else if (m[3]) out.flat += sign * Number(m[3])
    else {
      if (sign < 0) return null
      out.stats.push({ who: m[4] as StatTerm['who'], stat: m[5] })
    }
  }
  return out
}

export function joinFormula(parts: FormulaParts): string {
  const terms = [
    ...Object.entries(parts.dice)
      .filter(([, n]) => n > 0)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([s, n]) => `${n}d${s}`),
    ...parts.stats.map((s) => `${s.who}.${s.stat}`)
  ]
  let out = terms.join(' + ')
  if (parts.flat) out = out ? `${out} ${parts.flat < 0 ? '-' : '+'} ${Math.abs(parts.flat)}` : String(parts.flat)
  return out || '0'
}

export function diceRange(parts: FormulaParts): { lo: number; hi: number; avg: number } {
  let lo = parts.flat
  let hi = parts.flat
  let avg = parts.flat
  for (const [s, n] of Object.entries(parts.dice)) {
    lo += n
    hi += n * Number(s)
    avg += (n * (Number(s) + 1)) / 2
  }
  return { lo, hi, avg }
}

export function diceSpread(parts: FormulaParts, bars = 40): number[] {
  let dist = new Map<number, number>([[0, 1]])
  for (const [s, n] of Object.entries(parts.dice)) {
    const sides = Number(s)
    for (let i = 0; i < n; i++) {
      const next = new Map<number, number>()
      for (const [k, p] of dist) for (let f = 1; f <= sides; f++) next.set(k + f, (next.get(k + f) ?? 0) + p / sides)
      dist = next
    }
  }
  const vals = [...dist.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1])
  const max = Math.max(...vals)
  const step = Math.max(1, Math.ceil(vals.length / bars))
  const out: number[] = []
  for (let i = 0; i < vals.length; i += step) out.push(vals[i] / max)
  return out
}
