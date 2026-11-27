import fs from 'node:fs'
import path from 'node:path'
import type { ConversionDecision } from '@shared/conversions'
import { cleanStoredFaction, type StoredFaction } from '@shared/game/factions'
import type { ArchiveFileInput } from '../../portability/archive'
import { readBytes, readJson, removePath } from '../../util/fs'
import { dataRoot } from '../../util/paths'
import { factions } from '../../factions/store'
import { maps } from '../../maps/store'
import { worldEvents } from '../../worlds/events'
import { saves } from '../../worlds/saves'
import { worlds } from '../../worlds/store'
import { registerConversion } from '../registry'

const LEGACY_FILE = path.join(dataRoot, 'factions.json')

function readLegacyFactions(): StoredFaction[] {
  if (!fs.existsSync(LEGACY_FILE)) return []
  const raw = readJson<unknown[]>(LEGACY_FILE, [])
  if (!Array.isArray(raw)) return []
  return raw.map(cleanStoredFaction).filter((f): f is StoredFaction => f !== null)
}

function detectFactionWorlds(factionIds: string[]): Map<string, Set<string>> {
  const refs = new Map<string, Set<string>>(factionIds.map((id) => [id, new Set<string>()]))
  const mark = (fid: string | null | undefined, worldId: string) => {
    if (!fid) return
    refs.get(fid)?.add(worldId)
  }

  for (const w of worlds.list()) {
    for (const ev of worldEvents.listDefinitions(w.id)) {
      for (const p of ev.participants) {
        if (p.kind === 'faction') mark(p.refId || p.factionId, w.id)
        else mark(p.factionId, w.id)
      }
      for (const o of ev.outcomes) {
        mark(o.winnerFactionId, w.id)
        for (const f of o.factors) mark(f.factionId, w.id)
      }
    }
    for (const u of worlds.mapUses(w.id)) {
      const m = maps.get(u.map)
      for (const sp of m?.spawners ?? []) mark(sp.faction, w.id)
    }
  }

  for (const s of saves.all()) {
    if (!s.world || !worlds.exists(s.world)) continue
    for (const n of Object.values(s.npcs)) if (n) mark(n.faction, s.world)
    for (const fid of Object.keys(s.factions ?? {})) mark(fid, s.world)
  }

  return refs
}

registerConversion({
  id: 'factions-per-world',
  domain: 'factions',
  title: 'Move Factions into their Worlds',
  description:
    'Factions now belong to each world (worlds/<world>/factions.json) so leaders, relations, and territory stay scoped to that world and evolve per save. Pick which world(s) should receive each existing faction.',
  inspect() {
    const legacy = readLegacyFactions()
    if (!legacy.length) return null

    const allWorlds = worlds.list()
    const worldNames = new Map(allWorlds.map((w) => [w.id, w.name]))
    const refs = detectFactionWorlds(legacy.map((f) => f.id))
    const soleWorldId = allWorlds.length === 1 ? allWorlds[0].id : null

    const options = allWorlds.map((w) => ({ value: w.id, label: w.name }))
    const decisions: ConversionDecision[] = legacy.map((f) => {
      const detected = [...(refs.get(f.id) ?? [])]
      const defaultSelected = detected.length ? detected : soleWorldId ? [soleWorldId] : []
      const refHint = detected.length
        ? `Referenced in: ${detected.map((id) => worldNames.get(id) ?? id).join(', ')}`
        : soleWorldId
          ? `Only world: ${worldNames.get(soleWorldId) ?? soleWorldId}`
          : 'Not currently referenced — pick world(s) or leave unchecked to skip'
      return {
        key: f.id,
        label: f.name,
        detail: `${f.defaultStance} · ${Object.keys(f.relations).length} relations`,
        hint: refHint,
        multi: true,
        defaultSelected
      }
    })

    return {
      affects: [
        `${legacy.length} global ${legacy.length === 1 ? 'faction' : 'factions'} in factions.json`,
        'Copy into one or more worlds (existing factions with the same ID are preserved unless newer)',
        'Retires global factions.json once verified'
      ],
      options,
      decisions
    }
  },
  collectBackup() {
    const files: ArchiveFileInput[] = []
    if (fs.existsSync(LEGACY_FILE)) {
      files.push({ name: 'factions.json', data: readBytes(LEGACY_FILE) })
    }
    for (const w of worlds.list()) {
      const target = factions.fileFor(w.id)
      if (fs.existsSync(target)) {
        files.push({ name: `worlds/${w.id}/factions.json`, data: readBytes(target) })
      }
    }
    return files
  },
  apply(choices) {
    const legacy = readLegacyFactions()
    if (!legacy.length) return

    const byWorld = new Map<string, StoredFaction[]>()
    let copies = 0
    for (const f of legacy) {
      const picked = choices[f.id] ?? []
      for (const worldId of picked) {
        if (!worlds.exists(worldId)) continue
        const bucket = byWorld.get(worldId) ?? []
        bucket.push(f)
        byWorld.set(worldId, bucket)
      }
    }

    for (const [worldId, incoming] of byWorld.entries()) {
      const existing = factions.list(worldId, 'template')
      const merged = new Map<string, StoredFaction>(existing.map((f) => [f.id, f]))
      for (const f of incoming) {
        if (!merged.has(f.id)) merged.set(f.id, f)
      }
      factions.writeWorld(worldId, [...merged.values()])

      const verifiedIds = new Set(factions.list(worldId, 'template').map((f) => f.id))
      for (const expected of merged.keys()) {
        if (!verifiedIds.has(expected)) {
          throw new Error(`Verification failed for faction "${expected}" in world "${worldId}".`)
        }
      }
      copies += incoming.length
    }

    removePath(LEGACY_FILE)
    worlds.emit('changed')
    factions.emit('changed')

    return {
      summary: `Placed ${copies} faction ${copies === 1 ? 'copy' : 'copies'} across ${byWorld.size} ${byWorld.size === 1 ? 'world' : 'worlds'}.`
    }
  }
})
