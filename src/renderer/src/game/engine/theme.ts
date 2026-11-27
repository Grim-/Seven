import { rgba } from '../../lib/cssColors'
import type { Roles } from '../../lib/skins/roles'
import { currentRoles } from '../../lib/skins/useRoleColours'

export interface GameTheme {
  bg: string
  card: string
  surface: string
  well: string
  line: string
  accent: string
  secondary: string
  cyan: string
  purple: string
  alert: string
  ok: string
  text: string
  dim: string
  font: string
}

export function themeColour(theme: GameTheme, name: string | null, fallback: string): string {
  if (!name || name === 'font' || !(name in theme)) return fallback
  return theme[name as keyof GameTheme]
}

export function gameTheme({ colours: c, fonts }: Roles): GameTheme {
  const solid = (hex: string) => rgba(hex, 1)
  return {
    bg: solid(c.bg),
    card: solid(c.card),
    surface: solid(c.surface),
    well: solid(c.well),
    line: solid(c.line),
    accent: solid(c.accent),
    secondary: solid(c.secondary),
    cyan: solid(c.cyan),
    purple: solid(c.purple),
    alert: solid(c.alert),
    ok: solid(c.ok),
    text: solid(c.ink),
    dim: solid(c.dim),
    font: fonts.sans
  }
}

export function readTheme(): GameTheme {
  return gameTheme(currentRoles())
}
