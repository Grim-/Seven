import { useEffect, useState, type CSSProperties } from 'react'
import { skyPhase, type SkyPhase, type Theme } from '@shared/theme'
import { DEFAULT_SKIES, SKY_PHASES } from '@shared/themeLook'
import { on } from '../../lib/ipc'
import { useApp } from '../../store/app'
import { useActiveTheme, useThemes } from '../../store/themes'
import { BackdropLayer, GradientLayer } from '../backdrop/Backdrop'
import { lightFill, stopsFill } from '../../lib/gradients'
import { AmbientBackground } from './AmbientBackground'
import { playSound } from './Audio'
import { BackgroundCanvas, REACTION_EVENT, hasBackground } from '../backgrounds/BackgroundCanvas'
import { BACKGROUND_MODULE, backgroundInfo, effectSettingsFor } from '@shared/backgrounds'
import { useTools } from '../../store/tools'
import { useApplyLook } from '../../lib/skins/useApplyLook'
import { getKeybind, matchesKeybind } from '../../store/keybinds'
import { toast } from '../../store/toasts'

type Cue = { sound: string | null; flash: string | null; shake: boolean; reaction?: string | null }

const STARS = Array.from({ length: 28 }, (_, i) => {
  const x = (i * 37.3) % 100
  const y = (i * 23.7) % 62
  const size = i % 5 === 0 ? 2 : 1
  return `radial-gradient(${size}px ${size}px at ${x.toFixed(1)}% ${y.toFixed(1)}%, rgba(255,255,255,${i % 3 === 0 ? 0.8 : 0.45}) 50%, transparent 51%)`
}).join(', ')

const SKY_PLACES: Record<SkyPhase, { at: CSSProperties; moon?: boolean }> = {
  dawn: { at: { left: '18%', top: '86%' } },
  day: { at: { left: '74%', top: '14%' } },
  dusk: { at: { left: '82%', top: '84%' } },
  night: { at: { left: '22%', top: '16%' }, moon: true }
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

function Sky({ phase, theme }: { phase: SkyPhase | null; theme: Theme }) {
  return (
    <>
      {SKY_PHASES.map((p) => {
        const s = { ...SKY_PLACES[p], orb: (theme.skies?.[p] ?? DEFAULT_SKIES[p]).orb }
        return (
          <div key={p} className="absolute inset-0 transition-opacity duration-[4000ms] ease-in-out" style={{ opacity: phase === p ? 0.9 : 0 }}>
            {s.moon && <div className="absolute inset-0" style={{ backgroundImage: STARS, opacity: 0.7 }} />}
            <div className="absolute" style={{ ...s.at, ...orbStyle(s.orb, Boolean(s.moon)) }} />
          </div>
        )
      })}
    </>
  )
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

  const palette = useThemes((s) => s.palette)
  useApplyLook(theme)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!matchesKeybind('app.plainLook', e)) return
      e.preventDefault()
      if (useThemes.getState().switching) return
      const next = !useThemes.getState().plain
      useThemes.setState({ plain: next })
      toast.info(next ? 'Showing the Seven theme' : 'Your theme is back', `${getKeybind('app.plainLook').display} switches it back`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
      <div key={theme.id} className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {backdrop && <BackdropLayer key={JSON.stringify(backdrop)} backdrop={backdrop} />}
        {animated && (
          <BackgroundCanvas
            id={animated.id}
            colors={palette}
            settings={effectSettingsFor(animated, theme.effect === animated.id ? theme.effectSettings : {})}
          />
        )}
        <Sky phase={phase} theme={theme} />
        {theme.gradient && <GradientLayer fill={stopsFill(theme.gradient.stops, theme.gradient.angle)} />}
        {light && (
          <div className="absolute inset-0 transition-opacity duration-[2000ms]" style={{ opacity: light.strength }}>
            <div key={JSON.stringify(light.stops)} className="absolute inset-0" style={{ background: lightFill(light.stops), animation: 'reveal-fade 2s ease-out both' }} />
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
