export interface SearchField {
  name: string
  value: string
}

export interface SearchDoc {
  title: string
  tags?: string[]
  labels?: string[]
  fields?: SearchField[]
  body?: string
}

export interface QueryClause {
  include: string[]
}

export interface ParsedQuery {
  clauses: QueryClause[]
  exclude: string[]
}

interface Token {
  text: string
  quoted: boolean
}

function tokenize(raw: string): Token[] {
  const out: Token[] = []
  const re = /(-?)"([^"]*)"|(\|)|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    if (m[2] !== undefined) {
      const prefix = m[1] === '-' ? '-' : ''
      const inner = m[2].trim()
      if (inner) out.push({ text: `${prefix}${inner}`, quoted: true })
    } else if (m[3]) {
      out.push({ text: '|', quoted: false })
    } else if (m[4]) {
      out.push({ text: m[4], quoted: false })
    }
  }
  return out
}

export function parseQuery(raw: string): ParsedQuery {
  const tokens = tokenize(raw.trim())
  const clauses: QueryClause[] = [{ include: [] }]
  const exclude: string[] = []
  for (const tok of tokens) {
    if (!tok.quoted && (tok.text === 'OR' || tok.text === '|')) {
      if (clauses[clauses.length - 1].include.length > 0) clauses.push({ include: [] })
      continue
    }
    if (tok.text.startsWith('-') && tok.text.length > 1) {
      const term = tok.text.slice(1).trim().toLowerCase()
      if (term) exclude.push(term)
      continue
    }
    const term = tok.text.trim().toLowerCase()
    if (term) clauses[clauses.length - 1].include.push(term)
  }
  const nonEmpty = clauses.filter((c) => c.include.length > 0)
  return { clauses: nonEmpty, exclude }
}

function clipAround(text: string, needle: string, max = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const at = needle ? clean.toLowerCase().indexOf(needle) : -1
  if (at < 0) return `${clean.slice(0, max - 1)}…`
  const start = Math.max(0, at - Math.floor(max / 3))
  const end = Math.min(clean.length, start + max)
  return `${start > 0 ? '…' : ''}${clean.slice(start, end)}${end < clean.length ? '…' : ''}`
}

export interface DocMatch {
  score: number
  snippet: string
}

export function scoreDoc(rawQuery: string, doc: SearchDoc): DocMatch | null {
  const trimmed = rawQuery.trim()
  if (!trimmed) return { score: 1, snippet: '' }
  const { clauses, exclude } = parseQuery(trimmed)
  const title = doc.title.toLowerCase()
  const tags = (doc.tags ?? []).map((t) => t.toLowerCase())
  const tagsText = tags.join(' ')
  const labelsText = (doc.labels ?? []).map((l) => l.toLowerCase()).join(' ')
  const fields = (doc.fields ?? [])
    .filter((f) => f.value.trim())
    .map((f) => ({ name: f.name, value: f.value, lowerName: f.name.toLowerCase(), lowerVal: f.value.toLowerCase() }))
  const body = doc.body ?? ''
  const bodyLower = body.toLowerCase()

  const excludedHit = (term: string) =>
    title.includes(term) || tagsText.includes(term) || bodyLower.includes(term) || fields.some((f) => f.lowerName.includes(term) || f.lowerVal.includes(term))
  if (exclude.some(excludedHit)) return null
  if (!clauses.length) return { score: 1, snippet: '' }

  let best: DocMatch | null = null
  for (const clause of clauses) {
    let score = 0
    let fieldHit: { name: string; value: string; term: string } | null = null
    let bodyTerm: string | null = null
    let ok = true
    for (const term of clause.include) {
      let matched = false
      if (title.includes(term)) {
        score += 10
        matched = true
      }
      if (tags.some((t) => t.includes(term))) {
        score += 6
        matched = true
      }
      const fh = fields.find((f) => f.lowerVal.includes(term) || f.lowerName.includes(term))
      if (fh) {
        score += 5
        matched = true
        fieldHit ??= { name: fh.name, value: fh.value, term }
      }
      if (bodyLower.includes(term)) {
        score += 2
        matched = true
        bodyTerm ??= term
      }
      if (labelsText.includes(term)) {
        score += 1
        matched = true
      }
      if (!matched) {
        ok = false
        break
      }
    }
    if (!ok) continue
    const phrase = clause.include.join(' ')
    if (clause.include.length > 1 && (title.includes(phrase) || bodyLower.includes(phrase) || fields.some((f) => f.lowerVal.includes(phrase)))) {
      score += 4
    }
    const snippet = fieldHit
      ? `${fieldHit.name}: ${clipAround(fieldHit.value, fieldHit.term, 110)}`
      : bodyTerm
        ? clipAround(body, bodyTerm, 130)
        : ''
    if (!best || score > best.score || (score === best.score && !best.snippet && snippet)) {
      best = { score, snippet }
    }
  }
  return best
}

export function matchesWhere(
  where: Record<string, string> | null | undefined,
  doc: { title: string; tags?: string[]; fields?: SearchField[] }
): boolean {
  if (!where) return true
  const fields = doc.fields ?? []
  for (const [rawKey, rawWanted] of Object.entries(where)) {
    const key = rawKey.trim().toLowerCase()
    const wanted = typeof rawWanted === 'string' ? rawWanted.trim() : ''
    if (!key || !wanted) continue
    if (key === 'title' || key === 'name') {
      if (!scoreDoc(wanted, { title: doc.title })) return false
      continue
    }
    if (key === 'tag' || key === 'tags') {
      const tags = doc.tags ?? []
      if (!tags.length || !scoreDoc(wanted, { title: '', tags })) return false
      continue
    }
    const exact = fields.filter((f) => f.name.toLowerCase() === key)
    const target = exact.length ? exact : fields.filter((f) => f.name.toLowerCase().includes(key))
    if (!target.some((f) => scoreDoc(wanted, { title: '', body: f.value }) !== null)) return false
  }
  return true
}

export function flattenText(value: unknown, depth = 0): string {
  if (value === null || value === undefined || depth > 5) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((v) => flattenText(v, depth + 1)).filter(Boolean).join(' ')
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        const text = flattenText(v, depth + 1)
        return text ? `${k}: ${text}` : ''
      })
      .filter(Boolean)
      .join(' ')
  }
  return ''
}
