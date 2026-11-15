import { useEffect } from 'react'
import { setViewPlace, useViewPlace } from './viewPlace'
import { matchesKeybind } from '../store/keybinds'

const KEY = 'chat.cinema'

export function setCinema(on: boolean): void {
  setViewPlace(KEY, on)
}

export function useCinema(): [boolean, (on: boolean) => void] {
  return useViewPlace(KEY, false)
}

export function useCinemaKey(enabled: boolean, on: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const key = (e: KeyboardEvent) => {
      if (!matchesKeybind('chat.cinema', e)) return
      e.preventDefault()
      setViewPlace(KEY, !on)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [enabled, on])
}
