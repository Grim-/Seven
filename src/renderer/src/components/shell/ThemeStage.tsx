import { useEffect, useState, type CSSProperties } from 'react'
import { SEVEN_THEME, skyPhase, type SkyPhase, type Theme } from '@shared/theme'
import { on } from '../../lib/ipc'
import { useApp } from '../../store/app'
import { useActiveTheme } from '../../store/themes'
import { BackdropLayer } from '../backdrop/Backdrop'
import { AmbientBackground } from './AmbientBackground'
import { playSound } from './Audio'
import { BackgroundCanvas, REACTION_EVENT, hasBackground } from '../backgrounds/BackgroundCanvas'
import { BACKGROUND_MODULE, backgroundInfo, effectSettingsFor } from '@shared/backgrounds'
import { useTools } from '../../store/tools'

type Cue = { sound: string | null; flash: string | null; shake: boolean; reaction?: string | null }

const PHASES: SkyPhase[] = ['dawn', 'day', 'dusk', 'night']

const STARS = Array.from({ length: 28 }, (_, i) => {
  const x = (i * 37.3) % 100
  const y = (i * 23.7) % 62
  const size = i % 5 === 0 ? 2 : 1
  return `radial-gradient(${size}px ${size}px at ${x.toFixed(1)}% ${y.toFixed(1)}%, rgba(255,255,255,${i % 3 === 0 ? 0.8 : 0.45}) 50%, transparent 51%)`
}).join(', ')

const SKIES: Record<SkyPhase, { sky: string; orb: string; at: CSSProperties; moon?: boolean }> = {
  dawn: {
    sky: 'linear-gradient(to top, #4a2234 0%, #2a1a3a 32%, #121428 66%, transparent 100%)',
    orb: '#ffb27a',
    at: { left: '18%', top: '86%' }
  },
  day: {
    sky: 'linear-gradient(to top, #12324d 0%, #0d2236 42%, #0a1522 76%, transparent 100%)',
    orb: '#fff1c9',
    at: { left: '74%', top: '14%' }
  },
  dusk: {
    sky: 'linear-gradient(to top, #5a2414 0%, #3a1622 32%, #1a1026 66%, transparent 100%)',
    orb: '#ff7a3d',
    at: { left: '82%', top: '84%' }
  },
  night: {
    sky: 'linear-gradient(to top, #0b1430 0%, #080d1f 46%, transparent 100%)',
    orb: '#d6defa',
    at: { left: '22%', top: '16%' },
    moon: true
  }
}

function orbStyle(color: string, moon: boolean): CSSProperties {
  const glow = moon ? 0.25 : 0.4
  return {
    width: 'min(30vmin, 280px)',
    height: 'min(30vmin, 280px)',
    transform: 'translate(-50%, -50%)',
    background: `radial-gradient(circle, ${color} 0%, ${color} 16%, color-mix(in srgb, ${color} ${Math.round(glow * 100)}%, transparent) 20%, transparent 62%)`
  }
}

