import type { ComponentDef } from '@shared/game/core'
import type { EffectOutcome } from '@shared/effects'
import { engine } from '../../lib/ipc'
import { triggerOutcomeVfx } from '../vfx'
import type { PlayWhere } from './playStore'
import { playViewEvents } from './viewActs'

export async function runCardEffects(defs: ComponentDef[], event: string, where: PlayWhere, reversed = false): Promise<EffectOutcome | null> {
  const target = where.target?.ref ?? null
  if (!defs.length || !target) return null
  const caster = where.sheet ? { sheet: where.sheet } : null
  const done = await engine('effects.run', { defs, event, user: reversed ? target : caster, target: reversed ? caster : target, world: where.world ?? null })
  triggerOutcomeVfx(done, [where.target?.id ? `sheet:${where.target.id}` : null, where.target?.id ? `token:${where.target.id}` : null])
  await playViewEvents(done.view, 'Card', where.world ?? null)
  return done
}

export const effectLines = (done: EffectOutcome | null): string[] => (done ? [...done.results.map((r) => r.line), ...done.lines] : [])

export const targetLines = (where: PlayWhere): string[] => (where.target ? [`Target: ${where.target.link ?? where.target.name}.`] : [])
