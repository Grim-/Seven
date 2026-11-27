export interface Named<T extends string> {
  id: T
  label: string
}

export const SKIN_COLOURS = ['bg', 'sidebar', 'card', 'card-hover', 'panel', 'surface', 'well', 'scrim', 'shade', 'ink', 'dim', 'faint', 'line', 'line-strong', 'line-hover', 'accent', 'accent-soft', 'accent-dark', 'on-accent', 'secondary', 'secondary-ink', 'alert', 'warn', 'ok'] as const
export type SkinColour = (typeof SKIN_COLOURS)[number]

export const COLOUR_NAMES: Named<SkinColour>[] = [
  { id: 'bg', label: 'Ground' },
  { id: 'sidebar', label: 'Sidebar' },
  { id: 'card', label: 'Card' },
  { id: 'card-hover', label: 'Card hover' },
  { id: 'panel', label: 'Panel' },
  { id: 'surface', label: 'Surface' },
  { id: 'well', label: 'Field' },
  { id: 'scrim', label: 'Dimming' },
  { id: 'shade', label: 'Shadow' },
  { id: 'ink', label: 'Text' },
  { id: 'dim', label: 'Dim text' },
  { id: 'faint', label: 'Faint text' },
  { id: 'line', label: 'Line' },
  { id: 'line-strong', label: 'Strong line' },
  { id: 'line-hover', label: 'Hover line' },
  { id: 'accent', label: 'Accent' },
  { id: 'accent-soft', label: 'Soft accent' },
  { id: 'accent-dark', label: 'Dark accent' },
  { id: 'on-accent', label: 'Text on accent' },
  { id: 'secondary', label: 'Secondary' },
  { id: 'secondary-ink', label: 'Secondary text' },
  { id: 'alert', label: 'Alert' },
  { id: 'warn', label: 'Warning' },
  { id: 'ok', label: 'OK' }
]

export const SKIN_TINTS = ['cyan', 'teal', 'purple', 'purple-ink', 'red', 'red-ink', 'amber', 'amber-ink', 'green', 'green-ink', 'sky', 'sky-ink', 'yellow', 'yellow-ink', 'orange'] as const
export type SkinTint = (typeof SKIN_TINTS)[number]

export const TINT_NAMES: Named<SkinTint>[] = [
  { id: 'cyan', label: 'Cyan' },
  { id: 'teal', label: 'Teal' },
  { id: 'purple', label: 'Purple' },
  { id: 'purple-ink', label: 'Purple text' },
  { id: 'red', label: 'Red' },
  { id: 'red-ink', label: 'Red text' },
  { id: 'amber', label: 'Amber' },
  { id: 'amber-ink', label: 'Amber text' },
  { id: 'green', label: 'Green' },
  { id: 'green-ink', label: 'Green text' },
  { id: 'sky', label: 'Sky' },
  { id: 'sky-ink', label: 'Sky text' },
  { id: 'yellow', label: 'Yellow' },
  { id: 'yellow-ink', label: 'Yellow text' },
  { id: 'orange', label: 'Orange (commands)' }
]

export const FONT_ROLES = ['ui', 'label', 'heading', 'body', 'data'] as const
export type FontRole = (typeof FONT_ROLES)[number]

export const FONT_NAMES: Named<FontRole>[] = [
  { id: 'ui', label: 'Controls' },
  { id: 'label', label: 'Labels' },
  { id: 'heading', label: 'Headings' },
  { id: 'body', label: 'Reading' },
  { id: 'data', label: 'Numbers' }
]

export const TYPE_ROLES = ['eyebrow', 'label', 'title', 'heading'] as const
export type TypeRole = (typeof TYPE_ROLES)[number]

export const TYPE_NAMES: Named<TypeRole>[] = [
  { id: 'eyebrow', label: 'Eyebrow' },
  { id: 'label', label: 'Field label' },
  { id: 'title', label: 'Panel title' },
  { id: 'heading', label: 'View heading' }
]

export const TYPE_FONTS = ['inherit', ...FONT_ROLES] as const
export type TypeFont = (typeof TYPE_FONTS)[number]

export const TYPE_FONT_NAMES: Named<TypeFont>[] = [{ id: 'inherit', label: 'Inherited' }, ...FONT_NAMES]

export const TYPE_CASES = ['none', 'uppercase', 'lowercase', 'capitalize'] as const
export type TypeCase = (typeof TYPE_CASES)[number]

export const CASE_NAMES: Named<TypeCase>[] = [
  { id: 'none', label: 'As written' },
  { id: 'uppercase', label: 'UPPER' },
  { id: 'lowercase', label: 'lower' },
  { id: 'capitalize', label: 'Title' }
]

export const TYPE_VARIANTS = ['normal', 'small-caps', 'all-small-caps'] as const
export type TypeVariant = (typeof TYPE_VARIANTS)[number]

export const VARIANT_NAMES: Named<TypeVariant>[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'small-caps', label: 'Small caps' },
  { id: 'all-small-caps', label: 'All small caps' }
]

export const NUMERALS = ['normal', 'tabular-nums', 'oldstyle-nums', 'lining-nums'] as const
export type Numerals = (typeof NUMERALS)[number]

export const NUMERAL_NAMES: Named<Numerals>[] = [
  { id: 'normal', label: 'Default' },
  { id: 'tabular-nums', label: 'Even width' },
  { id: 'oldstyle-nums', label: 'Old style' },
  { id: 'lining-nums', label: 'Lining' }
]

export const SKIN_SCHEMES = ['dark', 'light'] as const
export type SkinScheme = (typeof SKIN_SCHEMES)[number]

export const SCHEME_NAMES: Named<SkinScheme>[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' }
]

export interface Bounds {
  min: number
  max: number
}

export const TYPE_BOUNDS = {
  size: { min: 7, max: 48 },
  weight: { min: 100, max: 900 },
  tracking: { min: -0.1, max: 0.5 }
} satisfies Record<string, Bounds>

export const SHAPE_BOUNDS = {
  notch: { min: 0, max: 32 },
  notchSm: { min: 0, max: 24 },
  radiusPanel: { min: 0, max: 32 },
  radiusControl: { min: 0, max: 24 },
  blur: { min: 0, max: 32 },
  glow: { min: 0, max: 2 },
  solidity: { min: 0, max: 1 }
} satisfies Record<string, Bounds>

export const SHADOW_BOUNDS = {
  y: { min: 0, max: 60 },
  blur: { min: 0, max: 120 },
  inset: { min: 0, max: 60 },
  strength: { min: 0, max: 1 }
} satisfies Record<string, Bounds>

export const FRAME_BOUNDS = {
  slice: { min: 0, max: 400 },
  width: { min: 0, max: 96 }
} satisfies Record<string, Bounds>

export const LETTERING_BOUNDS = {
  capsSpacing: { min: 0, max: 2 },
  sizeAdjust: { min: 0.3, max: 0.8 }
} satisfies Record<string, Bounds>

export const ORNAMENT_BOUNDS = {
  scanlines: { min: 0, max: 1 },
  vignette: { min: 0, max: 1 }
} satisfies Record<string, Bounds>

export const HEADING_MARK = /^[^"'\\\n\r]{0,4}$/