function useMinute(): Date {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

function Sky({ phase }: { phase: SkyPhase | null }) {
  return (
    <>
      {PHASES.map((p) => {
        const s = SKIES[p]
        return (
          <div key={p} className="absolute inset-0 transition-opacity duration-[4000ms] ease-in-out" style={{ opacity: phase === p ? 0.9 : 0 }}>
            <div className="absolute inset-0" style={{ background: s.sky }} />
            {s.moon && <div className="absolute inset-0" style={{ backgroundImage: STARS, opacity: 0.7 }} />}
            <div className="absolute" style={{ ...s.at, ...orbStyle(s.orb, Boolean(s.moon)) }} />
          </div>
        )
      })}
    </>
  )
}

function palette(theme: Theme): void {
  const root = document.documentElement.style
  const keys = ['--color-accent', '--color-accent-soft', '--color-teal', '--color-cyan', '--color-bg', '--color-line', '--color-line-strong']
  if (theme.builtin) {
    for (const k of keys) root.removeProperty(k)
    return
  }
  root.setProperty('--color-accent', theme.accent)
  root.setProperty('--color-accent-soft', theme.accentSoft)
  root.setProperty('--color-teal', theme.secondary)
  root.setProperty('--color-cyan', `color-mix(in srgb, ${theme.secondary} 70%, white)`)
  root.setProperty('--color-bg', theme.base)
  root.setProperty('--color-line', `color-mix(in srgb, ${theme.accentSoft} 35%, transparent)`)
  root.setProperty('--color-line-strong', `color-mix(in srgb, ${theme.accentSoft} 60%, transparent)`)
}

function shakeMain(): void {
  const main = document.querySelector('main')
  if (!main) return
  main.classList.remove('seven-shake')
  void (main as HTMLElement).offsetWidth
  main.classList.add('seven-shake')
}

export function runCue(cue: Cue): void {
  window.dispatchEvent(new CustomEvent('seven-cue', { detail: cue }))
}

export function ThemeStage() {
  const { theme, ambience, sessionId } = useActiveTheme()
  const appBackdrop = useApp((s) => s.settings?.backdrop ?? null)
  const effects = useApp((s) => s.settings?.ambientBackground ?? true)
  const now = useMinute()
  const [flash, setFlash] = useState<{ color: string; n: number } | null>(null)

  useEffect(() => palette(theme), [theme])
  useEffect(() => () => palette(SEVEN_THEME), [])

  useEffect(() => {
    const local = (e: Event) => {
      const cue = (e as CustomEvent<Cue>).detail
      if (cue.sound) playSound(cue.sound)
      if (cue.flash) setFlash({ color: cue.flash, n: Date.now() })
      if (cue.shake) shakeMain()
      if (cue.reaction) window.dispatchEvent(new CustomEvent(REACTION_EVENT, { detail: cue.reaction }))
    }
    window.addEventListener('seven-cue', local)
    return () => window.removeEventListener('seven-cue', local)
  }, [])

  useEffect(
    () =>
      on('ambience.cue', (cue) => {
        if (cue.sessionId !== sessionId) return
        if (cue.sound) playSound(cue.sound)
        if (cue.flash) setFlash({ color: cue.flash, n: Date.now() })
        if (cue.shake) shakeMain()
        if (cue.reaction) window.dispatchEvent(new CustomEvent(REACTION_EVENT, { detail: cue.reaction }))
      }),
    [sessionId]
  )

  const phase = skyPhase(ambience.sky ?? theme.sky, now)
  const light = ambience.light ?? theme.light
  const backdrop = theme.backdrop ?? (theme.builtin ? appBackdrop : null)
  const backgroundsOn = useTools((s) => s.list.some((m) => m.id === BACKGROUND_MODULE && m.state === 'on'))
  const effect = ambience.background ?? theme.effect
  const info = backgroundInfo(effect)
  const animated = effects && !backdrop && backgroundsOn && info && hasBackground(info.id) ? info : null

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <Sky phase={phase} />
        {backdrop && <BackdropLayer key={JSON.stringify(backdrop)} backdrop={backdrop} />}
        {animated && (
          <BackgroundCanvas
            id={animated.id}
            colors={{ accent: theme.accent, secondary: theme.secondary, base: theme.base }}
            settings={effectSettingsFor(animated, theme.effect === animated.id ? theme.effectSettings : {})}
          />
        )}
        {light && (
          <div className="absolute inset-0 transition-opacity duration-[2000ms]" style={{ opacity: light.strength }}>
            <div key={light.color} className="absolute inset-0" style={{ background: `radial-gradient(ellipse 120% 90% at 50% 100%, ${light.color} 0%, transparent 70%)`, animation: 'reveal-fade 2s ease-out both' }} />
          </div>
        )}
      </div>
      {effects && effect === 'feed' && !backdrop && <AmbientBackground />}
      {flash && (
        <div
          key={flash.n}
          className="pointer-events-none fixed inset-0 z-[60]"
          style={{ background: flash.color, animation: 'seven-flash 0.9s ease-out forwards' }}
          onAnimationEnd={() => setFlash(null)}
        />
      )}
    </>
  )
}
