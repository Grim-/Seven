import * as chrono from 'chrono-node'

export function parseMoment(text: string, now: Date = new Date(), forward = true): Date | null {
  const t = text.trim()
  if (!t) return null
  return chrono.parseDate(t, now, { forwardDate: forward }) ?? null
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dayOf(text: string | null, now: Date = new Date()): string | null {
  if (!text?.trim()) return null
  const t = text.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const d = parseMoment(t, now, false)
  return d ? ymd(d) : t
}
