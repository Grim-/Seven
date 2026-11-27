import { useEffect, useRef, useState } from 'react'
import { Lock, Settings as SettingsIcon } from 'lucide-react'
import { DecodeText } from '../ui'
import { useApp } from '../../store/app'
import { PassphraseForm, useLocked } from './Vault'
import { cn } from '../../lib/cn'
import { useRoleColours } from '../../lib/skins/useRoleColours'
import { skinSurface } from '../skins/skinSurface'

const GLYPHS = '0123456789<>{}[]/\\|@#$%&*+=?ABCDEF'
const CELL = 16
const FPS = 12

function GlyphField() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const { colours, fonts } = useRoleColours()
  const accent = colours.accent
  const mono = fonts.mono
  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    let cols = 0
    let rows = 0
    let grid: { ch: string; a: number }[] = []
    const size = () => {
      const r = el.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      el.width = Math.max(1, Math.floor(r.width * dpr))
      el.height = Math.max(1, Math.floor(r.height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.ceil(r.width / CELL)
      rows = Math.ceil(r.height / CELL)
      grid = Array.from({ length: cols * rows }, () => ({ ch: GLYPHS[Math.floor(Math.random() * GLYPHS.length)], a: Math.random() < 0.18 ? Math.random() * 0.35 : 0 }))
    }
    size()
    const observer = new ResizeObserver(size)
    observer.observe(el)
    let raf = 0
    let last = 0
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw)
      if (t - last < 1000 / FPS) return
      last = t
      const w = el.width
      const h = el.height
      ctx.clearRect(0, 0, w, h)
      ctx.font = `12px ${mono}`
      ctx.textBaseline = 'top'
      ctx.fillStyle = accent
      const changes = Math.ceil(grid.length * 0.02)
      for (let i = 0; i < changes; i++) {
        const cell = grid[Math.floor(Math.random() * grid.length)]
        if (!cell) continue
        cell.ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        cell.a = Math.random() < 0.25 ? Math.random() * 0.4 : 0
      }
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const cell = grid[y * cols + x]
          if (!cell || cell.a <= 0.01) continue
          ctx.globalAlpha = cell.a
          ctx.fillText(cell.ch, x * CELL + 3, y * CELL + 2)
        }
      }
      ctx.globalAlpha = 1
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [accent, mono])
  return <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
}

export function LockScreen() {
  const locked = useLocked()
  const view = useApp((s) => s.view)
  const setView = useApp((s) => s.setView)
  const ready = useApp((s) => s.startup.ready)
  const bootDone = useApp((s) => s.startup.settings && (s.startup.engine || s.engine.state === 'crashed'))
  const [stage, setStage] = useState<'hidden' | 'shown' | 'decrypting' | 'leaving'>(locked && bootDone ? 'shown' : 'hidden')

  useEffect(() => {
    if (!bootDone) return
    if (locked) {
      setStage('shown')
      return
    }
    if (!ready) {
      setStage((s) => (s === 'shown' || s === 'decrypting' ? 'decrypting' : s))
      return
    }
    setStage((s) => (s === 'shown' || s === 'decrypting' ? 'leaving' : s))
    const timer = setTimeout(() => setStage('hidden'), 550)
    return () => clearTimeout(timer)
  }, [locked, ready, bootDone])

  if (stage === 'hidden' || (stage === 'shown' && view === 'settings')) return null

  return (
    <div {...skinSurface('lock-screen')} className={cn('fixed inset-x-0 bottom-0 top-10 z-[60] flex items-center justify-center overflow-hidden', stage === 'leaving' ? 'seven-decrypt pointer-events-none' : 'seven-encrypt')}>
      <div className="absolute inset-0 bg-scrim/75 backdrop-blur-[calc(var(--panel-blur)*1.5)]" />
      <GlyphField />
      <div className="scanlines pointer-events-none absolute inset-0 opacity-40" />
      <div className="notch relative z-[2] flex w-[26rem] flex-col gap-3 border border-accent/40 border-l-2 border-l-accent tone-bg-90 p-5 shadow-[0_0_40px_color-mix(in_srgb,var(--color-shade)_80%,transparent)]">
        <div className="flex items-center gap-2.5">
          <Lock className="h-5 w-5 text-accent" />
          <DecodeText
            className="font-label text-[15px] font-semibold caps-24 text-ink"
            text={stage === 'decrypting' ? 'Decrypting & loading' : stage === 'leaving' ? 'Unlocked' : 'Vault locked'}
          />
        </div>
        {stage === 'decrypting' ? (
          <p className="font-ui text-[12px] text-secondary-ink">Loading chats, pages, agents and workspace…</p>
        ) : (
          <>
            <p className="text-[13px] text-dim">Your chats, pages and agent memory are encrypted. Enter your passphrase to open them until Seven closes or you lock it.</p>
            <PassphraseForm />
            <button onClick={() => setView('settings')} className="flex items-center gap-1.5 self-start font-label text-[10.5px] caps-14 text-dim hover:text-accent">
              <SettingsIcon className="h-3.5 w-3.5" /> Vault settings
            </button>
          </>
        )}
      </div>
    </div>
  )
}
