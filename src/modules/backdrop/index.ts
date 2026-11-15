import type { ModuleFactory } from '../../engine/modules/sdk'
import { ToolError, optStr, type ToolDef } from '../../engine/tools/types'
import { backdrops } from '../../engine/backdrops'
import { themes } from '../../engine/themes/store'
import { SKY_MODES, isHex, type Ambience, type SkyMode, type Theme } from '@shared/theme'
import { BACKGROUND_MODULE, CORE_EFFECTS, backgroundInfo, backgroundList, reactionsText } from '@shared/backgrounds'
import { linkFor } from '@shared/text'
import { modules } from '../../engine/modules/registry'
import type { AssetMeta, Backdrop } from '@shared/types'
import { resolveFile } from '../../engine/library/files'
import { findSlideshow } from '../../engine/library/slideshows'

const MAX_PER_REPLY = 3
const used = new WeakMap<AbortSignal, number>()

function count(signal: AbortSignal, what: string): void {
  const n = (used.get(signal) ?? 0) + 1
  used.set(signal, n)
  if (n > MAX_PER_REPLY) throw new ToolError(`That is the limit of ${MAX_PER_REPLY} ${what} for one reply. Don't make more this reply; carry on with your answer.`)
}

function asset(ref: string, kinds: AssetMeta['kind'][], what: string): string {
  return resolveFile(ref, kinds, what).id
}

const sound = (ref: string) => asset(ref, ['audio'], 'a sound file')

function hexOrNone(value: unknown, what: string): string | null | undefined {
  if (value === null || value === undefined) return undefined
  const v = String(value).trim()
  if (v.toLowerCase() === 'none') return null
  if (!isHex(v)) throw new ToolError(`Set ${what} to a hex colour like "#ff8a3d", or "none" to turn it off. "${v}" is not one.`)
  return v
}

const EFFECT_IDS = [...CORE_EFFECTS.map((e) => e.id), ...backgroundList().map((b) => b.id)]

function backgroundsOn(): boolean {
  return modules.list().some((m) => m.id === BACKGROUND_MODULE && m.state === 'on')
}

function effect(ref: string): string {
  const r = ref.trim().toLowerCase()
  const id = EFFECT_IDS.find((e) => e === r) ?? backgroundList().find((b) => b.name.toLowerCase() === r)?.id
  if (!id) throw new ToolError(`There is no animated background "${ref}". Use one of: ${EFFECT_IDS.join(', ')}.`)
  if (backgroundInfo(id) && !backgroundsOn()) throw new ToolError(`${backgroundInfo(id)!.name} needs the Backgrounds add-on, which is off. Use one of: ${CORE_EFFECTS.map((e) => e.id).join(', ')}, or ask the user to turn Backgrounds on in Tools.`)
  return id
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter((s) => s.trim()) : []
}

function slideshowRef(ref: string | null): string | null {
  if (!ref) return null
  const id = findSlideshow(ref)
  if (!id) throw new ToolError(`There is no slideshow "${ref}". find with kind slideshow lists them, and add_slideshow makes one.`)
  return id
}

