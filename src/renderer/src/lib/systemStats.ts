import { useEffect, useState } from 'react'
import type { SystemStats } from '@shared/types'
import { engine } from './ipc'

export function useSystemStats(every = 3000): SystemStats | null {
  const [stats, setStats] = useState<SystemStats | null>(null)
  useEffect(() => {
    let live = true
    const tick = () =>
      void engine('system.stats')
        .then((s) => live && setStats(s))
        .catch(() => undefined)
    tick()
    const timer = setInterval(tick, every)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [every])
  return stats
}

export function gigabytes(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1)
}
