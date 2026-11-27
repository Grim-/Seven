import { useRef } from 'react'
import type { MoodLight } from '@shared/theme'
import { lightFill } from '../../lib/gradients'

export function MoodGlow({ light }: { light: MoodLight | null }) {
  const last = useRef(light)
  if (light) last.current = light
  const shown = last.current
  if (!shown) return null
  return (
    <div className="absolute inset-0 transition-opacity duration-[2000ms]" style={{ opacity: light ? light.strength : 0, animation: 'reveal-fade 2s ease-out both' }}>
      <div className="absolute inset-0" style={{ background: lightFill(shown.colors) }} />
    </div>
  )
}
