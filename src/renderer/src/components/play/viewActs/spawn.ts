import type { Point } from '@shared/shapes'
import { engine } from '../../../lib/ipc'
import type { MapToken } from '../../maps/TokenLayer'
import { registerViewAct, spotBeside, type WorldViewHost } from './registry'

export async function spawnBeside(host: WorldViewHost, token: MapToken | null, data: Record<string, unknown>): Promise<{ uid: string; at: Point } | null> {
  const creature = String(data.creature ?? '')
  if (!creature) return null
  const at = spotBeside(host, token)
  const before = new Set(Object.keys(host.save?.stand[host.map.id] ?? {}))
  const save = await engine('saves.spawnBlueprint', {
    world: host.world,
    map: host.map.id,
    source: String(data.source ?? ''),
    id: creature,
    name: '',
    faction: String(data.faction ?? ''),
    at
  })
  const standMap = save.stand[host.map.id] ?? {}
  const addedKey = Object.keys(standMap).find((k) => !before.has(k)) ?? Object.keys(standMap).pop()
  return addedKey ? { uid: addedKey, at } : null
}

registerViewAct('spawn_creature', (data, { host, token }) => spawnBeside(host, token, data))
