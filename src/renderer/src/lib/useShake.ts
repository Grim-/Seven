import { useEffect, type RefObject } from 'react'

const SHAKE: Keyframe[] = [
  { transform: 'translate(0, 0)' },
  { transform: 'translate(-7px, 3px)' },
  { transform: 'translate(6px, -4px)' },
  { transform: 'translate(-4px, 2px)' },
  { transform: 'translate(3px, -1px)' },
  { transform: 'translate(0, 0)' }
]

export function useShake(ref: RefObject<HTMLElement | null>, on: boolean): void {
  useEffect(() => {
    if (!on || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    ref.current?.parentElement?.animate(SHAKE, { duration: 450, easing: 'ease-out' })
  }, [ref, on])
}
