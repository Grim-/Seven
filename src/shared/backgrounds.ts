import './backgrounds/cyberdeck'
import './backgrounds/neonCity'
import './backgrounds/blackwall'
import { backgroundInfo, backgroundList } from './backgrounds/registry'

export * from './backgrounds/registry'

export const BACKGROUND_MODULE = 'backgrounds'

export const CORE_EFFECTS: { id: string; name: string }[] = [
  { id: 'none', name: 'None' },
  { id: 'feed', name: 'Data feed' }
]

export function isEffect(value: unknown): value is string {
  return typeof value === 'string' && (CORE_EFFECTS.some((e) => e.id === value) || Boolean(backgroundInfo(value)))
}

export function effectName(id: string): string {
  return CORE_EFFECTS.find((e) => e.id === id)?.name ?? backgroundInfo(id)?.name ?? id
}

export function cleanEffectSettings(value: unknown): Record<string, number | string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, number | string> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
    if (!/^[A-Za-z][\w]{0,30}$/.test(k)) continue
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) out[k] = v.toLowerCase()
  }
  return out
}

export function reactionsText(): string {
  return backgroundList()
    .filter((b) => b.reactions.length)
    .map((b) => `${b.id} (${b.reactions.map((r) => r.name).join(', ')})`)
    .join('; ')
}
