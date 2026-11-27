import fs from 'node:fs'
import path from 'node:path'
import type { CreatureDisposition } from '@shared/maps'
import { smallestAt } from '@shared/shapes'
import { PLACE_TYPE_KEY, worldLink } from '@shared/world'
import { cleanEntityRecord, entityRecordToNpcState, npcActorId, type SaveNpcState } from '@shared/worldNpcs'
import type { ArchiveFileInput } from '../../portability/archive'
import { readBytes, readJson, writeJson } from '../../util/fs'
import { dataRoot } from '../../util/paths'
import { npcs } from '../../worlds/npcs'
import { saves } from '../../worlds/saves'
import { worlds } from '../../worlds/store'
import { registerConversion } from '../registry'

const SAVES_ROOT = path.join(dataRoot, 'saves')

interface LegacySaveEntry {
  id: string
  file: string
  world: string
  creatureCount: number
}

function findLegacySaves(): LegacySaveEntry[] {
  if (!fs.existsSync(SAVES_ROOT)) return []
  const out: LegacySaveEntry[] = []
  for (const name of fs.readdirSync(SAVES_ROOT)) {
    if (!name.endsWith('.json') || name === 'current.json' || name === 'chats.json') continue
    const file = path.join(SAVES_ROOT, name)
    const raw = readJson<Record<string, unknown>>(file, {})
    if (!Array.isArray(raw.creatures) || raw.creatures.length === 0) continue
    const world = typeof raw.world === 'string' ? raw.world : ''
    out.push({ id: name.slice(0, -5), file, world, creatureCount: raw.creatures.length })
  }
  return out
}

function cleanDisp(raw: unknown): CreatureDisposition | undefined {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return s === 'hostile' || s === 'neutral' || s === 'friendly' ? s : undefined
}

