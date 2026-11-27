import { solid, type Roles } from './roles'

export interface Palette {
  accent: string
  secondary: string
  base: string
  ink: string
  surface: string
}

export const SEVEN_PALETTE: Palette = { accent: '#ffc919', secondary: '#00e5ff', base: '#090a0d', ink: '#ffffff', surface: '#090a0d' }

export function paletteOf({ colours }: Roles): Palette {
  return { accent: solid(colours.accent), secondary: solid(colours.secondary), base: solid(colours.bg), ink: solid(colours.ink), surface: solid(colours.surface) }
}
