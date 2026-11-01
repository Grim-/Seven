export interface Roll {
  expr: string
  total: number
  detail: string
}

const TERM = /([+-]?)\s*(?:(\d*)d(\d+|%)(?:(k|kh|kl|dl|dh)(\d+))?(!)?|(\d+))/gi

function die(sides: number): number {
  return 1 + Math.floor(Math.random() * sides)
}

export function roll(expr: string): Roll {
  const clean = expr.replace(/\s+/g, '').toLowerCase()
  if (!clean || !/^[+-]?(\d*d(\d+|%)((k|kh|kl|dl|dh)\d+)?!?|\d+)([+-](\d*d(\d+|%)((k|kh|kl|dl|dh)\d+)?!?|\d+))*$/.test(clean)) {
    throw new Error(`"${expr}" is not a dice roll. Examples: 1d20, 2d6+3, 4d6kh3, 3d6!, d% (k/kh keep highest, kl keep lowest, dl/dh drop, ! explodes)`)
  }
  let total = 0
  const parts: string[] = []
  for (const m of clean.matchAll(TERM)) {
    const sign = m[1] === '-' ? -1 : 1
    if (m[7] !== undefined) {
      total += sign * Number(m[7])
      parts.push(`${sign < 0 ? '-' : parts.length ? '+' : ''}${m[7]}`)
      continue
    }
    const count = Math.min(100, Number(m[2] || 1))
    const sides = m[3] === '%' ? 100 : Number(m[3])
    if (sides < 1 || sides > 1000) throw new Error(`"${expr}" has a die with ${sides} sides; use 1 to 1000 sides, e.g. 1d20.`)
    const rolls: number[] = []
    for (let i = 0; i < count; i++) {
      let r = die(sides)
      rolls.push(r)
      let guard = 0
      while (m[6] && r === sides && sides > 1 && guard++ < 20) {
        r = die(sides)
        rolls.push(r)
      }
    }
    let kept = [...rolls]
    const n = Number(m[5] || 0)
    const sorted = [...rolls].sort((a, b) => a - b)
    if (m[4] === 'k' || m[4] === 'kh') kept = sorted.slice(-n)
    else if (m[4] === 'kl') kept = sorted.slice(0, n)
    else if (m[4] === 'dl') kept = sorted.slice(n)
    else if (m[4] === 'dh') kept = sorted.slice(0, Math.max(0, sorted.length - n))
    const sum = kept.reduce((a, b) => a + b, 0)
    total += sign * sum
    parts.push(`${sign < 0 ? '-' : parts.length ? '+' : ''}[${rolls.join(', ')}]${kept.length !== rolls.length ? `→${sum}` : ''}`)
  }
  return { expr: clean, total, detail: parts.join(' ') }
}