registerConversion({
  id: 'world-npcs-cutover',
  domain: 'world-npcs',
  title: 'Upgrade Save Creatures to World NPCs',
  description:
    'Spawned creatures in saves now use the full World NPC character sheet model (save.npcs) so every inhabitant supports dialogue, stats, inventory, relationships, and cards.',
  inspect() {
    const legacy = findLegacySaves()
    if (!legacy.length) return null
    const totalCreatures = legacy.reduce((n, s) => n + s.creatureCount, 0)
    return {
      affects: [
        `${totalCreatures} spawned ${totalCreatures === 1 ? 'creature' : 'creatures'} across ${legacy.length} ${legacy.length === 1 ? 'save' : 'saves'}`,
        'Converts save.creatures into full save.npcs character sheets while preserving map positions, spawner bindings, factions, and active combat queues'
      ]
    }
  },
  collectBackup() {
    const files: ArchiveFileInput[] = []
    for (const item of findLegacySaves()) {
      if (fs.existsSync(item.file)) {
        files.push({ name: `saves/${item.id}.json`, data: readBytes(item.file) })
      }
    }
    return files
  },
  apply() {
    const legacy = findLegacySaves()
    if (!legacy.length) return

    let convertedCount = 0
    const touchedWorlds = new Set<string>()

    for (const item of legacy) {
      const raw = readJson<Record<string, unknown>>(item.file, {})
      const worldId = typeof raw.world === 'string' && raw.world.trim() ? raw.world.trim() : 'world'
      const rawCreatures = Array.isArray(raw.creatures) ? raw.creatures : []
      const existingNpcs =
        raw.npcs && typeof raw.npcs === 'object' && !Array.isArray(raw.npcs)
          ? { ...(raw.npcs as Record<string, SaveNpcState | null>) }
          : {}
      const rawStand =
        raw.stand && typeof raw.stand === 'object' && !Array.isArray(raw.stand)
          ? { ...(raw.stand as Record<string, Record<string, { at?: { x?: number; y?: number }; actions?: string; decisions?: string }>>) }
          : {}

      const uses = worlds.exists(worldId) ? worlds.mapUses(worldId) : []
      const uidToActor = new Map<string, string>()
      const expectedNpcIds: string[] = []

      for (const c of rawCreatures) {
        const rec = cleanEntityRecord(c)
        if (!rec) continue
        const cObj = c as Record<string, unknown>
        const npcId = rec.uid.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || rec.uid
        const actorId = npcActorId(worldId, npcId)
        uidToActor.set(rec.uid, actorId)

        let where = ''
        for (const [mapId, standMap] of Object.entries(rawStand)) {
          const st = standMap?.[rec.uid]
          if (!st?.at || typeof st.at.x !== 'number' || typeof st.at.y !== 'number') continue
          const use = uses.find((u) => u.map === mapId)
          const pk = use ? smallestAt(use.shapes, { x: st.at.x, y: st.at.y }) : null
          if (pk) {
            where = worldLink(worldId, PLACE_TYPE_KEY, pk)
            break
          }
        }

        existingNpcs[npcId] = entityRecordToNpcState(rec, {
          title: rec.name,
          faction: typeof cObj.faction === 'string' ? cObj.faction : null,
          disposition: cleanDisp(cObj.disposition),
          where,
          sourceTemplateId: rec.template.id || null
        })
        expectedNpcIds.push(npcId)
        convertedCount++
      }

      const nextStand: Record<string, Record<string, unknown>> = {}
      for (const [mapId, standMap] of Object.entries(rawStand)) {
        const mapped: Record<string, unknown> = {}
        for (const [tok, val] of Object.entries(standMap ?? {})) {
          mapped[uidToActor.get(tok) ?? tok] = val
        }
        nextStand[mapId] = mapped
      }

      const nextRecords =
        raw.records && typeof raw.records === 'object' && !Array.isArray(raw.records)
          ? { ...(raw.records as Record<string, Record<string, unknown>>) }
          : {}
      if (nextRecords.spawners && typeof nextRecords.spawners === 'object') {
        const nextSpawners: Record<string, unknown> = {}
        for (const [spId, spVal] of Object.entries(nextRecords.spawners)) {
          if (spVal && typeof spVal === 'object' && typeof (spVal as { creature?: unknown }).creature === 'string') {
            const oldUid = (spVal as { creature: string }).creature
            nextSpawners[spId] = { ...(spVal as Record<string, unknown>), creature: uidToActor.get(oldUid) ?? oldUid }
          } else {
            nextSpawners[spId] = spVal
          }
        }
        nextRecords.spawners = nextSpawners
      }

      let nextBattle = raw.battle
      if (raw.battle && typeof raw.battle === 'object' && !Array.isArray(raw.battle)) {
        const bObj = raw.battle as Record<string, unknown>
        if (Array.isArray(bObj.queue)) {
          nextBattle = {
            ...bObj,
            queue: bObj.queue.map((p) => {
              if (!p || typeof p !== 'object') return p
              const pObj = p as Record<string, unknown>
              const mappedId = typeof pObj.id === 'string' ? uidToActor.get(pObj.id) : undefined
              return mappedId ? { ...pObj, id: mappedId, kind: 'sheet' } : pObj
            })
          }
        }
      }

      const { creatures: _removed, ...restRaw } = raw
      writeJson(item.file, {
        ...restRaw,
        npcs: existingNpcs,
        stand: nextStand,
        records: nextRecords,
        ...(nextBattle !== undefined ? { battle: nextBattle } : {})
      })

      saves.evict(item.id)
      const verified = saves.get(item.id)
      for (const expectedId of expectedNpcIds) {
        if (!verified.npcs[expectedId]) {
          throw new Error(`Verification failed for converted NPC "${expectedId}" in save "${item.id}".`)
        }
      }
      if (worldId) touchedWorlds.add(worldId)
    }

    for (const w of touchedWorlds) {
      saves.emit('changed', w)
      npcs.emit('changed', w)
    }
    worlds.emit('changed')

    return {
      summary: `Converted ${convertedCount} spawned ${convertedCount === 1 ? 'creature' : 'creatures'} across ${legacy.length} ${legacy.length === 1 ? 'save' : 'saves'} into World NPCs.`
    }
  }
})
