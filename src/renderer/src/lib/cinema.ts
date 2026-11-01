import { useEffect } from 'react'
import { setViewPlace, useViewPlace } from './viewPlace'

const KEY = 'chat.cinema'

export function useCinema(): [boolean, (on: boolean) => void] {
  return useViewPlace(KEY, false)
}

export function useCinemaKey(enabled: boolean, on: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const key = (e: KeyboardEvent) => {
      if (e.code !== 'KeyF' || !(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return
      e.preventDefault()
      setViewPlace(KEY, !on)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [enabled, on])
}
