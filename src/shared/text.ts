import { toId } from './ids'

export function plainText(markdown: string, keepLines = false): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_m, a: string, b?: string) => b ?? a)
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, keepLines ? '- ' : '')
    .replace(/^- (\[[ x]\]) /gm, '$1 ')
    .replace(/[*_~#|]/g, '')
  if (!keepLines) return text.replace(/\s+/g, ' ').trim()
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function matchSnippet(text: string, needle: string): string {
  const at = text.toLowerCase().indexOf(needle)
  if (at === -1) return ''
  const from = Math.max(0, at - 50)
  return `${from ? '...' : ''}${text.slice(from, at + needle.length + 70).replace(/\s+/g, ' ').trim()}...`
}

export function withoutTitle(markdown: string, title: string): string {
  const lines = markdown.split('\n')
  return lines[0]?.trim() === `# ${title}` ? lines.slice(1).join('\n').trim() : markdown.trim()
}

export function referencePattern(): RegExp {
  return /(^|[\s(])@([a-z][\w.-]*):("[^"]+"|[^\s,;!?)#&:]*[^\s,;!?)#&:.])(?::([a-z][\w-]*))?(?:#([a-z][\w-]*))?/gi
}

export interface TextReference {
  kind: string
  ref: string
  link: string
}

export function referencesIn(text: string): TextReference[] {
  const seen = new Map<string, TextReference>()
  for (const m of text.matchAll(referencePattern())) {
    const link = `@${m[2].toLowerCase()}:${m[3]}`
    if (!seen.has(link)) seen.set(link, { kind: m[2].toLowerCase(), ref: m[3], link })
  }
  return [...seen.values()]
}

export function linkFor(kind: string, name: string, part: string | null = null, action: string | null = null): string {
  return `@${kind}:${toId(name) || name}${action ? `:${action}` : ''}${part ? `#${part}` : ''}`
}

export function splitLink(text: string): { kind: string | null; ref: string; action: string | null; part: string | null } {
  const m = /^@?([a-z][\w.-]*):("[^"]+"|[^#:\s]+?)(?::([a-z][\w-]*))?(?:#([a-z][\w-]*))?$/i.exec(text.trim())
  if (!m) return { kind: null, ref: text.trim(), action: null, part: null }
  return {
    kind: m[1].toLowerCase(),
    ref: m[2].replace(/^"|"$/g, ''),
    action: m[3]?.toLowerCase() ?? null,
    part: m[4]?.toLowerCase() ?? null
  }
}

export function referenceHref(kind: string, ref: string): string {
  return `seven:${kind}/${encodeURIComponent(ref.replace(/^"|"$/g, ''))}`
}

const linkKey = (kind: string, ref: string): string => `${kind.toLowerCase()}:${ref.replace(/^"|"$/g, '').toLowerCase()}`

export function relinkText(text: string, kind: string, ref: string, to: string): string {
  const want = linkKey(kind, ref)
  return text.replace(referencePattern(), (whole: string, lead: string, k: string, r: string, action?: string, part?: string) =>
    linkKey(k, r) !== want ? whole : to ? `${lead}${to}${action ? `:${action}` : ''}${part ? `#${part}` : ''}` : ''
  )
}

export function textLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

export function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n)
}
