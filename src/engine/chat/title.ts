const FILLER = [
  'hi',
  'hey',
  'hello',
  'yo',
  'ok',
  'okay',
  'so',
  'um',
  'uh',
  'right',
  'well',
  'please',
  'can you',
  'could you',
  'would you',
  'will you',
  'can u',
  'i want you to',
  'i would like you to',
  "i'd like you to",
  'i need you to',
  'i want to',
  "i'd like to",
  'i would like to',
  'i need to',
  'help me',
  'help me to',
  "let's",
  'lets',
  'just',
  'quickly'
]

const TRAILING = ['please', 'for me', 'thanks', 'thank you', 'thx', 'cheers']

const MAX_WORDS = 7

const WEAK_END = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'with', 'of', 'to', 'in', 'on', 'for', 'at', 'by', 'from', 'like', 'about', 'me', 'my', 'your', 'is', 'are', 'it', 'this', 'that', 'some', 'into', 'as'])

function stripLeading(text: string, names: string[]): string {
  const words = [...FILLER, ...names.map((n) => n.toLowerCase())].sort((a, b) => b.length - a.length)
  let out = text
  for (let changed = true; changed; ) {
    changed = false
    const lower = out.toLowerCase()
    for (const w of words) {
      if (lower === w || lower.startsWith(`${w} `) || lower.startsWith(`${w},`)) {
        out = out.slice(w.length).replace(/^[\s,:;-]+/, '')
        changed = true
        break
      }
    }
  }
  return out
}

function stripTrailing(text: string): string {
  let out = text
  for (let changed = true; changed; ) {
    changed = false
    const lower = out.toLowerCase()
    for (const w of TRAILING) {
      if (lower.endsWith(` ${w}`) || lower === w) {
        out = out.slice(0, out.length - w.length).replace(/[\s,]+$/, '')
        changed = true
        break
      }
    }
  }
  return out
}

export function makeTitle(text: string, names: string[] = []): string {
  const clean = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, (m) => m.slice(1, -1))
    .replace(/https?:\/\/\S+/g, ' ')
  const segments = clean
    .split(/[\n.!?]+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  for (const segment of segments) {
    const body = stripTrailing(stripLeading(segment, names)).replace(/^[\s,:;-]+|[\s,:;-]+$/g, '')
    const words = body.split(' ').filter(Boolean)
    if (!words.length || (words.length === 1 && words[0].length < 3)) continue
    let picked = words.slice(0, MAX_WORDS)
    const cut = picked.findIndex((w, i) => i >= 3 && /^(and|but|then|so)$/i.test(w))
    if (cut > 0) picked = picked.slice(0, cut)
    while (picked.length > 2 && WEAK_END.has(picked[picked.length - 1].toLowerCase().replace(/[^\w']/g, ''))) picked = picked.slice(0, -1)
    const title = picked.join(' ').replace(/[,:;-]+$/, '')
    return title.charAt(0).toUpperCase() + title.slice(1)
  }
  const fallback = text.replace(/\s+/g, ' ').trim()
  return fallback ? (fallback.length > 60 ? `${fallback.slice(0, 57)}...` : fallback) : 'New chat'
}
