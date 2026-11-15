import { useEffect, useRef } from 'react'
import type { Animated } from './Animated'

export function useAnimated<T extends Animated<unknown>>(make: (() => T) | null, key: string, resizeDelay = 0) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const live = useRef<T | null>(null)
  const maker = useRef(make)
  maker.current = make

  useEffect(() => {
    const el = canvas.current
    const build = maker.current
    if (!el || !build) return
    const a = build()
    a.mount(el)
    a.start()
    live.current = a
    let visible = true
    let timer = 0
    const resize = () => a.resize(el.clientWidth, el.clientHeight)
    const sizes = new ResizeObserver(() => {
      if (!resizeDelay) return resize()
      clearTimeout(timer)
      timer = window.setTimeout(resize, resizeDelay)
    })
    sizes.observe(el)
    const seen = new IntersectionObserver(([entry]) => {
      if (!entry || entry.isIntersecting === visible) return
      visible = entry.isIntersecting
      if (visible) a.start()
      else a.stop()
    })
    seen.observe(el)
    return () => {
      clearTimeout(timer)
      sizes.disconnect()
      seen.disconnect()
      a.dispose()
      live.current = null
    }
  }, [key, resizeDelay])

  return { canvas, live }
}
