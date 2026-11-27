import path from 'node:path'
import { EventEmitter } from 'node:events'
import { notFound } from '@shared/errors'
import type { EntityRecord } from '@shared/game/core/GameEntity'
import type { GameSave } from '@shared/game/save'
import { toId } from '@shared/ids'
import type { CreatureDisposition } from '@shared/maps'
import { smallestAt, type Point } from '@shared/shapes'
import { PLACE_TYPE_KEY, worldLink } from '@shared/world'
import {
  cleanSaveNpcState,
  cleanWorldNpc,
  entityRecordToNpcState,
  mergeNpcState,
  npcActorId,
  npcToSheet,
  splitNpcRef,
  type SaveNpcState,
  type WorldNpc
} from '@shared/worldNpcs'
import { notifyActorWhereChange, registerActorSheetSource } from '../actors/sheets'
import { ToolError } from '../tools/types'
import { readJson, writeJson } from '../util/fs'
import { defaultCharacterGameRecord } from './defaultGame'
import { saveInPlay } from './playLayer'
import { saves } from './saves'
import { WorldError, worlds, type WorldLayer } from './store'

export class NpcStore extends EventEmitter {
  fileFor(worldId: string): string {
    return path.join(worlds.folder(worldId), 'npcs.json')
  }

  private readWorldRaw(worldId: string): WorldNpc[] {
    if (!worlds.exists(worldId)) return []
    const raw = readJson<unknown[]>(this.fileFor(worldId), [])
    if (!Array.isArray(raw)) return []
    return raw
      .map((item) => cleanWorldNpc(item))
      .filter((n): n is WorldNpc => n !== null)
      .map((n) => ({ ...n, worldId }))
      .sort((a, b) => a.title.localeCompare(b.title))
  }

  writeWorld(worldId: string, list: WorldNpc[]): void {
    const clean = list
      .map((n) => cleanWorldNpc({ ...n, worldId: undefined }, n.id))
      .filter((n): n is WorldNpc => n !== null)
      .sort((a, b) => a.title.localeCompare(b.title))
    writeJson(this.fileFor(worldId), clean)
    this.emit('changed', worldId)
  }

  hasTemplate(worldId: string, id: string): boolean {
    return this.readWorldRaw(worldId).some((n) => n.id === id)
  }

  list(worldId?: string | null, layer: WorldLayer = 'play'): WorldNpc[] {
    if (worldId) {
      const base = this.readWorldRaw(worldId)
      if (layer !== 'play') return base
      const save = saveInPlay(worldId, false)
      if (!save) return base
      const baseIds = new Set(base.map((n) => n.id))
      const merged: WorldNpc[] = []
      for (const b of base) {
        const next = mergeNpcState(b, save.npcs[b.id], b.id, worldId)
        if (next) merged.push(next)
      }
      for (const [id, st] of Object.entries(save.npcs)) {
        if (baseIds.has(id) || st === null) continue
        const born = mergeNpcState(null, st, id, worldId)
        if (born) merged.push(born)
      }
      return merged.sort((a, b) => a.title.localeCompare(b.title))
    }
    const all: WorldNpc[] = []
    for (const w of worlds.list()) {
      for (const n of this.list(w.id, layer)) all.push(n)
    }
    return all.sort((a, b) => a.title.localeCompare(b.title))
  }

  find(ref: string, worldId?: string | null, layer: WorldLayer = 'play'): WorldNpc | null {
    const split = splitNpcRef(ref)
    const targetWorld = worldId ?? split?.world ?? null
    const clean = (split?.id ?? ref).trim().replace(/^@?npc:/i, '').replace(/^"|"$/g, '')
    if (!clean) return null
    const slug = toId(clean)
    const lower = clean.toLowerCase()
    const all = this.list(targetWorld, layer)
    return (
      all.find((n) => n.id === clean || (slug && n.id === slug)) ??
      all.find((n) => !n.archetype && ((slug && toId(n.title) === slug) || n.title.toLowerCase() === lower)) ??
      all.find((n) => (slug && toId(n.title) === slug) || n.title.toLowerCase() === lower) ??
      null
    )
  }

