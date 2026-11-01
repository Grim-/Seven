import { useEffect, useRef } from 'react'
import type { BackgroundColors, BackgroundSettings, BaseBackground } from './base'
import { CyberdeckBackground } from './cyberdeck'
import { NeonCityBackground } from './neonCity'
import { BlackwallBackground } from './blackwall'

const MAKERS: Record<string, new (colors: BackgroundColors, settings: BackgroundSettings) => BaseBackground> = {
  cyberdeck: CyberdeckBackground,
  'neon-city': NeonCityBackground,
  blackwall: BlackwallBackground
}

export const REACTION_EVENT = 'seven-background-reaction'

export function hasBackground(id: string): boolean {
  return id in MAKERS
}

export function BackgroundCanvas({ id, colors, settings }: { id: string; colors: BackgroundColors; settings: BackgroundSettings }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const live = useRef<BaseBackground | null>(null)
  const latest = useRef({ colors, settings })
  latest.current = { colors, settings }

  useEffect(() => {
    const canvas = ref.current
    const Maker = MAKERS[id]
    if (!canvas || !Maker) return
    const bg = new Maker(latest.current.colors, latest.current.settings)
    bg.mount(canvas)
    bg.start()
    live.current = bg
    let timer = 0
    const observer = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = window.setTimeout(() => bg.resize(canvas.clientWidth, canvas.clientHeight), 150)
    })
    observer.observe(canvas)
    const react = (e: Event) => bg.react(String((e as CustomEvent<string>).detail))
    window.addEventListener(REACTION_EVENT, react)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
      window.removeEventListener(REACTION_EVENT, react)
      bg.dispose()
      live.current = null
    }
  }, [id])

  const colorKey = `${colors.accent}${colors.secondary}${colors.base}`
  useEffect(() => live.current?.setColors(latest.current.colors), [colorKey])
  const settingsKey = JSON.stringify(settings)
  useEffect(() => live.current?.setSettings(latest.current.settings), [settingsKey])

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />
}
