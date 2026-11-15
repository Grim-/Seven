import type { Flags } from '@shared/maps'
import type { GameSave } from '@shared/game/save'
import { saveInPlay } from '../../worlds/playLayer'
import { saves } from '../../worlds/saves'
import { registerWorldAct } from '../acts'

const parse = (raw: string): string | number | boolean => (raw === 'true' ? true : raw === 'false' ? false : Number.isFinite(Number(raw)) ? Number(raw) : raw)

function withFlag(flags: Flags, flag: string, raw: string): Flags {
  const next = { ...flags }
  if (raw) next[flag] = parse(raw)
  else delete next[flag]
  return next
}

function flagged(save: GameSave, scope: unknown, targetKey: string | null, flag: string, raw: string): GameSave | null {
  if (scope !== 'own') return { ...save, flags: withFlag(save.flags, flag, raw) }
  if (!targetKey) return null
  return { ...save, thingFlags: { ...save.thingFlags, [targetKey]: withFlag(save.thingFlags[targetKey] ?? {}, flag, raw) } }
}

registerWorldAct('set_flag', (data, { world, targetKey }) => {
  const flag = String(data.flag ?? '').trim()
  const save = world ? saveInPlay(world, true) : null
  const next = flag && save ? flagged(save, data.scope, targetKey, flag, String(data.value ?? '')) : null
  if (next) saves.write(next)
  return null
})
