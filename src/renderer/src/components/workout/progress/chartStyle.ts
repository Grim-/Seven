export const ACCENT = 'var(--color-accent)'
export const GRID = 'color-mix(in srgb, var(--color-ink) 7%, transparent)'
export const AXIS = { stroke: 'color-mix(in srgb, var(--color-ink) 15%, transparent)', tick: { fill: 'color-mix(in srgb, var(--color-ink) 55%, transparent)', fontSize: 11 } }
export const TOOLTIP = {
  contentStyle: { background: 'var(--color-card)', border: '1px solid color-mix(in srgb, var(--color-accent) 50%, transparent)', borderRadius: 0, fontSize: 12 },
  labelStyle: { color: 'var(--color-ink)' },
  itemStyle: { color: 'var(--color-ink)' }
}

export function shortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}`
}
