export interface GuideHeading {
  level: 2 | 3
  text: string
  id: string
}

export interface GuideDoc {
  slug: string
  title: string
  section: string
  order: number
  summary: string
  tags: string[]
  body: string
  headings: GuideHeading[]
  readMinutes: number
  sourceFile: string
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_~()[\]{}]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function extractGuideHeadings(body: string): GuideHeading[] {
  const out: GuideHeading[] = []
  const seen = new Map<string, number>()
  let inFence = false
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (/^(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!m) continue
    const level = m[1].length as 2 | 3
    const text = m[2].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[`*_]/g, '').trim()
    const base = slugifyHeading(text) || 'section'
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    const id = count === 0 ? base : `${base}-${count + 1}`
    out.push({ level, text, id })
  }
  return out
}

export function parseGuideMarkdown(slug: string, raw: string, sourceFile = `${slug}.md`): GuideDoc {
  let frontmatter: Record<string, string> = {}
  let body = raw.replace(/^\uFEFF/, '')
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(body)
  if (fm) {
    body = fm[2]
    for (const line of fm[1].split(/\r?\n/)) {
      const idx = line.indexOf(':')
      if (idx <= 0) continue
      const key = line.slice(0, idx).trim().toLowerCase()
      const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      if (key) frontmatter[key] = val
    }
  }
  const headingMatch = /^#\s+(.+)$/m.exec(body)
  const fallbackTitle = slug
    .replace(/^\d+[-_]?/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
  const title = frontmatter.title || headingMatch?.[1]?.trim() || fallbackTitle
  const section = frontmatter.section || 'Guides'
  const orderNum = Number(frontmatter.order)
  const order = Number.isFinite(orderNum) ? orderNum : 999
  const summary = frontmatter.summary || ''
  const tags = (frontmatter.tags || '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((t) => t.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)

  // Strip a duplicate leading H1 if it matches the frontmatter title
  const trimmedBody = body.trim()
  const cleanedBody = trimmedBody
    .replace(/^#\s+.+(?:\r?\n|$)+/, (match) =>
      match.replace(/^#\s+/, '').trim().toLowerCase() === title.toLowerCase() ? '' : match
    )
    .trim()

  const words = cleanedBody.trim().split(/\s+/).filter(Boolean).length
  const readMinutes = Math.max(1, Math.round(words / 220))
  return {
    slug,
    title,
    section,
    order,
    summary,
    tags,
    body: cleanedBody.trim(),
    headings: extractGuideHeadings(cleanedBody),
    readMinutes,
    sourceFile
  }
}

export function extractGuideSection(body: string, headingId: string): string | null {
  const lines = body.split(/\r?\n/)
  const seen = new Map<string, number>()
  let inFence = false
  let captureLevel: number | null = null
  const collected: string[] = []

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (/^(`{3,}|~{3,})/.test(trimmed)) {
      inFence = !inFence
      if (captureLevel !== null) collected.push(rawLine)
      continue
    }
    if (!inFence) {
      const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(trimmed)
      if (m) {
        const level = m[1].length
        if (captureLevel !== null && level <= captureLevel) break
        if (level === 2 || level === 3) {
          const text = m[2].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[`*_]/g, '').trim()
          const base = slugifyHeading(text) || 'section'
          const count = seen.get(base) ?? 0
          seen.set(base, count + 1)
          const id = count === 0 ? base : `${base}-${count + 1}`
          if (id === headingId && captureLevel === null) {
            captureLevel = level
            collected.push(rawLine)
            continue
          }
        }
      }
    }
    if (captureLevel !== null) collected.push(rawLine)
  }

  return collected.length ? collected.join('\n').trim() : null
}

export function resolveGuideMediaUrl(src: string | undefined, mediaMap: Record<string, string>): string | undefined {
  if (!src) return undefined
  const clean = src.trim()
  if (/^(https?:|data:|blob:|seven:)/i.test(clean)) return clean
  const normalized = clean
    .replace(/\\/g, '/')
    .replace(/^(\.\.\/|\.\/|\/)+/, '')
    .replace(/^media\//i, '')
  const direct = mediaMap[normalized.toLowerCase()]
  if (direct) return direct
  const base = normalized.split('/').pop()?.toLowerCase()
  return base ? mediaMap[base] ?? clean : clean
}

export function searchGuides(guides: readonly GuideDoc[], query: string): { guide: GuideDoc; snippet: string | null }[] {
  const q = query.trim().toLowerCase()
  if (!q) return guides.map((guide) => ({ guide, snippet: null }))
  const terms = q.split(/\s+/).filter(Boolean)
  const scored: { guide: GuideDoc; score: number; snippet: string | null }[] = []

  for (const guide of guides) {
    const titleL = guide.title.toLowerCase()
    const summaryL = guide.summary.toLowerCase()
    const sectionL = guide.section.toLowerCase()
    const tagsL = guide.tags.join(' ').toLowerCase()
    const bodyL = guide.body.toLowerCase()
    const combined = `${titleL}\n${sectionL}\n${summaryL}\n${tagsL}\n${bodyL}`
    if (!terms.every((t) => combined.includes(t))) continue

    let score = 0
    for (const t of terms) {
      if (titleL.includes(t)) score += 12
      if (tagsL.includes(t)) score += 6
      if (summaryL.includes(t)) score += 4
      if (sectionL.includes(t)) score += 3
      if (bodyL.includes(t)) score += 1
    }

    let snippet: string | null = null
    const firstTerm = terms[0]
    const pos = bodyL.indexOf(firstTerm)
    if (pos >= 0) {
      const start = Math.max(0, pos - 48)
      const end = Math.min(guide.body.length, pos + 110)
      snippet =
        (start > 0 ? '…' : '') +
        guide.body
          .slice(start, end)
          .replace(/[#*_`>\[\]]/g, '')
          .replace(/\s+/g, ' ')
          .trim() +
        (end < guide.body.length ? '…' : '')
    }
    scored.push({ guide, score, snippet })
  }

  return scored.sort((a, b) => b.score - a.score || a.guide.order - b.guide.order).map(({ guide, snippet }) => ({ guide, snippet }))
}
