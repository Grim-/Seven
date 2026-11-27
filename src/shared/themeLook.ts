import './skins/options/frameNotched'
import './skins/options/activeGlowBar'
import './skins/options/hoverWash'
import './skins/options/headingMark'
import './skins/options/frameDoubleRule'
import './skins/options/activeUnderline'
import './skins/options/hoverLift'
import './skins/options/headingRule'
import './skins/options/framePlain'
import './skins/surfaces/app'
import './skins/surfaces/chatInput'
import './skins/surfaces/chatLog'
import './skins/surfaces/chatMessages'
import './skins/surfaces/chatPopover'
import './skins/surfaces/messageUser'
import './skins/surfaces/messageAgent'
import './skins/surfaces/panel'
import './skins/surfaces/sidebar'
import './skins/surfaces/topBar'
import './skins/surfaces/page'
import './skins/surfaces/dialog'
import './skins/surfaces/dialogBackdrop'
import './skins/surfaces/toast'
import './skins/surfaces/approval'
import './skins/surfaces/lockScreen'
import './skins/surfaces/buttonPrimary'
import './skins/surfaces/buttonSecondary'
import './skins/surfaces/buttonDanger'
import './skins/surfaces/buttonGhost'
import './skins/surfaces/buttonBadge'
import { isAssetId } from './ids'
import type { SkyPhase } from './theme'
import { lookOption, lookSlots } from './skins/options/registry'
import { isSkinSurface } from './skins/surfaces/registry'
import { cleanSurfaceStyle, type SurfaceStyle } from './skins/surfaceStyle'
import {
  FONT_ROLES,
  FRAME_BOUNDS,
  HEADING_MARK,
  LETTERING_BOUNDS,
  NUMERALS,
  ORNAMENT_BOUNDS,
  SHADOW_BOUNDS,
  SHAPE_BOUNDS,
  SKIN_COLOURS,
  SKIN_SCHEMES,
  SKIN_TINTS,
  TYPE_BOUNDS,
  TYPE_CASES,
  TYPE_FONTS,
  TYPE_ROLES,
  TYPE_VARIANTS,
  type Bounds,
  type FontRole,
  type Numerals,
  type SkinColour,
  type SkinScheme,
  type SkinTint,
  type TypeCase,
  type TypeFont,
  type TypeRole,
  type TypeVariant
} from './skins/roles'

export * from './skins/roles'
export * from './skins/options/registry'
export * from './skins/surfaces/registry'
export * from './skins/surfaceStyle'
export * from './skins/skies'

export interface LookFont {
  family: string
  file: string | null
}

export interface LookType {
  font?: TypeFont
  size?: number
  weight?: number
  case?: TypeCase
  tracking?: number
  variant?: TypeVariant
}

export interface LookShadow {
  y: number
  blur: number
  inset: number
  strength: number
}

export interface LookShape {
  notch?: number
  notchSm?: number
  radiusPanel?: number
  radiusControl?: number
  blur?: number
  glow?: number
  solidity?: number
  shadow?: LookShadow
}

export interface LookLettering {
  capsSpacing?: number
  sizeAdjust?: number
}

export type LookSides = [number, number, number, number]

export interface LookFrame {
  image: string
  slice: LookSides
  width: LookSides
}

export interface LookImages {
  ground?: string
  surface?: string
  frame?: LookFrame
  divider?: string
}

export interface LookOrnament {
  headingMark?: string
  scanlines?: number
  vignette?: number
}

export interface LookSky {
  orb: string
}

export interface LookMotion {
  decode: boolean
  glitch: boolean
}

export interface ThemeLook {
  colours: Partial<Record<SkinColour, string>>
  tints: Partial<Record<SkinTint, string>>
  fonts: Partial<Record<FontRole, LookFont>>
  type: Partial<Record<TypeRole, LookType>>
  numerals: Numerals | null
  shape: LookShape
  lettering: LookLettering
  images: LookImages
  ornament: LookOrnament
  options: Record<string, string>
  skies: Record<SkyPhase, LookSky> | null
  motion: LookMotion
  scheme: SkinScheme | null
  surfaces: Record<string, SurfaceStyle>
}

export const LOOK_KEYS: (keyof ThemeLook)[] = ['colours', 'tints', 'fonts', 'type', 'numerals', 'shape', 'lettering', 'images', 'ornament', 'options', 'skies', 'motion', 'scheme', 'surfaces']

