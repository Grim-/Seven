export interface Picking {
  picked: string[]
  anchor: string | null
}

export interface PickKeys {
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

export function pickWith(e: PickKeys, id: string, now: Picking & { selected: string | null; order: string[] }): Picking | null {
  if (e.ctrlKey || e.metaKey) {
    const base = now.picked.length ? now.picked : now.selected ? [now.selected] : []
    return { picked: base.includes(id) ? base.filter((x) => x !== id) : [...base, id], anchor: id }
  }
  if (!e.shiftKey) return null
  const from = now.order.indexOf(now.anchor ?? now.selected ?? '')
  const to = now.order.indexOf(id)
  if (from < 0 || to < 0) return null
  const [a, b] = from < to ? [from, to] : [to, from]
  return { picked: now.order.slice(a, b + 1), anchor: now.anchor ?? now.selected }
}
