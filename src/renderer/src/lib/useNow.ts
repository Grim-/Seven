import { useEffect, useState } from 'react'

export function useNow(every: number, running = true): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(timer)
  }, [every, running])
  return now
}