function backdropFrom(params: Record<string, unknown>, colorsKey: string, imageKey: string, dimKey: string): Backdrop | null | undefined {
  const colors = list(params[colorsKey])
  const image = optStr(params, imageKey)?.trim() || null
  const slideshow = slideshowRef(optStr(params, 'slideshow')?.trim() || null)
  if (!colors.length && !image && !slideshow) return undefined
  if (colors.length === 1 && colors[0].toLowerCase() === 'none') return null
  const bad = colors.find((c) => !/^#[0-9a-fA-F]{3,8}$/.test(c))
  if (bad) throw new ToolError(`Every entry in ${colorsKey} must be a hex colour like "#1a0f2e", or use ["none"]. "${bad}" is not one.`)
  const id = image ? asset(image, ['image', 'video'], 'a picture or video') : null
  const dim = typeof params[dimKey] === 'number' ? (params[dimKey] as number) : id || slideshow ? 0.55 : 0
  return { colors: colors.slice(0, 4), image: id, slideshow, dim }
}

const ambience: ToolDef = {
  name: 'ambience',
  command: true,
  group: 'backdrop',
  needsWorkspace: false,
  activity: () => 'changing the mood',
  description: "Change this chat's mood: theme, sky, mood light, background and music. Give only what should change. minutes makes it temporary.",
  params: {
    type: 'object',
    properties: {
      theme: { type: ['string', 'null'], description: 'A theme name, or "default"' },
      sky: { enum: [...SKY_MODES, null] },
      light: { type: ['string', 'null'], description: 'Hex colour for the mood light, or "none"' },
      light_strength: { type: ['number', 'null'], description: '0 to 1' },
      colors: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' }, maxItems: 4 }], description: 'Background colours, or ["none"]' },
      image: { type: ['string', 'null'], description: 'Background picture or video file' },
      slideshow: { type: ['string', 'null'], description: 'A slideshow to play as the background' },
      dim: { type: ['number', 'null'] },
      animated: { type: ['string', 'null'], description: `Animated background: ${EFFECT_IDS.join(', ')}, or "theme"` },
      music: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' }, maxItems: 10 }], description: 'Sound files to loop, ["none"] or ["theme"]' },
      minutes: { type: ['number', 'null'] },
      reset: { type: ['boolean', 'null'] }
    }
  },
  async execute(params, ctx) {
    count(ctx.signal, 'mood changes')
    if (params.reset === true) {
      themes.setAmbience(ctx.sessionId, null)
      backdrops.set(ctx.sessionId, 'chat', null)
      return "The chat is back to its theme."
    }
    const minutes = typeof params.minutes === 'number' && params.minutes > 0 ? Math.min(240, Math.max(1, params.minutes)) : null
    const patch: Partial<Ambience> = {}
    const changed: string[] = []
    const themeRef = optStr(params, 'theme')?.trim()
    if (themeRef) {
      patch.theme = themeRef.toLowerCase() === 'default' ? null : themes.get(themeRef).id
      changed.push('theme')
    }
    if (typeof params.sky === 'string') {
      patch.sky = params.sky as SkyMode
      changed.push('sky')
    }
    const light = hexOrNone(params.light, 'light')
    if (light !== undefined || typeof params.light_strength === 'number') {
      const current = themes.ambience(ctx.sessionId).light
      const color = light === undefined ? (current?.color ?? null) : light
      if (light !== null && !color) throw new ToolError('There is no mood light yet, so light_strength alone does nothing. Set light to a hex colour like "#ff8a3d" too.')
      patch.light = color ? { color, strength: typeof params.light_strength === 'number' ? params.light_strength : (current?.strength ?? 0.35) } : null
      changed.push('light')
    }
    const animated = optStr(params, 'animated')?.trim()
    if (animated) {
      patch.background = animated.toLowerCase() === 'theme' ? null : effect(animated)
      changed.push('animated background')
    }
    const music = list(params.music)
    if (music.length) {
      const first = music[0].toLowerCase()
      patch.music = first === 'theme' ? null : first === 'none' ? [] : music.map(sound)
      changed.push('music')
    }
    const backdrop = backdropFrom(params, 'colors', 'image', 'dim')
    if (backdrop !== undefined) {
      backdrops.set(ctx.sessionId, minutes ? 'timed' : 'chat', backdrop, minutes ?? undefined)
      changed.push('background')
    }
    if (!changed.length) throw new ToolError('Nothing to change. Give a theme, sky, light, colors, image, slideshow, animated or music, or reset true.')
    if (Object.keys(patch).length) themes.setAmbience(ctx.sessionId, patch, minutes)
    return `Changed the ${changed.join(', ')}${minutes ? ` for ${Math.round(minutes)} minutes` : ''}.`
  }
}

const cue: ToolDef = {
  name: 'cue',
  command: true,
  group: 'backdrop',
  needsWorkspace: false,
  activity: () => 'playing a cue',
  description: 'A one-off moment: play a sound file, flash a colour, shake the screen, and/or play a reaction on the animated background.',
  params: {
    type: 'object',
    properties: {
      sound: { type: ['string', 'null'] },
      flash: { type: ['string', 'null'], description: 'Hex colour' },
      shake: { type: ['boolean', 'null'] },
      reaction: { type: ['string', 'null'], description: `Plays on the animated background that is showing: ${reactionsText()}` }
    }
  },
  async execute(params, ctx) {
    count(ctx.signal, 'cues')
    const s = optStr(params, 'sound')?.trim()
    const flash = optStr(params, 'flash')?.trim() || null
    if (flash && !isHex(flash)) throw new ToolError(`Set flash to a hex colour like "#ffffff", or null for no flash. "${flash}" is not one.`)
    const reaction = optStr(params, 'reaction')?.trim().toLowerCase() || null
    if (reaction) {
      if (!backgroundsOn()) throw new ToolError('Background reactions need the Backgrounds add-on, which is off. Set reaction to null, and use sound, flash or shake instead.')
      if (!backgroundList().some((b) => b.reactions.some((r) => r.name === reaction))) throw new ToolError(`There is no reaction "${reaction}". Set reaction to one of these, or null: ${reactionsText()}. Each works only on the animated background listed with it.`)
    }
    if (!s && !flash && params.shake !== true && !reaction) throw new ToolError('Nothing to play. Set at least one of: sound (a sound file), flash (a hex colour like "#ffffff"), shake true, or reaction.')
    themes.cue({ sessionId: ctx.sessionId, sound: s ? sound(s) : null, flash, shake: params.shake === true, reaction })
    return 'Played.'
  }
}

const themeSave: ToolDef = {
  name: 'theme_save',
  command: true,
  group: 'backdrop',
  needsWorkspace: false,
  maxRepeats: 2,
  description: 'Make a theme or change one. Give only what should change; copy_of starts a new theme from another.',
  params: {
    type: 'object',
    properties: {
      theme: { type: 'string' },
      copy_of: { type: ['string', 'null'] },
      rename: { type: ['string', 'null'] },
      description: { type: ['string', 'null'] },
      accent: { type: ['string', 'null'] },
      accent_soft: { type: ['string', 'null'] },
      secondary: { type: ['string', 'null'] },
      base: { type: ['string', 'null'], description: 'The darkest background colour' },
      sky: { enum: [...SKY_MODES, null] },
      light: { type: ['string', 'null'], description: 'Hex, or "none"' },
      light_strength: { type: ['number', 'null'] },
      background_colors: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' }, maxItems: 4 }], description: 'or ["none"]' },
      background_image: { type: ['string', 'null'] },
      background_dim: { type: ['number', 'null'] },
      effect: { type: ['string', 'null'], description: `Animated background: ${EFFECT_IDS.join(', ')}` },
      music: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' }, maxItems: 20 }], description: 'Sound files, or ["none"]' },
      music_volume: { type: ['number', 'null'] },
      sound_reply: { type: ['string', 'null'], description: 'Sound file, or "none"' },
      sound_reminder: { type: ['string', 'null'] },
      sound_ask: { type: ['string', 'null'] }
    }
  },
  async execute(params, ctx) {
    const ref = optStr(params, 'theme')?.trim() ?? ''
    if (!ref) throw new ToolError('Set theme to the name of the theme to make or change, e.g. "Midnight".')
    const existing = themes.find(ref)
    const from = optStr(params, 'copy_of')
    const base: Theme | null = existing ?? (from ? themes.get(from) : null)
    const input: Omit<Partial<Theme>, 'id'> & { id?: string | null } = base && !existing ? { ...base, id: null, name: ref, builtin: false, createdBy: ctx.agentId } : existing ? { id: existing.id } : { id: null, name: ref, createdBy: ctx.agentId }
    const rename = optStr(params, 'rename')?.trim()
    if (rename) input.name = rename
    const text = optStr(params, 'description')
    if (text !== null) input.description = text
    for (const [key, field] of [['accent', 'accent'], ['accent_soft', 'accentSoft'], ['secondary', 'secondary'], ['base', 'base']] as const) {
      const v = optStr(params, key)?.trim()
      if (!v) continue
      if (!isHex(v)) throw new ToolError(`Set ${key} to a 6-digit hex colour like "#ffc919". "${v}" is not one.`)
      input[field] = v
    }
    if (typeof params.sky === 'string') input.sky = params.sky as SkyMode
    const light = hexOrNone(params.light, 'light')
    if (light !== undefined || typeof params.light_strength === 'number') {
      const color = light === undefined ? (existing?.light?.color ?? base?.light?.color ?? null) : light
      input.light = color ? { color, strength: typeof params.light_strength === 'number' ? params.light_strength : (existing?.light?.strength ?? 0.35) } : null
    }
    const backdrop = backdropFrom(params, 'background_colors', 'background_image', 'background_dim')
    if (backdrop !== undefined) input.backdrop = backdrop
    const effectRef = optStr(params, 'effect')?.trim()
    if (effectRef) input.effect = effect(effectRef)
    const music = list(params.music)
    if (music.length) input.music = music[0].toLowerCase() === 'none' ? [] : music.map(sound)
    if (typeof params.music_volume === 'number') input.volume = params.music_volume
    const sounds: Partial<Theme['sounds']> = {}
    for (const k of ['reply', 'reminder', 'ask'] as const) {
      const v = optStr(params, `sound_${k}`)?.trim()
      if (v) sounds[k] = v.toLowerCase() === 'none' ? null : sound(v)
    }
    if (Object.keys(sounds).length) input.sounds = { ...(existing ?? base ?? { sounds: { reply: null, reminder: null, ask: null } }).sounds, ...sounds }
    let saved: Theme
    try {
      saved = themes.save(input)
    } catch (err) {
      throw new ToolError(err instanceof Error ? err.message : String(err))
    }
    return `${existing ? 'Changed' : 'Made'} the theme ${linkFor('theme', saved.name)}.`
  }
}

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: ToolDef): void }): void {
      tools.add(ambience)
      tools.add(cue)
      tools.add(themeSave)
    }
  }

export default factory