  get(idOrRef: string, worldId?: string | null, layer: WorldLayer = 'play'): WorldNpc {
    const split = splitNpcRef(idOrRef)
    const targetWorld = worldId ?? split?.world ?? null
    const hit = this.find(idOrRef, targetWorld, layer)
    if (!hit) {
      throw notFound(new ToolError(`No NPC "${split?.id ?? idOrRef}"${targetWorld ? ` in world "${targetWorld}"` : ''}.`))
    }
    return hit
  }

  uniqueId(worldId: string, base: string, extraTaken: Iterable<string> = []): string {
    const stem = toId(base) || base.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'npc'
    const taken = new Set<string>(extraTaken)
    for (const t of this.readWorldRaw(worldId)) taken.add(t.id)
    const save = saveInPlay(worldId, false) ?? saves.current(worldId)
    for (const k of Object.keys(save?.npcs ?? {})) taken.add(k)
    if (!taken.has(stem)) return stem
    let n = 2
    while (taken.has(`${stem}_${n}`)) n++
    return `${stem}_${n}`
  }

  saveTemplate(worldId: string, raw: unknown, previousId: string | null = null): WorldNpc {
    if (!worlds.exists(worldId)) throw new WorldError(`There is no world "${worldId}".`)
    const objRaw = typeof raw === 'object' && raw && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
    const prevClean = previousId ? (splitNpcRef(previousId)?.id ?? previousId) : null
    const rawId = typeof objRaw.id === 'string' && objRaw.id.trim() ? (splitNpcRef(objRaw.id)?.id ?? objRaw.id.trim()) : null
    const existing = this.readWorldRaw(worldId)
    const rest = existing.filter((x) => x.id !== rawId && x.id !== prevClean)
    const desiredId = rawId ?? this.uniqueId(worldId, String(objRaw.title ?? objRaw.name ?? 'npc'), rest.map((x) => x.id))
    const cleaned = cleanWorldNpc({ ...objRaw, id: desiredId, worldId: undefined, updatedAt: Date.now() }, desiredId)
    if (!cleaned) throw new ToolError('Give the NPC a name.')
    const withGame = cleaned.game
      ? cleaned
      : { ...cleaned, game: defaultCharacterGameRecord(cleaned.title, cleaned.id) }
    this.writeWorld(worldId, [...rest, withGame])
    return { ...withGame, worldId }
  }

  removeTemplate(worldId: string, idOrRef: string): void {
    if (!worlds.exists(worldId)) throw new WorldError(`There is no world "${worldId}".`)
    const cleanId = splitNpcRef(idOrRef)?.id ?? idOrRef.trim()
    const all = this.readWorldRaw(worldId)
    const hit = all.find((n) => n.id === cleanId || n.id === toId(cleanId))
    if (!hit) throw notFound(new ToolError(`No NPC "${cleanId}" in world "${worldId}".`))
    this.writeWorld(
      worldId,
      all.filter((n) => n.id !== hit.id)
    )
    const actorId = npcActorId(worldId, hit.id)
    for (const s of saves.all().filter((sv) => sv.world === worldId)) {
      if (!(hit.id in s.npcs) && !Object.values(s.stand).some((m) => actorId in m) && !s.party?.includes(actorId)) continue
      const { [hit.id]: _gone, ...restNpcs } = s.npcs
      saves.write({
        ...s,
        npcs: restNpcs,
        ...(s.party ? { party: s.party.filter((p) => p !== actorId) } : {}),
        stand: Object.fromEntries(
          Object.entries(s.stand).map(([m, list]) => [m, Object.fromEntries(Object.entries(list).filter(([tok]) => tok !== actorId))])
        )
      })
    }
  }

  updateInSave(worldId: string, npcId: string, patch: SaveNpcState): WorldNpc {
    const save = saveInPlay(worldId, true)
    if (!save) throw new WorldError('This world has no save in play.')
    const base = this.readWorldRaw(worldId).find((n) => n.id === npcId) ?? null
    const prev = save.npcs[npcId]
    const prevObj = prev && typeof prev === 'object' ? prev : {}
    const nextState = cleanSaveNpcState({
      ...prevObj,
      ...patch,
      updatedAt: Date.now()
    })
    if (!nextState) throw new WorldError(`Could not save state for NPC "${npcId}".`)
    saves.write({
      ...save,
      npcs: {
        ...save.npcs,
        [npcId]: nextState
      }
    })
    this.emit('changed', worldId)
    const merged = mergeNpcState(base, nextState, npcId, worldId)
    if (!merged) throw new WorldError(`NPC "${npcId}" is unavailable in save.`)
    return merged
  }

