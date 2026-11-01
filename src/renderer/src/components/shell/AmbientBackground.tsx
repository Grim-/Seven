import { useEffect, useRef } from 'react'

const FEED = [
  'SYS.ENGINE // UTILITY_PROCESS READY',
  'AWAITING_INPUT...',
  '[CONTEXT_IDLE]',
  'KV_CACHE // PREFIX REUSE ENABLED',
  'AGENT_PROFILE: SEVEN',
  'LLAMA.CPP // NATIVE BINDINGS ONLINE',
  'SESSION_STORE: EVENTS.JSONL',
  'STREAM // TOKEN DELTA',
  '[FRAGMENT_IDLE]',
  'THOUGHT_SEGMENT // COLLAPSED',
  'GGUF // TENSORS MAPPED',
  'WARNING: CONTEXT SHIFT ON OVERFLOW'
]

const COLOR = '0, 229, 255'

interface Packet {
  text: string
  original: string
  x: number
  y: number
  vx: number
  vy: number
  base: number
  alpha: number
}

export function AmbientBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const w = () => canvas.clientWidth
    const h = () => canvas.clientHeight
    const mouse = { x: -1000, y: -1000 }
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }
    const onOut = () => {
      mouse.x = -1000
      mouse.y = -1000
    }
    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onOut)

    const spawn = (scatter: boolean): Packet => {
      const text = FEED[Math.floor(Math.random() * FEED.length)]
      const base = Math.random() * 0.18 + 0.05
      return {
        text,
        original: text,
        x: scatter ? Math.random() * w() : Math.random() > 0.5 ? -200 : w() + 200,
        y: Math.random() * h(),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        base,
        alpha: base
      }
    }

    const packets = Array.from({ length: 22 }, () => spawn(true))
    const glitch = '0123456789<>{}[]/\\|@#$%'
    let frame = 0

    const draw = () => {
      frame = requestAnimationFrame(draw)
      if (document.hidden) return
      ctx.clearRect(0, 0, w(), h())
      ctx.font = '11px ui-monospace, Consolas, monospace'
      for (const p of packets) {
        p.x += p.vx
        p.y += p.vy
        if (p.x > w() + 300) p.x = -300
        if (p.x < -300) p.x = w() + 300
        if (p.y > h() + 40) p.y = -40
        if (p.y < -40) p.y = h() + 40
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist = Math.hypot(dx, dy)
        if (dist < 180 && dist > 0) {
          const force = (180 - dist) / 180
          p.x += (dx / dist) * force * 1.4
          p.y += (dy / dist) * force * 1.4
          if (Math.random() > 0.65) {
            const chars = p.original.split('')
            chars[Math.floor(Math.random() * chars.length)] = glitch[Math.floor(Math.random() * glitch.length)]
            p.text = chars.join('')
          }
          p.alpha = 0.7
        } else {
          p.text = p.original
          p.alpha += (p.base - p.alpha) * 0.05
        }
        ctx.fillStyle = `rgba(${COLOR}, ${p.alpha})`
        ctx.fillText(p.text, p.x, p.y)
      }
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onOut)
    }
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px]" />
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 shadow-[inset_0_0_160px_60px_var(--color-bg)]" />
    </div>
  )
}
