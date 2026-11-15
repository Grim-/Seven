export type VfxTone = 'accent' | 'alert' | 'ok' | 'teal' | 'purple' | 'cyan'

export const TONE_VARS: Record<VfxTone, string> = {
  accent: 'var(--color-accent)',
  alert: 'var(--color-alert)',
  ok: 'var(--color-ok)',
  teal: 'var(--color-teal)',
  purple: 'var(--color-purple)',
  cyan: 'var(--color-cyan)'
}

export interface VfxBuildContext {
  color: string
  intensity: number
  durationMs: number
  reducedMotion: boolean
  loop?: boolean
}

export interface VfxBuilt {
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions
}

export interface VfxPreset {
  id: string
  label: string
  tone: VfxTone
  defaultDurationMs: number
  build: (ctx: VfxBuildContext) => VfxBuilt
}

const presets = new Map<string, VfxPreset>()

export function registerVfxPreset(preset: VfxPreset): void {
  presets.set(preset.id, preset)
}

export function vfxPreset(id: string): VfxPreset | null {
  return presets.get(id) ?? null
}

export function vfxPresets(): VfxPreset[] {
  return [...presets.values()]
}

export function resolveVfxColor(preset: VfxPreset, override?: string): string {
  if (!override) return TONE_VARS[preset.tone]
  return override in TONE_VARS ? TONE_VARS[override as VfxTone] : override
}
