import { useEffect, useState } from 'react'

export function useStepper(count: number, start: number, seconds: number | null, playing: boolean): { index: number; step: (by: number) => void } {
  const [index, setIndex] = useState(start)
  const step = (by: number) => setIndex((i) => (count ? (i + by + count) % count : 0))
  useEffect(() => {
    if (index >= count) setIndex(0)
  }, [count, index])
  useEffect(() => {
    if (!playing || count < 2 || seconds === null || !(seconds > 0)) return
    const timer = window.setTimeout(() => step(1), seconds * 1000)
    return () => window.clearTimeout(timer)
  }, [playing, index, seconds, count])
  return { index: Math.min(index, Math.max(0, count - 1)), step }
}