export const MAIN_COLOURS: SkinColour[] = ['accent', 'accent-soft', 'secondary', 'bg', 'ink', 'surface']

export const SKY_PHASES: SkyPhase[] = ['dawn', 'day', 'dusk', 'night']

export const SEVEN_LOOK: ThemeLook = {
  colours: {},
  tints: {},
  fonts: {},
  type: {},
  numerals: null,
  shape: {},
  lettering: {},
  images: {},
  ornament: {},
  options: {},
  skies: null,
  motion: { decode: true, glitch: true },
  scheme: null,
  surfaces: {}
}

const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/
const HEX6 = /^#[0-9a-fA-F]{6}$/
const FAMILY = /^[A-Za-z0-9 ,'"-]{1,200}$/

type Loose = Record<string, unknown>

function loose(value: unknown): Loose {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Loose) : {}
}

function hex(value: unknown): string | undefined {
  return typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : undefined
}

function within(value: unknown, b: Bounds): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(b.max, Math.max(b.min, value)) : undefined
}

function oneOf<T extends string>(list: readonly T[], value: unknown): T | undefined {
  return list.includes(value as T) ? (value as T) : undefined
}

function asset(value: unknown): string | undefined {
  return isAssetId(value) ? value : undefined
}

function defined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}

function keyed<K extends string, V>(keys: readonly K[], value: unknown, clean: (v: unknown) => V | undefined): Partial<Record<K, V>> {
  const v = loose(value)
  return defined(Object.fromEntries(keys.map((k) => [k, clean(v[k])])) as Partial<Record<K, V>>)
}

function font(value: unknown): LookFont | undefined {
  const v = loose(value)
  const family = typeof v.family === 'string' ? v.family.trim() : ''
  if (!FAMILY.test(family)) return undefined
  return { family, file: asset(v.file) ?? null }
}

function typeStyle(value: unknown): LookType | undefined {
  const v = loose(value)
  const out = defined<LookType>({
    font: oneOf(TYPE_FONTS, v.font),
    size: within(v.size, TYPE_BOUNDS.size),
    weight: within(v.weight, TYPE_BOUNDS.weight),
    case: oneOf(TYPE_CASES, v.case),
    tracking: within(v.tracking, TYPE_BOUNDS.tracking),
    variant: oneOf(TYPE_VARIANTS, v.variant)
  })
  if (out.weight !== undefined) out.weight = Math.round(out.weight / 100) * 100
  return Object.keys(out).length ? out : undefined
}

function shadow(value: unknown): LookShadow | undefined {
  const v = loose(value)
  const y = within(v.y, SHADOW_BOUNDS.y)
  const blur = within(v.blur, SHADOW_BOUNDS.blur)
  const inset = within(v.inset, SHADOW_BOUNDS.inset)
  const strength = within(v.strength, SHADOW_BOUNDS.strength)
  return y === undefined || blur === undefined || inset === undefined || strength === undefined ? undefined : { y, blur, inset, strength }
}

function shape(value: unknown): LookShape {
  const v = loose(value)
  return defined<LookShape>({
    notch: within(v.notch, SHAPE_BOUNDS.notch),
    notchSm: within(v.notchSm, SHAPE_BOUNDS.notchSm),
    radiusPanel: within(v.radiusPanel, SHAPE_BOUNDS.radiusPanel),
    radiusControl: within(v.radiusControl, SHAPE_BOUNDS.radiusControl),
    blur: within(v.blur, SHAPE_BOUNDS.blur),
    glow: within(v.glow, SHAPE_BOUNDS.glow),
    solidity: within(v.solidity, SHAPE_BOUNDS.solidity),
    shadow: shadow(v.shadow)
  })
}

function lettering(value: unknown): LookLettering {
  const v = loose(value)
  return defined<LookLettering>({ capsSpacing: within(v.capsSpacing, LETTERING_BOUNDS.capsSpacing), sizeAdjust: within(v.sizeAdjust, LETTERING_BOUNDS.sizeAdjust) })
}

