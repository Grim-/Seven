export const ACCENT = '#ffc919'
export const GRID = 'rgba(255,255,255,0.07)'
export const AXIS = { stroke: 'rgba(255,255,255,0.15)', tick: { fill: 'rgba(255,255,255,0.55)', fontSize: 11 } }
export const TOOLTIP = {
  contentStyle: { background: '#11141c', border: '1px solid rgba(255,201,25,0.5)', borderRadius: 0, fontSize: 12 },
  labelStyle: { color: '#fff' },
  itemStyle: { color: '#fff' }
}

export function shortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}`
}
