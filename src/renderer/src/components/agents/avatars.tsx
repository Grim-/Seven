import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { AvatarState } from '@shared/types'
import { cn } from '../../lib/cn'

export function Fit({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  useLayoutEffect(() => {
    const b = box.current
    const i = inner.current
    if (!b || !i) return
    const measure = () => {
      const w = i.offsetWidth
      const h = i.offsetHeight
      if (!w || !h) return
      setScale(Math.min(b.clientWidth / w, b.clientHeight / h))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(b)
    ro.observe(i)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={box} className="relative h-full w-full overflow-hidden">
      <div
        ref={inner}
        className="absolute left-1/2 top-1/2 w-max"
        style={{ transform: `translate(-50%, -50%) scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}
      >
        {children}
      </div>
    </div>
  )
}

type Motion = 'shake' | 'bob' | 'droop' | 'flicker' | 'breathe'

interface Expression {
  frames: string[]
  ms: number
}

interface Mood {
  color?: string
  motion?: Motion
  variants: Expression[]
}

const FACE: Record<AvatarState, Mood> = {
  idle: { motion: 'breathe', variants: [{ frames: ['( • _ • )'], ms: 0 }] },
  thinking: {
    variants: [
      { frames: ['(> ⌐■-■)> HM', '(> ⌐■-■)> HM.', '(> ⌐■-■)> HM..', '(> ⌐■-■)> HM...'], ms: 380 },
      { frames: ['( ¬ _ ¬ )', '( ¬ _ ¬ ) .', '( ¬ _ ¬ ) ..', '( ¬ _ ¬ ) ...'], ms: 420 },
      { frames: ['( ˘ ▾ ˘ ) hmm', '( ˘ ▾ ˘ ) hmm.', '( ˘ ▾ ˘ ) hmm..'], ms: 450 },
      { frames: ['( ° ~ ° ) ?', '( ° ~ ° )  ?', '( ° ~ ° ) ?!'], ms: 500 },
      { frames: ['( •_•)>⌐■-■', '( ⌐■_■)'], ms: 900 }
    ]
  },
  talking: {
    variants: [
      { frames: ['( • o • )', '( • _ • )', '( • O • )', '( • ‿ • )'], ms: 150 },
      { frames: ['( ^ o ^ )', '( ^ _ ^ )', '( ^ O ^ )'], ms: 160 },
      { frames: ['( • ᴗ • )', '( • o • )', '( • ᴗ • )', '( • 0 • )'], ms: 140 },
      { frames: ['( ¬ o ¬ )', '( ¬ _ ¬ )', '( ¬ O ¬ )'], ms: 170 }
    ]
  },
  laughing: {
    motion: 'shake',
    variants: [
      { frames: ['( ≧▽≦) HA HA', '(≧▽≦ ) HA HA', '( ≧▽≦)HA HA '], ms: 170 },
      { frames: ['(ﾉ≧∀≦)ﾉ HAHA', '(ﾉ≧▽≦)ﾉ HAHA'], ms: 200 },
      { frames: ['( ´∀｀ ) heh', '( ´▽｀ ) heh'], ms: 260 },
      { frames: ['( X D )', '( X D ) LOL'], ms: 220 }
    ]
  },
  happy: {
    motion: 'bob',
    variants: [
      { frames: ['( ^ ‿ ^ )', '( ^ ▽ ^ )'], ms: 650 },
      { frames: ['( ◕ ‿ ◕ )', '( ◕ ᴗ ◕ )'], ms: 700 },
      { frames: ['( ˘ ᵕ ˘ ) ♪', '( ˘ ᵕ ˘ )  ♪'], ms: 500 },
      { frames: ['( ✿ ◠‿◠ )', '( ✿ ◠ᴗ◠ )'], ms: 800 }
    ]
  },
  sad: {
    color: '#7aa2ff',
    motion: 'droop',
    variants: [
      { frames: ['( ╥ _ ╥ )', '( ╥ ﹏ ╥ )'], ms: 900 },
      { frames: ['( ; _ ; )', '( ;_; )'], ms: 1000 },
      { frames: ['( ._. )', '( .__. )'], ms: 1200 },
      { frames: ['( T _ T )', '( T ﹏ T )'], ms: 950 }
    ]
  },
  error: {
    color: '#ff3b3b',
    motion: 'flicker',
    variants: [
      { frames: ['( x_x ) ERR', '( x_x )    '], ms: 320 },
      { frames: ['( ⊙ _ ⊙ ) !?', '( ⊙ _ ⊙ )   '], ms: 300 },
      { frames: ['( @ _ @ ) ???', '( @ _ @ )    '], ms: 340 }
    ]
  },
  angry: {
    color: '#ff1e3c',
    motion: 'shake',
    variants: [
      { frames: ['( X _ X ) FUCK YOU', '( X 益 X ) FUCK YOU'], ms: 130 },
      { frames: ['( ╬ Ò ﹏ Ó )', '( ╬ Ò 益 Ó )'], ms: 140 },
      { frames: ['(ノಠ益ಠ)ノ彡┻━┻', '(ノಠ益ಠ)ノ 彡┻━┻'], ms: 180 },
      { frames: ['( ò_ó )', '( ò益ó )'], ms: 150 }
    ]
  }
}

const IDLE_BASE = '( • _ • )'
const IDLE_MICRO: { face: string; ms: number; weight: number }[] = [
  { face: '( - _ - )', ms: 140, weight: 6 },
  { face: '(•_•  )', ms: 900, weight: 3 },
  { face: '(  •_•)', ms: 900, weight: 3 },
  { face: '( • ‿ • )', ms: 1400, weight: 2 },
  { face: '( • _ • )?', ms: 1100, weight: 1 },
  { face: '( ¬ _ ¬ )', ms: 1200, weight: 1 },
  { face: '( • _ • ) ♪', ms: 1600, weight: 1 },
  { face: '( ᵕ o ᵕ ) zz', ms: 1800, weight: 1 }
]

function pickMicro(): { face: string; ms: number } {
  const total = IDLE_MICRO.reduce((n, m) => n + m.weight, 0)
  let r = Math.random() * total
  for (const m of IDLE_MICRO) {
    r -= m.weight
    if (r <= 0) return m
  }
  return IDLE_MICRO[0]
}

function pad(frames: string[]): string[] {
  const width = Math.max(...frames.map((f) => [...f].length))
  return frames.map((f) => {
    const gap = width - [...f].length
    const left = Math.floor(gap / 2)
    return ' '.repeat(left) + f + ' '.repeat(gap - left)
  })
}

const IDLE_SET = pad([IDLE_BASE, ...IDLE_MICRO.map((m) => m.face)])

function useIdleFace(active: boolean): number {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (!active) return
    setIndex(0)
    let timer: ReturnType<typeof setTimeout>
    const next = () => {
      timer = setTimeout(() => {
        const micro = pickMicro()
        setIndex(1 + IDLE_MICRO.findIndex((m) => m.face === micro.face))
        timer = setTimeout(() => {
          setIndex(0)
          next()
        }, micro.ms)
      }, 2200 + Math.random() * 4300)
    }
    next()
    return () => clearTimeout(timer)
  }, [active])
  return index
}

export function AsciiFace({ state }: { state: AvatarState }) {
  const mood = FACE[state] ?? FACE.idle
  const [variant, setVariant] = useState(0)
  const [index, setIndex] = useState(0)
  const idle = useIdleFace(state === 'idle')
  useEffect(() => {
    setVariant(Math.floor(Math.random() * mood.variants.length))
    setIndex(0)
  }, [state])
  const expression = mood.variants[variant] ?? mood.variants[0]
  useEffect(() => {
    if (!expression.ms || expression.frames.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % expression.frames.length), expression.ms)
    return () => clearInterval(timer)
  }, [state, variant])
  const text = state === 'idle' ? IDLE_SET[idle] : pad(expression.frames)[index % expression.frames.length]
  const color = mood.color ?? 'var(--color-accent)'
  return (
    <Fit>
      <div className={cn('whitespace-pre px-1 font-mono text-[28px] font-bold leading-none', mood.motion && `av-${mood.motion}`)} style={{ color, textShadow: `0 0 8px ${color}` }}>
        {text}
      </div>
    </Fit>
  )
}

const W = 27
const H = 9
const CX = 13
const CY = 4
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1]
]
const VIRUS = ['#', '%', '&', '@', '$', '*', '!', '?', '/', '\\', ';', '=']

type SkullKey = 'idle' | 'thinking' | 'talking' | 'laughing' | 'happy' | 'sad' | 'angry'

const SKULL: Record<SkullKey, { speed: number; decay: number; noise: number; reach: number; flex: number; net: string; core: string; virus: string; label: string; cores: string[] }> = {
  idle: { speed: 260, decay: 0.18, noise: 0.015, reach: 2, flex: 0.7, net: '#5b21b6', core: '#22d3ee', virus: '#a855f7', label: 'dormant', cores: ['╬', '╫', '╬', '╪'] },
  talking: { speed: 110, decay: 0.32, noise: 0.05, reach: 4, flex: 1.6, net: '#155e75', core: '#ff2fb3', virus: '#22d3ee', label: 'streaming', cores: ['╬', '╋', '╬', '╈'] },
  thinking: { speed: 170, decay: 0.22, noise: 0.03, reach: 3, flex: 1.2, net: '#1e3a8a', core: '#22d3ee', virus: '#818cf8', label: 'processing', cores: ['◐', '◓', '◑', '◒'] },
  laughing: { speed: 75, decay: 0.28, noise: 0.12, reach: 5, flex: 2.4, net: '#713f12', core: '#facc15', virus: '#fb923c', label: 'overclock', cores: ['✶', '✷', '✸', '✹'] },
  happy: { speed: 150, decay: 0.15, noise: 0.02, reach: 4, flex: 1, net: '#14532d', core: '#4ade80', virus: '#22d3ee', label: 'stable', cores: ['◆', '◇', '◆', '◈'] },
  sad: { speed: 420, decay: 0.38, noise: 0.01, reach: 1, flex: 0.4, net: '#1e293b', core: '#60a5fa', virus: '#334155', label: 'degraded', cores: ['·', '∙', '·', '•'] },
  angry: { speed: 70, decay: 0.52, noise: 0.3, reach: 6, flex: 2.2, net: '#7f1d1d', core: '#ff1e3c', virus: '#ff8a00', label: 'blackwall breach', cores: ['╳', '╬', '╪', '╳'] }
}

function skullKey(state: AvatarState): SkullKey {
  if (state === 'error' || state === 'angry') return 'angry'
  return state
}

const rnd = (x: number, y: number, t: number) => {
  const s = Math.sin(x * 12.9898 + y * 78.233 + t * 0.317) * 43758.5453
  return s - Math.floor(s)
}

interface Cell {
  ch: string
  level: 0 | 1 | 2 | 3
}

function buildGrid(key: SkullKey, tick: number): Cell[][] {
  const cfg = SKULL[key]
  const grid: Cell[][] = []
  for (let y = 0; y < H; y++) {
    const row: Cell[] = []
    for (let x = 0; x < W; x++) {
      let ch = y % 2 === 0 ? (x % 4 === 0 ? '┼' : '─') : x % 4 === 0 ? '│' : ' '
      let level: Cell['level'] = 0
      if (rnd(x, y, Math.floor(tick / 3)) < cfg.decay) ch = ' '
      const v = rnd(y * 3, x * 5, tick)
      if (v > 1 - cfg.noise) {
        ch = VIRUS[Math.floor(v * 997) % VIRUS.length]
        level = 1
      }
      row.push({ ch, level })
    }
    grid.push(row)
  }
  DIRS.forEach(([dx, dy], di) => {
    const len = Math.max(1, Math.round(cfg.reach + Math.sin(tick * 0.3 + di * 0.8) * cfg.flex))
    const packet = key === 'idle' ? -1 : (tick + di * 2) % (len + 4)
    for (let i = 1; i <= len; i++) {
      const x = dy === 0 ? CX + dx * i * 2 : CX + dx * i
      const y = CY + dy * i
      if (x < 0 || x >= W || y < 0 || y >= H) break
      const ch = dx && dy ? (dx * dy > 0 ? '╲' : '╱') : dy === 0 ? '━' : '┃'
      grid[y][x] = { ch, level: i === packet ? 3 : 2 }
    }
  })
  grid[CY][CX] = { ch: cfg.cores[tick % cfg.cores.length], level: 3 }
  grid[CY][CX - 1] = { ch: '═', level: 2 }
  grid[CY][CX + 1] = { ch: '═', level: 2 }
  return grid
}

function paint(level: Cell['level'], cfg: (typeof SKULL)[SkullKey]): CSSProperties {
  if (level === 0) return { color: cfg.net, opacity: 0.75 }
  if (level === 1) return { color: cfg.virus, opacity: 0.9 }
  if (level === 2) return { color: cfg.core, opacity: 0.85, textShadow: `0 0 8px ${cfg.core}88` }
  return { color: '#ffffff', textShadow: `0 0 10px ${cfg.core}, 0 0 22px ${cfg.core}aa` }
}

export function GlitchSkull({ state, detail }: { state: AvatarState; detail: boolean }) {
  const key = skullKey(state)
  const cfg = SKULL[key]
  const [frame, setFrame] = useState({ tick: 0, tearRow: -1, tearShift: 0 })
  useEffect(() => {
    setFrame((f) => ({ ...f, tearRow: -1, tearShift: 0 }))
    const timer = setInterval(() => {
      const violent = key === 'angry'
      const tearing = violent ? Math.random() < 0.75 : Math.random() < 0.18
      const magnitude = violent ? 14 : 5
      setFrame((f) => ({ tick: f.tick + 1, tearRow: tearing ? Math.floor(Math.random() * H) : -1, tearShift: tearing ? Math.random() * magnitude * 2 - magnitude : 0 }))
    }, cfg.speed)
    return () => clearInterval(timer)
  }, [key, cfg.speed])
  const grid = buildGrid(key, frame.tick)
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: `radial-gradient(70% 80% at 50% 50%, ${cfg.net}22 0%, #04030a 70%)`, boxShadow: `inset 0 0 20px #000` }}
    >
      <div className="pointer-events-none absolute inset-0 z-10" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, rgba(0,0,0,0.45) 0px, rgba(0,0,0,0.45) 1px, transparent 1px, transparent 3px)' }} />
      <Fit>
        <div className="px-2 py-1.5 font-mono select-none">
          <pre className="m-0 whitespace-pre text-base leading-tight" style={{ letterSpacing: '0.05em' }}>
            {grid.map((row, y) => {
              const runs: { level: Cell['level']; text: string }[] = []
              for (const cell of row) {
                const last = runs.at(-1)
                if (last && last.level === cell.level) last.text += cell.ch
                else runs.push({ level: cell.level, text: cell.ch })
              }
              return (
                <div key={y} style={y === frame.tearRow ? { transform: `translateX(${frame.tearShift}px)` } : undefined}>
                  {runs.map((run, i) => (
                    <span key={i} style={paint(run.level, cfg)}>
                      {run.text}
                    </span>
                  ))}
                </div>
              )
            })}
          </pre>
          {detail && (
            <div className="mt-2 flex items-baseline justify-between text-[10px]" style={{ color: `${cfg.net}dd` }}>
              <span>daemon.7f</span>
              <span style={{ color: cfg.core }}>{cfg.label}</span>
            </div>
          )}
        </div>
      </Fit>
    </div>
  )
}

interface HdEffect {
  type: 'pulse' | 'shake' | 'glow'
  speed?: number
  intensity?: number
  color?: string
  blur?: string
}

interface HdLayer {
  id: string
  color: string
  frames: string[]
  effects: HdEffect[]
}

interface HdState {
  fps: number
  layers: HdLayer[]
}

const ACCENT = 'var(--color-accent)'

const SKULL_BASE = (eyes: string, mouth: string) => `  .---.  \n / ${eyes} \\ \n |( )  | \n \\ ${mouth} / \n  '-'    `

const HD: Record<SkullKey, HdState> = {
  idle: {
    fps: 4,
    layers: [{ id: 'base', color: ACCENT, frames: [...Array(9).fill(SKULL_BASE('_ _', ' = ')), SKULL_BASE('- -', ' = ')], effects: [] }]
  },
  thinking: {
    fps: 3,
    layers: [{ id: 'base', color: ACCENT, frames: [SKULL_BASE('° °', '.  '), SKULL_BASE('° °', '.. '), SKULL_BASE('° °', '...')], effects: [{ type: 'pulse', speed: 1.5 }] }]
  },
  talking: {
    fps: 10,
    layers: [{ id: 'base', color: ACCENT, frames: [SKULL_BASE('_ _', ' O '), SKULL_BASE('_ _', '===')], effects: [] }]
  },
  laughing: {
    fps: 8,
    layers: [{ id: 'base', color: '#facc15', frames: [SKULL_BASE('^ ^', '\\▽/'), SKULL_BASE('> <', '\\▽/')], effects: [{ type: 'shake', intensity: 3 }] }]
  },
  happy: {
    fps: 2,
    layers: [{ id: 'base', color: '#4ade80', frames: [SKULL_BASE('^ ^', ' ‿ '), SKULL_BASE('^ ^', ' ▽ ')], effects: [{ type: 'glow', color: '#4ade80', blur: '12px' }] }]
  },
  sad: {
    fps: 1,
    layers: [{ id: 'base', color: '#7aa2ff', frames: [SKULL_BASE('╥ ╥', ' ~ '), SKULL_BASE('╥ ╥', ' _ ')], effects: [{ type: 'pulse', speed: 0.6 }] }]
  },
  angry: {
    fps: 15,
    layers: [
      { id: 'base', color: '#ff0000', frames: [SKULL_BASE('> <', '===')], effects: [{ type: 'shake', intensity: 4 }] },
      { id: 'eyes', color: '#ffaaaa', frames: ['         \n   O O   \n         \n         \n         '], effects: [{ type: 'pulse', speed: 5 }] }
    ]
  }
}

function applyEffects(node: HTMLElement, layer: HdLayer, time: number): void {
  node.style.transform = 'none'
  node.style.opacity = '1'
  node.style.textShadow = `0 0 10px ${layer.color}`
  for (const e of layer.effects) {
    if (e.type === 'pulse') node.style.opacity = String(0.2 + ((Math.sin(time * 0.005 * (e.speed ?? 1)) + 1) / 2) * 0.8)
    else if (e.type === 'shake') {
      const n = e.intensity ?? 2
      node.style.transform = `translate(${(Math.random() * n - n / 2).toFixed(1)}px, ${(Math.random() * n - n / 2).toFixed(1)}px)`
    } else if (e.type === 'glow') node.style.textShadow = `0 0 ${e.blur ?? '10px'} ${e.color ?? 'currentColor'}`
  }
}

export function AsciiHd({ state }: { state: AvatarState }) {
  const spec = HD[skullKey(state)]
  const nodes = useRef<(HTMLDivElement | null)[]>([])
  useEffect(() => {
    let raf = 0
    let last = 0
    let index = 0
    const loop = (time: number) => {
      const interval = 1000 / spec.fps
      const step = time - last >= interval
      spec.layers.forEach((layer, i) => {
        const node = nodes.current[i]
        if (!node) return
        if (step) {
          const text = layer.frames[index % layer.frames.length]
          if (node.textContent !== text) node.textContent = text
        }
        applyEffects(node, layer, time)
      })
      if (step) {
        index++
        last = time
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [spec])
  return (
    <div className="h-full w-full bg-black">
      <Fit>
        <div className="relative px-2 py-1 font-mono text-2xl font-bold leading-tight">
          <div className="invisible whitespace-pre">{spec.layers[0].frames[0]}</div>
          {spec.layers.map((layer, i) => (
            <div key={`${state}-${layer.id}`} ref={(el) => void (nodes.current[i] = el)} className="absolute inset-0 flex items-center justify-center whitespace-pre" style={{ color: layer.color }}>
              {layer.frames[0]}
            </div>
          ))}
        </div>
      </Fit>
    </div>
  )
}

export function CodedAvatar({ type, state, size }: { type: string; state: AvatarState; size: number }) {
  if (type === 'glitch_skull') return <GlitchSkull state={state} detail={size >= 96} />
  if (type === 'ascii_hd') return <AsciiHd state={state} />
  return <AsciiFace state={state} />
}
