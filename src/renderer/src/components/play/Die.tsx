import { useEffect, useState } from 'react'

export function Die({ value, rolling, sides = 20 }: { value: number | null; rolling: boolean; sides?: number }) {
  const [shown, setShown] = useState(value)
  useEffect(() => {
    if (!rolling) return setShown(value)
    const t = window.setInterval(() => setShown(1 + Math.floor(Math.random() * sides)), 70)
    return () => window.clearInterval(t)
  }, [rolling, value, sides])
  return (
    <span className="play-die" data-rolling={rolling || undefined}>
      {shown ?? '?'}
    </span>
  )
}
