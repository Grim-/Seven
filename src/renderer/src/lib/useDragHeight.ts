import { useState, type PointerEvent } from 'react'
import { useViewPlace } from './viewPlace'

export function useDragHeight(key: string, start: number, min = 160, max = 900): { height: number; handle: { onPointerDown: (e: PointerEvent<HTMLElement>) => void } } {
  const [saved, save] = useViewPlace<number>(key, start)
  const [live, setLive] = useState<number | null>(null)
  const clamp = (h: number) => Math.round(Math.min(max, Math.max(min, h)))
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    e.preventDefault()
    const y0 = e.clientY
    const h0 = saved
    let last = h0
    const move = (ev: globalThis.PointerEvent) => {
      last = clamp(h0 - (ev.clientY - y0))
      setLive(last)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setLive(null)
      save(last)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return { height: live ?? saved, handle: { onPointerDown } }
}
