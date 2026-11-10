import { useEffect } from 'react'
import { useApp } from '../store/app'

export function useGameModeKey(): void {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code !== 'KeyG' || !(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return
      e.preventDefault()
      const current = useApp.getState().view
      useApp.getState().setView(current === 'play' ? 'chat' : 'play')
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
}
