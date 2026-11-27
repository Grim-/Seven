import { solid } from '../../../lib/skins/roles'
import { currentRoles } from '../../../lib/skins/useRoleColours'

export interface FramePalette {
  accent: string
  secondary: string
  base: string
  mono: string
  sans: string
}

export function readFramePalette(): FramePalette {
  const { colours, fonts } = currentRoles()
  return { accent: solid(colours.accent), secondary: solid(colours.secondary), base: solid(colours.bg), mono: fonts.mono, sans: fonts.sans }
}
