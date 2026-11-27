import type { Theme, ThemeInput } from '@shared/theme'
import { hexText, withColorReader } from '../cssColors'
import { lookFor, withLook } from './look'
import { skinSections } from './sections'
import type { SkinReader } from './sections/registry'

function resolved(): ThemeInput {
  return withColorReader((color) => {
    const style = getComputedStyle(document.documentElement)
    const value = (name: string) => style.getPropertyValue(name).trim()
    const reader: SkinReader = {
      value,
      number: (name) => {
        const n = parseFloat(value(name))
        return Number.isFinite(n) ? n : undefined
      },
      color: (name) => {
        const px = value(name) ? color(`var(${name})`) : null
        return px ? hexText(px) : null
      }
    }
    return Object.assign({}, ...skinSections().map((s) => s.read?.(reader) ?? {})) as ThemeInput
  })
}

export async function resolvedLook(theme: Theme): Promise<ThemeInput> {
  return withLook(await lookFor(theme), resolved)
}
