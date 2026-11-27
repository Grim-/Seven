import type { Theme } from '@shared/theme'
import { SKIN_COLOURS, type SkinColour } from '@shared/themeLook'
import { present, registerSkinSection } from './registry'

const DERIVED: { role: SkinColour; from: SkinColour; mix: (colour: string) => string }[] = [
  { role: 'secondary-ink', from: 'secondary', mix: (c) => `color-mix(in srgb, ${c} 70%, var(--color-ink))` },
  { role: 'line', from: 'accent-soft', mix: (c) => `color-mix(in srgb, ${c} 35%, transparent)` },
  { role: 'line-strong', from: 'accent-soft', mix: (c) => `color-mix(in srgb, ${c} 60%, transparent)` }
]

function derived(colours: Theme['colours']): Record<string, string> {
  return Object.fromEntries(
    DERIVED.flatMap((d): [string, string][] => {
      const from = colours[d.from]
      return from && !colours[d.role] ? [[`--color-${d.role}`, d.mix(from)]] : []
    })
  )
}

registerSkinSection({
  vars: (theme) => ({ ...derived(theme.colours), ...present(Object.fromEntries(SKIN_COLOURS.map((k) => [`--color-${k}`, theme.colours[k]]))) }),
  read: (read) => ({
    colours: Object.fromEntries(
      SKIN_COLOURS.flatMap((k): [string, string][] => {
        const c = read.color(`--color-${k}`)
        return c ? [[k, c]] : []
      })
    )
  })
})
