import fs from 'node:fs'
import path from 'node:path'
import type { ConversionDecision } from '@shared/conversions'
import { cleanWorldEvent, type WorldEvent } from '@shared/game/worldEvents'
import type { ArchiveFileInput } from '../../portability/archive'
import { readBytes, readJson, removePath } from '../../util/fs'
import { dataRoot } from '../../util/paths'
import { worldEvents } from '../../worlds/events'
import { worlds } from '../../worlds/store'
import { registerConversion } from '../registry'

const LEGACY_FILE = path.join(dataRoot, 'world-events.json')

interface PartitionedEvents {
  byWorld: Map<string, WorldEvent[]>
  orphans: WorldEvent[]
  inferredWorld: string | null
}

function partitionLegacyEvents(): PartitionedEvents | null {
  if (!fs.existsSync(LEGACY_FILE)) return null
  const raw = readJson<unknown[]>(LEGACY_FILE, [])
  if (!Array.isArray(raw)) return null
  const cleaned = raw.map(cleanWorldEvent).filter((e): e is WorldEvent => e !== null)
  if (cleaned.length === 0) return null

  const allWorlds = worlds.list()
  const singleWorldId = allWorlds.length === 1 ? allWorlds[0].id : null
  const byWorld = new Map<string, WorldEvent[]>()
  const orphans: WorldEvent[] = []
  let usedSingleFallback = false

  for (const ev of cleaned) {
    const targetWorld =
      ev.worldId && worlds.exists(ev.worldId)
        ? ev.worldId
        : !ev.worldId && singleWorldId
          ? singleWorldId
          : null

    if (targetWorld) {
      if (!ev.worldId && singleWorldId) usedSingleFallback = true
      const bucket = byWorld.get(targetWorld) ?? []
      bucket.push({ ...ev, worldId: targetWorld })
      byWorld.set(targetWorld, bucket)
    } else {
      orphans.push(ev)
    }
  }

  return {
    byWorld,
    orphans,
    inferredWorld: usedSingleFallback ? singleWorldId : null
  }
}

registerConversion({
  id: 'world-events-per-world',
  domain: 'world-events',
  title: 'Move World Events into their Worlds',
  description:
    'World Events now live inside each world folder (worlds/<world>/events.json) as pure story templates, with active and resolved states tracked strictly in saves.',
  inspect() {
    const part = partitionLegacyEvents()
    if (!part) return null
    const affects: string[] = []
    const allWorlds = worlds.list()
    const worldMetaById = new Map(allWorlds.map((w) => [w.id, w.name]))

    for (const [worldId, list] of part.byWorld.entries()) {
      const worldName = worldMetaById.get(worldId) ?? worldId
      affects.push(
        `${list.length} ${list.length === 1 ? 'event' : 'events'} → ${worldName} (worlds/${worldId}/events.json)`
      )
    }
    if (part.inferredWorld) {
      const worldName = worldMetaById.get(part.inferredWorld) ?? part.inferredWorld
      affects.push(`Events with no world set will be placed in ${worldName}`)
    }
    affects.push('Retires global world-events.json once verified')

    const options = allWorlds.map((w) => ({ value: w.id, label: w.name }))
    const decisions: ConversionDecision[] = part.orphans.map((o) => ({
      key: o.id,
      label: o.title,
      detail: `${o.outcomes.length} outcomes · ${o.scope.level}`,
      hint: o.worldId ? `Previously linked to missing world "${o.worldId}"` : 'No world assigned',
      multi: true,
      defaultSelected: []
    }))

    return {
      affects,
      ...(decisions.length ? { options, decisions } : {})
    }
  },
  collectBackup() {
    const files: ArchiveFileInput[] = []
    if (fs.existsSync(LEGACY_FILE)) {
      files.push({ name: 'world-events.json', data: readBytes(LEGACY_FILE) })
    }
    const part = partitionLegacyEvents()
    if (part) {
      for (const worldId of part.byWorld.keys()) {
        const target = worldEvents.fileFor(worldId)
        if (fs.existsSync(target)) {
          files.push({ name: `worlds/${worldId}/events.json`, data: readBytes(target) })
        }
      }
    }
    return files
  },
  apply(choices) {
    const part = partitionLegacyEvents()
    if (!part) return

    const byWorld = new Map<string, WorldEvent[]>(part.byWorld)
    for (const orphan of part.orphans) {
      const picked = choices[orphan.id] ?? []
      for (const worldId of picked) {
        if (!worlds.exists(worldId)) continue
        const bucket = byWorld.get(worldId) ?? []
        bucket.push({ ...orphan, worldId })
        byWorld.set(worldId, bucket)
      }
    }

    let movedCount = 0
    for (const [worldId, incoming] of byWorld.entries()) {
      const existing = worldEvents.listDefinitions(worldId)
      const merged = new Map<string, WorldEvent>(existing.map((e) => [e.id, e]))
      for (const ev of incoming) {
        const prev = merged.get(ev.id)
        if (!prev || ev.updatedAt >= prev.updatedAt) {
          merged.set(ev.id, { ...ev, worldId })
        }
      }
      worldEvents.writeDefinitions(worldId, [...merged.values()])

      const verified = worldEvents.listDefinitions(worldId)
      const verifiedIds = new Set(verified.map((e) => e.id))
      for (const expected of merged.keys()) {
        if (!verifiedIds.has(expected)) {
          throw new Error(`Verification failed for event "${expected}" in world "${worldId}".`)
        }
      }
      movedCount += incoming.length
    }

    removePath(LEGACY_FILE)
    worlds.emit('changed')
    worldEvents.emit('changed')

    return {
      summary: `Moved ${movedCount} ${movedCount === 1 ? 'world event' : 'world events'} into ${byWorld.size} ${byWorld.size === 1 ? 'world' : 'worlds'}.`
    }
  }
})
