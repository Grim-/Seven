import type { Theme } from '@shared/theme'
import type { SkinColour } from '@shared/themeLook'

export function mainColour(theme: Theme, role: SkinColour): string {
  return theme.colours[role] ?? `var(--color-${role})`
}