function lookSides(value: unknown, b: Bounds, round: boolean): LookSides | undefined {
  const list = Array.isArray(value) ? value : [value]
  const n = list.slice(0, 4).map((x) => within(x, b))
  if (!n.length || n.some((x) => x === undefined)) return undefined
  const [t, r = t, bottom = t, l = r] = (round ? n.map((x) => Math.round(x!)) : n) as number[]
  return [t, r, bottom, l]
}

function frame(value: unknown): LookFrame | undefined {
  const v = loose(value)
  const image = asset(v.image)
  const slice = lookSides(v.slice, FRAME_BOUNDS.slice, true)
  const width = lookSides(v.width, FRAME_BOUNDS.width, false)
  return image && slice && width ? { image, slice, width } : undefined
}

function images(value: unknown): LookImages {
  const v = loose(value)
  return defined<LookImages>({ ground: asset(v.ground), surface: asset(v.surface), frame: frame(v.frame), divider: asset(v.divider) })
}

function ornament(value: unknown): LookOrnament {
  const v = loose(value)
  return defined<LookOrnament>({
    headingMark: typeof v.headingMark === 'string' && HEADING_MARK.test(v.headingMark) ? v.headingMark : undefined,
    scanlines: within(v.scanlines, ORNAMENT_BOUNDS.scanlines),
    vignette: within(v.vignette, ORNAMENT_BOUNDS.vignette)
  })
}

function options(value: unknown): Record<string, string> {
  const v = loose(value)
  const out: Record<string, string> = {}
  for (const slot of lookSlots()) {
    const id = v[slot]
    if (typeof id === 'string' && lookOption(slot, id)) out[slot] = id
  }
  return out
}

function sky(value: unknown): LookSky | null {
  const v = loose(value)
  return typeof v.orb === 'string' && HEX6.test(v.orb) ? { orb: v.orb.toLowerCase() } : null
}

function skies(value: unknown): Record<SkyPhase, LookSky> | null {
  const v = loose(value)
  const out = SKY_PHASES.map((p) => [p, sky(v[p])] as const)
  return out.every(([, s]) => s) ? (Object.fromEntries(out) as unknown as Record<SkyPhase, LookSky>) : null
}

function surfaces(value: unknown): Record<string, SurfaceStyle> {
  const out: Record<string, SurfaceStyle> = {}
  for (const [id, style] of Object.entries(loose(value))) {
    const clean = isSkinSurface(id) ? cleanSurfaceStyle(style) : undefined
    if (clean) out[id] = clean
  }
  return out
}

function motion(value: unknown, base: LookMotion): LookMotion {
  const v = loose(value)
  return { decode: typeof v.decode === 'boolean' ? v.decode : base.decode, glitch: typeof v.glitch === 'boolean' ? v.glitch : base.glitch }
}

export function cleanLook(value: unknown, from: ThemeLook = SEVEN_LOOK): ThemeLook {
  const v = loose(value)
  const base: ThemeLook = { ...SEVEN_LOOK, ...from }
  const has = (k: keyof ThemeLook) => k in v
  return {
    colours: has('colours') ? keyed(SKIN_COLOURS, v.colours, hex) : base.colours,
    tints: has('tints') ? keyed(SKIN_TINTS, v.tints, hex) : base.tints,
    fonts: has('fonts') ? keyed(FONT_ROLES, v.fonts, font) : base.fonts,
    type: has('type') ? keyed(TYPE_ROLES, v.type, typeStyle) : base.type,
    numerals: has('numerals') ? (oneOf(NUMERALS, v.numerals) ?? null) : base.numerals,
    shape: has('shape') ? shape(v.shape) : base.shape,
    lettering: has('lettering') ? lettering(v.lettering) : base.lettering,
    images: has('images') ? images(v.images) : base.images,
    ornament: has('ornament') ? ornament(v.ornament) : base.ornament,
    options: has('options') ? options(v.options) : base.options,
    skies: has('skies') ? skies(v.skies) : base.skies,
    motion: has('motion') ? motion(v.motion, base.motion) : base.motion,
    scheme: has('scheme') ? (oneOf(SKIN_SCHEMES, v.scheme) ?? null) : base.scheme,
    surfaces: has('surfaces') ? surfaces(v.surfaces) : base.surfaces
  }
}

export function pickLook(value: unknown): Partial<ThemeLook> {
  const v = loose(value)
  return Object.fromEntries(LOOK_KEYS.filter((k) => k in v).map((k) => [k, v[k]])) as Partial<ThemeLook>
}
