import '@shared/game/components'
import { effectTargetKey, placedKey, type EffectOutcome, type PlacedRef, type EffectResult, type EffectRun, type EffectTargetRef } from '@shared/effects'
import { Effects, type ActionEvent, type UseContext } from '@shared/game/components'
import { createComponent, GameEntity, type Catalog, type ComponentDef, type ComponentRecord } from '@shared/game/core'
import type { CharacterSheet } from '@shared/types'
import { getSheet, setGame } from '../library/sheets'
import { ToolError } from '../tools/types'
import { triggerActionsStore } from '../triggerActions/store'
import { saveInPlay } from '../worlds/playLayer'
import { saves } from '../worlds/saves'
import { triggerActionEffects } from '@shared/game/triggerActions'
import { effectCatalog } from './catalog'
import { worldAct } from './acts'
import { placedThing } from './placed'
import './acts/flag'
import './acts/loot'

interface Side {
  key: string | null
  token: string | null
  entity: GameEntity
  sheet: CharacterSheet | null
  hittable: boolean
  persist: () => void
}

const bare = (uid: string, name: string, cat: Catalog): GameEntity => new GameEntity(uid, { kind: 'character_template', id: '' }, name, cat)

function sheetSide(id: string, cat: Catalog): Side {
  const s = getSheet(id)
  const entity = s.game ? GameEntity.fromRecord(s.game, cat) : bare(id, s.title, cat)
  entity.link = `@sheet:${id}`
  return { key: `sheet:${id}`, token: id, entity, sheet: s, hittable: !!s.game, persist: () => (s.game ? setGame(id, entity.toRecord()) : undefined) }
}

function creatureSide(uid: string, world: string | null, cat: Catalog): Side {
  const save = world ? saveInPlay(world, true) : null
  const record = save?.creatures.find((c) => c.uid === uid)
  if (!save || !record) throw new ToolError('That creature is not in this save.')
  const entity = GameEntity.fromRecord(record, cat)
  return {
    key: `creature:${uid}`,
    token: uid,
    entity,
    sheet: null,
    hittable: true,
    persist: () => {
      const now = world ? saveInPlay(world, true) : null
      if (!now) return
      const next = entity.toRecord()
      saves.write({ ...now, creatures: now.creatures.map((c) => (c.uid === uid ? { ...c, ...next } : c)) })
    }
  }
}

function built(uid: string, name: string, defs: ComponentDef[], cat: Catalog): GameEntity {
  const entity = bare(uid, name, cat)
  for (const def of defs) {
    const made = createComponent(def)
    if (made) entity.add(made)
  }
  return entity
}

const thingSide = (name: string, cat: Catalog): Side => ({ key: null, token: null, entity: bare('user', name, cat), sheet: null, hittable: true, persist: () => undefined })

function placedSide(at: PlacedRef, world: string | null, cat: Catalog): Side {
  const found = world ? placedThing(world, at.map, at.id) : null
  if (!world || !found) throw new ToolError('That is not on the map.')
  const key = placedKey(at)
  const kept = saveInPlay(world, true)?.placed[key]
  const entity = kept ? GameEntity.fromRecord(kept, cat) : built(key, found.name, found.comps, cat)
  return {
    key,
    token: null,
    entity,
    sheet: null,
    hittable: found.comps.length > 0,
    persist: () => {
      const now = saveInPlay(world, true)
      if (now && found.comps.length) saves.write({ ...now, placed: { ...now.placed, [key]: entity.toRecord() } })
    }
  }
}

function resolveSide(ref: EffectTargetRef, world: string | null, cat: Catalog): Side {
  if (ref.placed) return placedSide(ref.placed, world, cat)
  if (ref.sheet) return sheetSide(ref.sheet, cat)
  if (ref.creature) return creatureSide(ref.creature, world, cat)
  throw new ToolError('There is nothing to target.')
}

const recordDef = (r: ComponentRecord): ComponentDef => ({ type: r.type, ...r.params, comps: r.comps.map(recordDef) })

const MAX_DEPTH = 8

export function runEffects(req: EffectRun): EffectOutcome {
  const cat = effectCatalog()
  if (!cat) throw new ToolError('The game module is not available.')
  const lines: string[] = []
  const view: EffectOutcome['view'] = []
  const dry = req.dry === true
  const stored = (id: string) => {
    const found = triggerActionsStore.get(id)
    return found ? triggerActionEffects(found) : null
  }
  const defs = [...(req.pieces ?? []).map(recordDef), ...(req.defs ?? [])]
  if (req.action) {
    const own = stored(req.action)
    if (!own) throw new ToolError('That trigger action no longer exists.')
    defs.push(...own)
  }
  const user: Side = req.user ? resolveSide(req.user, req.world ?? null, cat) : thingSide('The user', cat)
  const same = effectTargetKey(req.target) !== null && effectTargetKey(req.target) === effectTargetKey(req.user)
  const target = req.target && !same ? resolveSide(req.target, req.world ?? null, cat) : null
  const acted = target ?? user
  const results: EffectResult[] = []
  if (!acted.hittable) return { results, lines, view }
  const addPieces = (host: Effects, list: ComponentDef[]) => {
    for (const def of list) {
      const made = createComponent(def)
      if (made && made.canApply(host) === true) host.add(made)
    }
  }
  const action = new Effects({ id: req.action ?? 'effects' })
  addPieces(action, defs)
  user.entity.add(action)
  user.entity.start()
  if (acted !== user) acted.entity.start()
  try {
    let depth = 0
    const runStored = (id: string, event: ActionEvent): boolean => {
      if (depth >= MAX_DEPTH) return false
      const own = stored(id)
      if (!own) return false
      if (!own.length) return true
      const inner = new Effects({ id })
      addPieces(inner, own)
      user.entity.add(inner)
      depth++
      try {
        inner.fire('OnUse', { ...ctx, target: event.target })
      } finally {
        depth--
        user.entity.remove(inner)
      }
      return true
    }
    const ctx: UseContext = {
      user: user.entity,
      target: acted.entity,
      at: null,
      distance: 0,
      collect: (result) => results.push({ ...result, target: result.target === user.entity.uid ? user.key : result.target === acted.entity.uid ? acted.key : result.target }),
      runStored,
      view: (event) => {
        const side = event.entity === user.entity.uid ? user : acted
        const act = worldAct(event.kind)
        if (!act) return void view.push({ kind: event.kind, data: event.data, target: side.token })
        if (dry) return
        const line = act(event.data, { world: req.world ?? null, target: side.entity, targetKey: side.key, catalog: cat })
        if (line) lines.push(line)
      }
    }
    action.fire('OnUse', ctx)
    if (req.event && req.event !== 'OnUse') action.fire(req.event, ctx)
    if (!dry) {
      user.persist()
      if (acted !== user) acted.persist()
    }
  } finally {
    user.entity.stop()
    if (acted !== user) acted.entity.stop()
  }
  return { results, lines, view }
}
