export function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1, 7), 16)
  const own = hex.length > 7 ? parseInt(hex.slice(7, 9), 16) / 255 : 1
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(own * alpha * 1000) / 1000})`
}

export type Rgba = [number, number, number, number]

export function withColorReader<T>(use: (read: (css: string, fallback?: string) => Rgba | null) => T): T {
  const probe = document.createElement('span')
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const g = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  try {
    return use((css, fallback = '#000000') => {
      if (!g) return null
      probe.style.color = css
      g.clearRect(0, 0, 1, 1)
      g.fillStyle = fallback
      g.fillStyle = getComputedStyle(probe).color
      g.fillRect(0, 0, 1, 1)
      const [r, gr, b, a] = g.getImageData(0, 0, 1, 1).data
      return [r, gr, b, a / 255]
    })
  } finally {
    probe.remove()
  }
}

export function rgbaText([r, g, b, a]: Rgba): string {
  return `rgba(${r}, ${g}, ${b}, ${Math.round(a * 1000) / 1000})`
}

export function hexText([r, g, b, a]: Rgba, alpha = true): string {
  const two = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${two(r)}${two(g)}${two(b)}${alpha && a < 1 ? two(a * 255) : ''}`
}
