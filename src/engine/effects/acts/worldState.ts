import { FACTION_STANCES, type FactionStance } from '@shared/game/factions'
import { shapeBounds } from '@shared/shapes'
import { PLACE_TYPE_KEY, worldLink } from '@shared/world'
import { npcActorId, splitNpcRef } from '@shared/worldNpcs'
import { almanacs } from '../../almanac/store'
import { factions } from '../../factions/store'
import { findSheet } from '../../library/sheets'
import { npcs } from '../../worlds/npcs'
import { saves } from '../../worlds/saves'
import { saveInPlay } from '../../worlds/playLayer'
import { wakeMapSpawners } from '../../worlds/spawners'
import { worlds } from '../../worlds/store'
import { registerWorldAct } from '../acts'

function splitPair(raw: unknown): { mapId: string; id: string } {
  const s = String(raw ?? '').trim()
  const at = s.indexOf(':')
  if (at > 0) return { mapId: s.slice(0, at), id: s.slice(at + 1) }
  return { mapId: '', id: s }
}

function cleanPlaceKey(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  return s.includes('/') ? (s.split('/').pop() ?? s) : s
}

registerWorldAct('move_character', (data, { world }) => {
  const rawChar = String(data.character ?? '').trim()
  const placeKey = cleanPlaceKey(data.place)
  const save = world ? saveInPlay(world, true) : null
  if (!world || !save || !rawChar || !placeKey) return null

  const resolvedId = findSheet(rawChar, world) ?? rawChar
  const npc = splitNpcRef(resolvedId)
  const tokenKey = npc ? npcActorId(world, npc.id) : resolvedId
  const whereLink = worldLink(world, PLACE_TYPE_KEY, placeKey)

  const uses = worlds.mapUses(world)
  const nextStand = { ...save.stand }
  for (const u of uses) {
    const explicit = u.spawns?.[placeKey]
    const form = u.shapes[placeKey]
    if (!explicit && !form) continue
    const box = form ? shapeBounds(form) : null
    const at = explicit ?? { x: Math.round(box!.x + box!.w / 2), y: Math.round(box!.y + box!.h / 2) }
    nextStand[u.map] = { ...(nextStand[u.map] ?? {}), [tokenKey]: { ...(nextStand[u.map]?.[tokenKey] ?? { actions: '', decisions: '' }), at } }
  }

  if (npc) {
    const cur = npcs.find(npc.id, world, 'play')
    const prev = save.npcs[npc.id]
    const prevObj = prev && typeof prev === 'object' ? prev : {}
    saves.write({
      ...save,
      npcs: {
        ...save.npcs,
        [npc.id]: {
          ...prevObj,
          story: { ...(cur?.story ?? { where: whereLink, threads: [], sessions: [] }), where: whereLink }
        }
      },
      stand: nextStand
    })
    npcs.emit('changed', world)
    return null
  }

  const prevChar = save.characters[tokenKey] ?? { game: null, where: whereLink }
  saves.write({
    ...save,
    characters: { ...save.characters, [tokenKey]: { ...prevChar, where: whereLink } },
    stand: nextStand
  })
  return null
})

registerWorldAct('set_map_layer', (data, { world }) => {
  const { mapId, id: layerId } = splitPair(data.layer)
  const mode = String(data.mode ?? 'open')
  const save = world ? saveInPlay(world, true) : null
  if (!world || !save || !layerId) return null

  const targetMap = mapId || worlds.mapUses(world)[0]?.map || ''
  if (!targetMap) return null

  const prevMap = save.mapLayers?.[targetMap] ?? {}
  const prevLayer = prevMap[layerId] ?? {}
  const patch =
    mode === 'show'
      ? { visible: true }
      : mode === 'hide'
        ? { visible: false }
        : mode === 'open'
          ? { solid: false }
          : { solid: true }

  saves.write({
    ...save,
    mapLayers: {
      ...(save.mapLayers ?? {}),
      [targetMap]: {
        ...prevMap,
        [layerId]: { ...prevLayer, ...patch }
      }
    }
  })
  return null
})

registerWorldAct('control_spawner', (data, { world }) => {
  const { mapId, id: spawnerId } = splitPair(data.spawner)
  const mode = String(data.mode ?? 'activate')
  const save = world ? saveInPlay(world, true) : null
  if (!world || !save || !spawnerId) return null

  const targetMap = mapId || worlds.mapUses(world)[0]?.map || ''
  if (!targetMap) return null

  const prevMapStates = save.spawnerStates?.[targetMap] ?? {}
  const nextSpawnerStates = {
    ...(save.spawnerStates ?? {}),
    [targetMap]: {
      ...prevMapStates,
      [spawnerId]: { disabled: mode === 'disable' }
    }
  }

  const prevRecords = { ...(save.records.spawners ?? {}) }
  if (mode === 'reset' || mode === 'activate' || mode === 'spawnNow') {
    delete prevRecords[spawnerId]
  }

  saves.write({
    ...save,
    spawnerStates: nextSpawnerStates,
    records: { ...save.records, spawners: prevRecords }
  })

  if (mode === 'activate' || mode === 'spawnNow') {
    wakeMapSpawners(world, targetMap, true)
  }
  return null
})

registerWorldAct('reset_spawner', (data, { world }) => {
  const spawnerId = String(data.spawner ?? '').trim()
  const save = world ? saveInPlay(world, true) : null
  if (!world || !save) return null
  const prevRecords = { ...(save.records.spawners ?? {}) }
  if (spawnerId) delete prevRecords[spawnerId]
  else {
    for (const k of Object.keys(prevRecords)) delete prevRecords[k]
  }
  saves.write({ ...save, records: { ...save.records, spawners: prevRecords } })
  return null
})

registerWorldAct('update_faction', (data, { world }) => {
  const factionId = String(data.faction ?? '').trim()
  const change = String(data.change ?? 'adjustPower')
  const rawVal = String(data.value ?? '').trim()
  if (!world || !factionId) return null

  const current = factions.get(factionId, world, 'play')
  if (change === 'adjustPower') {
    const delta = Number(rawVal) || 0
    factions.updateInSave(world, current.id, { power: (current.power ?? 0) + delta })
  } else if (change === 'setPower') {
    const next = Number(rawVal)
    if (Number.isFinite(next)) factions.updateInSave(world, current.id, { power: next })
  } else if (change === 'setStance') {
    if ((FACTION_STANCES as readonly string[]).includes(rawVal)) {
      factions.updateInSave(world, current.id, { defaultStance: rawVal as FactionStance })
    }
  } else if (change === 'setLeader') {
    factions.updateInSave(world, current.id, { leaderSheet: rawVal || null })
  }
  return null
})

registerWorldAct('log_almanac', (data, { world }) => {
  const title = String(data.title ?? '').trim()
  const summary = String(data.summary ?? '').trim()
  const save = world ? saveInPlay(world, true) : null
  if (!save?.almanacId || (!title && !summary)) return null
  almanacs.recordEntry(save.almanacId, {
    kind: 'milestone',
    title: title || summary,
    summary: summary || title
  })
  return null
})