  removeInSave(worldId: string, idOrRef: string): GameSave | null {
    const save = saveInPlay(worldId, false)
    if (!save) return null
    const npcId = splitNpcRef(idOrRef)?.id ?? idOrRef.trim()
    const actorId = npcActorId(worldId, npcId)
    const inTemplate = this.hasTemplate(worldId, npcId)
    const nextNpcs: Record<string, SaveNpcState | null> = { ...save.npcs }
    if (inTemplate) nextNpcs[npcId] = null
    else delete nextNpcs[npcId]
    const next = saves.write({
      ...save,
      npcs: nextNpcs,
      ...(save.party ? { party: save.party.filter((p) => p !== actorId) } : {}),
      stand: Object.fromEntries(
        Object.entries(save.stand).map(([m, list]) => [m, Object.fromEntries(Object.entries(list).filter(([tok]) => tok !== actorId))])
      )
    })
    this.emit('changed', worldId)
    return next
  }

  spawnEntityInSave(
    worldId: string,
    map: string,
    creature: EntityRecord,
    faction: string,
    at: Point,
    opts: {
      disposition?: CreatureDisposition
      actions?: string
      decisions?: string
      lootTableId?: string
      sourceTemplateId?: string | null
    } = {}
  ): { save: GameSave; actorId: string; npcId: string } {
    const save = saveInPlay(worldId, true)
    if (!save) throw new WorldError('This world has no save to play in.')
    const rawCandidate = creature.uid.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
    const npcId =
      rawCandidate && !this.hasTemplate(worldId, rawCandidate) && !(rawCandidate in save.npcs)
        ? rawCandidate
        : this.uniqueId(worldId, creature.name || creature.uid)
    const actorId = npcActorId(worldId, npcId)
    const use = worlds.mapUses(worldId).find((u) => u.map === map)
    const placeKey = use ? smallestAt(use.shapes, at) : null
    const where = placeKey ? worldLink(worldId, PLACE_TYPE_KEY, placeKey) : ''
    const entityRecord = creature.uid === npcId ? creature : { ...creature, uid: npcId }
    const state = entityRecordToNpcState(entityRecord, {
      title: creature.name,
      faction,
      disposition: opts.disposition,
      where,
      sourceTemplateId: opts.sourceTemplateId ?? creature.template.id ?? null,
      lootTableId: opts.lootTableId ?? null
    })
    const written = saves.write({
      ...save,
      npcs: { ...save.npcs, [npcId]: state },
      stand: {
        ...save.stand,
        [map]: {
          ...(save.stand[map] ?? {}),
          [actorId]: { at, actions: opts.actions ?? '', decisions: opts.decisions ?? '' }
        }
      }
    })
    this.emit('changed', worldId)
    return { save: written, actorId, npcId }
  }

  updateEntityInSave(worldId: string, creature: EntityRecord, faction?: string): GameSave {
    const save = saveInPlay(worldId, true)
    if (!save) throw new WorldError('This world has no save to play in.')
    const hitEntry = Object.entries(save.npcs).find(
      ([id, st]) => st !== null && (id === creature.uid || st.game?.uid === creature.uid)
    )
    const templateHit = !hitEntry ? this.readWorldRaw(worldId).find((n) => n.id === creature.uid || n.game?.uid === creature.uid) : null
    const npcId = hitEntry?.[0] ?? templateHit?.id
    if (!npcId) throw new WorldError(`${creature.name} is not in this save.`)
    const current = this.get(npcId, worldId, 'play')
    this.updateInSave(worldId, npcId, {
      game: creature,
      ...(faction !== undefined ? { faction: faction || null } : { faction: current.faction })
    })
    return saveInPlay(worldId, false)!
  }
}

export const npcs = new NpcStore()

