export type TimelineAction = 'made' | 'changed' | 'talked' | 'remembered' | 'fired' | 'ran'

export interface TimelineEvent {
  id: string
  at: number
  last: number
  kind: string
  entry: string
  action: TimelineAction
  by: string | null
  chat: string | null
}

export interface TimelineRow {
  kind: string
  id: string
  title: string
  icon: string
  label: string
  what: string
  at: number
}

export function dayKey(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function monthOfDay(day: string): string {
  return day.slice(0, 7)
}
