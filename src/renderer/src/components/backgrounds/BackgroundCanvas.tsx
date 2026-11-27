import { useEffect, useRef } from 'react'
import type { BackgroundColors, BackgroundSettings } from './base'
import { backgroundDrawer } from './drawers'
import { useAnimated } from '../animated/useAnimated'
import './register'

export const REACTION_EVENT = 'seven-background-reaction'

export function hasBackground(id: string): boolean {
  return Boolean(backgroundDrawer(id))
}

export function BackgroundCanvas({ id, colors, settings }: { id: string; colors: BackgroundColors; settings: BackgroundSettings }) {
  const latest = useRef({ colors, settings })
  latest.current = { colors, settings }
  const Maker = backgroundDrawer(id)
  const { canvas, live } = useAnimated(Maker ? () => new Maker(latest.current.colors, latest.current.settings) : null, id, 150)

  useEffect(() => {
    const react = (e: Event) => live.current?.react(String((e as CustomEvent<string>).detail))
    window.addEventListener(REACTION_EVENT, react)
    return () => window.removeEventListener(REACTION_EVENT, react)
  }, [live])

  const colorKey = `${colors.accent}${colors.secondary}${colors.base}${colors.ink}${colors.surface}`
  useEffect(() => live.current?.setColors(latest.current.colors), [colorKey, live])
  const settingsKey = JSON.stringify(settings)
  useEffect(() => live.current?.setSettings(latest.current.settings), [settingsKey, live])

  return <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
}
