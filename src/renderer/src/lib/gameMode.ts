import { useEffect } from 'react'
import { useApp } from '../store/app'
import { matchesKeybind } from '../store/keybinds'

export function useGameModeKey(): void {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!matchesKeybind('app.playMode', e)) return
      e.preventDefault()
      const current = useApp.getState().view
      useApp.getState().setView(current === 'play' ? 'chat' : 'play')
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
}
