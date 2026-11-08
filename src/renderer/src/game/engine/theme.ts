export interface GameTheme {
  bg: string
  card: string
  line: string
  accent: string
  cyan: string
  purple: string
  alert: string
  ok: string
  text: string
  dim: string
  font: string
}

const COLORS: Record<Exclude<keyof GameTheme, 'font'>, [string, string]> = {
  bg: ['--color-bg', '#090a0d'],
  card: ['--color-card', '#11141c'],
  line: ['--color-line', 'rgba(245, 158, 11, 0.35)'],
  accent: ['--color-accent', '#ffc919'],
  cyan: ['--color-cyan', 'rgb(102, 252, 241)'],
  purple: ['--color-purple', '#a855f7'],
  alert: ['--color-alert', '#ef4444'],
  ok: ['--color-ok', '#34d399'],
  text: ['--color-text', '#ffffff'],
  dim: ['--color-dim', '#a1a1aa']
}

export function themeColour(theme: GameTheme, name: string | null, fallback: string): string {
  if (!name || name === 'font' || !(name in theme)) return fallback
  return theme[name as keyof GameTheme]
}

function resolved(probe: HTMLElement, g: CanvasRenderingContext2D, name: string, fallback: string): string {
  probe.style.color = `var(${name}, ${fallback})`
  g.clearRect(0, 0, 1, 1)
  g.fillStyle = fallback
  g.fillStyle = getComputedStyle(probe).color
  g.fillRect(0, 0, 1, 1)
  const [r, gr, b, a] = g.getImageData(0, 0, 1, 1).data
  return `rgba(${r}, ${gr}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`
}

export function readTheme(): GameTheme {
  const font = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() || 'Segoe UI, sans-serif'
  const probe = document.createElement('span')
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const g = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  try {
    const colors = Object.fromEntries(Object.entries(COLORS).map(([key, [name, fallback]]) => [key, g ? resolved(probe, g, name, fallback) : fallback]))
    return { ...(colors as Omit<GameTheme, 'font'>), font }
  } finally {
    probe.remove()
  }
}
