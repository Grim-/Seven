import { triggerReactionForSheets } from '../../vfx'
import { triggerVfx } from '../../../store/vfx'
import type { MapToken } from '../../maps/TokenLayer'
import { registerAmbientAct, registerViewAct } from './registry'

function playVfxCue(
  defaultPreset: string,
  data: Record<string, unknown>,
  { target, token }: { target: string | null; token: MapToken | null }
): void {
  const preset = typeof data.preset === 'string' && data.preset ? data.preset : defaultPreset
  const extraTargets = Array.isArray(data.targets)
    ? data.targets.filter((t): t is string => typeof t === 'string')
    : typeof data.target === 'string' && data.target
      ? [data.target]
      : []
  const resolved = target ? [`sheet:${target}`, `creature:${target}`, `token:${target}`] : []
  const tokenTargets = token
    ? [`token:${token.visitor.token}`, `sheet:${token.visitor.sheet}`, token.visitor.agent ? `agent:${token.visitor.agent}` : null]
    : []
  const targets = [...extraTargets, ...resolved, ...tokenTargets].filter((t): t is string => Boolean(t))
  if (!targets.length) return
  triggerVfx(targets, {
    preset,
    color: typeof data.tone === 'string' ? data.tone : typeof data.color === 'string' ? data.color : undefined,
    intensity: typeof data.intensity === 'number' ? data.intensity : undefined,
    durationMs: typeof data.durationMs === 'number' ? data.durationMs : undefined,
    loop: data.loop === true
  })
  if (typeof data.reaction === 'string' && data.reaction) {
    const sheets = [target, token?.visitor.sheet, ...extraTargets.map((t) => (t.startsWith('sheet:') ? t.slice(6) : t))]
    triggerReactionForSheets(sheets, data.reaction)
  }
}

registerAmbientAct('vfx', (data, ctx) => playVfxCue('pulse', data, ctx))
registerViewAct('highlight', (data, { token }) => playVfxCue('highlight', data, { target: null, token }))