registerActorSheetSource({
  id: 'world-npc',
  priority: 20,
  owns: (ref) => splitNpcRef(ref) !== null,
  find: (ref, worldHint) => {
    const split = splitNpcRef(ref)
    if (split) {
      if (!worlds.exists(split.world)) return null
      const hit = npcs.find(split.id, split.world, 'play')
      return hit ? npcActorId(split.world, hit.id) : null
    }
    if (!worldHint || !worlds.exists(worldHint)) return null
    const hit = npcs.find(ref, worldHint, 'play')
    return hit ? npcActorId(worldHint, hit.id) : null
  },
  get: (id) => {
    const split = splitNpcRef(id)
    if (!split) throw notFound(new ToolError(`Invalid world NPC reference "${id}".`))
    const npc = npcs.get(split.id, split.world, 'play')
    const ensured = npc.game ? npc : { ...npc, game: defaultCharacterGameRecord(npc.title, npc.id) }
    const rules = worlds.exists(split.world) ? worlds.meta(split.world).rules : ''
    return npcToSheet(ensured, split.world, rules)
  },
  save: (input) => {
    const split = input.id ? splitNpcRef(input.id) : null
    if (!split) throw new ToolError('World NPC save requires a world/npc/id identifier.')
    const current = npcs.find(split.id, split.world, 'play')
    const previousWhere = current?.story.where ?? ''
    const save = saveInPlay(split.world, false)
    const rules = worlds.exists(split.world) ? worlds.meta(split.world).rules : ''
    const nextStory = input.story ?? current?.story
    const nextWhere = nextStory?.where ?? previousWhere

    if (save && !current?.archetype) {
      const updated = npcs.updateInSave(split.world, split.id, {
        title: input.title.trim() || current?.title || split.id,
        fields: input.fields,
        values: input.values,
        ...(input.dnd !== undefined ? { dnd: input.dnd } : {}),
        ...(input.game !== undefined ? { game: input.game } : {}),
        ...(input.gameRules !== undefined ? { gameRules: input.gameRules } : {}),
        ...(input.faction !== undefined ? { faction: input.faction } : {}),
        ...(nextStory ? { story: nextStory } : {}),
        ...(input.mind !== undefined ? { mind: input.mind } : {}),
        ...(input.relationships !== undefined ? { relationships: input.relationships } : {})
      })
      if (nextWhere !== previousWhere) notifyActorWhereChange(npcActorId(split.world, updated.id), nextWhere)
      return npcToSheet(updated, split.world, rules)
    }

    const saved = npcs.saveTemplate(split.world, {
      ...(current ?? {}),
      id: split.id,
      title: input.title.trim() || current?.title || split.id,
      fields: input.fields,
      values: input.values,
      dnd: input.dnd === undefined ? (current?.dnd ?? null) : input.dnd,
      game: input.game === undefined ? (current?.game ?? null) : input.game,
      gameRules: input.gameRules ?? current?.gameRules ?? '',
      faction: input.faction === undefined ? (current?.faction ?? null) : input.faction,
      story: nextStory,
      mind: input.mind === undefined ? (current?.mind ?? null) : input.mind,
      relationships: input.relationships === undefined ? current?.relationships : input.relationships
    })
    if (nextWhere !== previousWhere) notifyActorWhereChange(npcActorId(split.world, saved.id), nextWhere)
    return npcToSheet(saved, split.world, rules)
  },
  setImage: (id, image) => {
    const split = splitNpcRef(id)
    if (!split) throw notFound(new ToolError(`Invalid world NPC reference "${id}".`))
    const current = npcs.get(split.id, split.world, 'play')
    const save = saveInPlay(split.world, false)
    if (save && !current.archetype && !npcs.hasTemplate(split.world, split.id)) {
      npcs.updateInSave(split.world, split.id, { image })
      return
    }
    if (npcs.hasTemplate(split.world, split.id)) {
      const tpl = npcs.get(split.id, split.world, 'template')
      npcs.saveTemplate(split.world, { ...tpl, image }, tpl.id)
    }
    if (save && split.id in save.npcs && save.npcs[split.id] !== null) {
      npcs.updateInSave(split.world, split.id, { image })
    }
  },
  worldsOf: (id) => {
    const split = splitNpcRef(id)
    return split && worlds.exists(split.world) ? [split.world] : []
  },
  campaignOf: (id) => {
    const split = splitNpcRef(id)
    if (!split) return null
    return saveInPlay(split.world, false)?.almanacId ?? null
  }
})
