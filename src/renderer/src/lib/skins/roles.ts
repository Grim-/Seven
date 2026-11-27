import { ROLE_COLOURS, ROLE_FONTS, type RoleColour, type RoleFont } from '@shared/roles'
import { hexText, withColorReader } from '../cssColors'

export interface Roles {
  colours: Record<RoleColour, string>
  fonts: Record<RoleFont, string>
  label: { case: string; tracking: string; variant: string }
}

export function readRoles(): Roles {
  const style = getComputedStyle(document.documentElement)
  const prop = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  const colours = withColorReader((read) => Object.fromEntries(ROLE_COLOURS.map((r) => [r, hexText(read(`var(--color-${r})`) ?? [0, 0, 0, 1])]))) as Record<RoleColour, string>
  const fonts = Object.fromEntries(ROLE_FONTS.map((f) => [f, prop(`--font-${f}`, 'sans-serif')])) as Record<RoleFont, string>
  return { colours, fonts, label: { case: prop('--label-case', 'none'), tracking: prop('--label-tracking', 'normal'), variant: prop('--label-variant', 'normal') } }
}

export function solid(hex: string): string {
  return hex.slice(0, 7)
}
