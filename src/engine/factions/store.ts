import path from 'node:path'
import { EventEmitter } from 'node:events'
import { notFound } from '@shared/errors'
import { toId } from '@shared/ids'
import {
  cleanStoredFaction,
  mergeFactionState,
  splitFactionRef,
  STARTER_FACTIONS,
  type SaveFactionState,
  type StoredFaction
} from '@shared/game/factions'
import { readJson, writeJson } from '../util/fs'
import { ToolError } from '../tools/types'
import { saves } from '../worlds/saves'
import { worlds, type WorldLayer } from '../worlds/store'

export class FactionStore extends EventEmitter {
  fileFor(worldId: string): string {
    return path.join(worlds.folder(worldId), 'factions.json')
  }

  private readWorldRaw(worldId: string): StoredFaction[] {
    if (!worlds.exists(worldId)) return []
    const raw = readJson<unknown[]>(this.fileFor(worldId), [])
    if (!Array.isArray(raw)) return []
    return raw
      .map(cleanStoredFaction)
      .filter((f): f is StoredFaction => f !== null)
      .map((f) => ({ ...f, worldId }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  writeWorld(worldId: string, list: StoredFaction[]): void {
    const clean = list
      .map((f) => cleanStoredFaction({ ...f, worldId: undefined }))
      .filter((f): f is StoredFaction => f !== null)
      .sort((a, b) => a.name.localeCompare(b.name))
    writeJson(this.fileFor(worldId), clean)
    this.emit('changed', worldId)
  }

  list(worldId?: string | null, layer: WorldLayer = 'template'): StoredFaction[] {
    if (worldId) {
      const base = this.readWorldRaw(worldId)
      if (layer !== 'play') return base
      const save = saves.current(worldId)
      if (!save?.factions) return base
      return base.map((f) => mergeFactionState(f, save.factions?.[f.id]))
    }
    const all: StoredFaction[] = []
    for (const w of worlds.list()) {
      for (const f of this.list(w.id, layer)) all.push(f)
    }
    return all.sort((a, b) => a.name.localeCompare(b.name))
  }

  get(idOrRef: string, worldId?: string | null, layer: WorldLayer = 'template'): StoredFaction {
    const split = splitFactionRef(idOrRef)
    const targetWorld = worldId ?? split?.world ?? null
    const cleanId = split?.id ?? toId(idOrRef)
    const hit = this.list(targetWorld, layer).find((f) => f.id === cleanId || f.id === idOrRef)
    if (!hit) throw notFound(new ToolError(`No faction "${cleanId}"${targetWorld ? ` in world "${targetWorld}"` : ''}.`))
    return hit
  }

  find(ref: string, worldId?: string | null, layer: WorldLayer = 'template'): StoredFaction | null {
    const split = splitFactionRef(ref)
    const targetWorld = worldId ?? split?.world ?? null
    const clean = (split?.id ?? ref).trim().replace(/^@?faction:/i, '').replace(/^"|"$/g, '')
    const id = toId(clean)
    const all = this.list(targetWorld, layer)
    return all.find((f) => f.id === id || f.id === clean) ?? all.find((f) => toId(f.name) === id) ?? null
  }

  save(raw: unknown, worldId?: string | null, previousId: string | null = null): StoredFaction {
    const split = typeof raw === 'object' && raw && typeof (raw as { id?: unknown }).id === 'string'
      ? splitFactionRef((raw as { id: string }).id)
      : null
    const targetWorld =
      worldId ||
      (typeof raw === 'object' && raw && typeof (raw as { worldId?: unknown }).worldId === 'string'
        ? (raw as { worldId: string }).worldId
        : null) ||
      split?.world ||
      null
    if (!targetWorld || !worlds.exists(targetWorld)) {
      throw new ToolError('Pick a valid world for this faction.')
    }
    const prevSplit = previousId ? splitFactionRef(previousId) : null
    const prevClean = prevSplit?.id ?? previousId
    const f = cleanStoredFaction({
      ...(typeof raw === 'object' && raw ? (raw as Record<string, unknown>) : {}),
      ...(split?.id ? { id: split.id } : {}),
      worldId: undefined
    })
    if (!f) throw new ToolError('Give the faction a name.')
    const rest = this.readWorldRaw(targetWorld).filter((x) => x.id !== f.id && x.id !== prevClean)
    this.writeWorld(targetWorld, [...rest, f])
    return { ...f, worldId: targetWorld }
  }

  remove(idOrRef: string, worldId?: string | null): void {
    const split = splitFactionRef(idOrRef)
    const targetWorld = worldId ?? split?.world ?? null
    const cleanId = split?.id ?? toId(idOrRef)
    if (!targetWorld) throw new ToolError('Pick a world when removing a faction.')
    const all = this.readWorldRaw(targetWorld)
    if (!all.some((f) => f.id === cleanId)) throw notFound(new ToolError(`No faction "${cleanId}" in world "${targetWorld}".`))
    this.writeWorld(
      targetWorld,
      all.filter((f) => f.id !== cleanId)
    )
  }

  seedStarters(worldId: string): StoredFaction[] {
    if (!worlds.exists(worldId)) throw new ToolError(`No world "${worldId}".`)
    const existing = this.readWorldRaw(worldId)
    const existingIds = new Set(existing.map((f) => f.id))
    const added = STARTER_FACTIONS.filter((s) => !existingIds.has(s.id)).map((s) => ({
      ...s,
      updatedAt: Date.now()
    }))
    if (added.length) this.writeWorld(worldId, [...existing, ...added])
    return this.list(worldId, 'template')
  }

  updateInSave(worldId: string, factionId: string, patch: SaveFactionState): StoredFaction {
    const save = saves.current(worldId)
    if (!save) throw new ToolError('Start or select a save before changing a faction’s live play state.')
    const base = this.get(factionId, worldId, 'template')
    const current = save.factions?.[base.id] ?? {}
    const nextState: SaveFactionState = {
      ...current,
      ...patch,
      ...(patch.relations || current.relations ? { relations: { ...(current.relations ?? {}), ...(patch.relations ?? {}) } } : {}),
      ...(patch.relationNotes || current.relationNotes
        ? { relationNotes: { ...(current.relationNotes ?? {}), ...(patch.relationNotes ?? {}) } }
        : {})
    }
    saves.change(save.id, (s) => ({
      ...s,
      factions: {
        ...(s.factions ?? {}),
        [base.id]: nextState
      }
    }))
    this.emit('changed', worldId)
    return mergeFactionState(base, nextState)
  }
}

export const factions = new FactionStore()
