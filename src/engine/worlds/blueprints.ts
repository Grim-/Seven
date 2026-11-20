import type { BlueprintRow, BlueprintSource } from '@shared/game/blueprints'
import type { GameSave } from '@shared/game/save'
import type { Point } from '@shared/shapes'
import type { Template, EntityRecord } from '@shared/game/core/GameEntity'
import { spawn, type Catalog } from '@shared/game/core'
import { spawnCreature } from './creatures'
import { WorldError } from './store'
import { contribute } from '../modules/contributions'

export interface BlueprintProvider extends BlueprintSource {
  module: string
  has?(id: string): boolean
  search(query: string, limit: number): BlueprintRow[]
  template(id: string, catalog: Catalog): Template
  catalog(): Catalog
}

const providers: BlueprintProvider[] = []

export function registerBlueprintProvider(provider: BlueprintProvider): void {
  const at = providers.findIndex((p) => p.id === provider.id)
  if (at >= 0) providers[at] = provider
  else providers.push(provider)
  contribute(provider.module, 'Bestiary', provider.label)
}

function provider(id: string): BlueprintProvider {
  const hit = providers.find((p) => p.id === id)
  if (!hit) throw new WorldError(`There is no bestiary "${id}".`)
  return hit
}

export function blueprintSources(): BlueprintSource[] {
  return providers.map((p) => ({ id: p.id, label: p.label }))
}

export function searchBlueprints(source: string, query: string, limit: number): BlueprintRow[] {
  return provider(source).search(query, limit)
}

function rawId(source: string, id: string): string {
  const prefix = `${source}:`
  return id.startsWith(prefix) ? id.slice(prefix.length) : id
}

export function blueprintSourceOf(id: string): string | null {
  if (!id) return null
  const colon = id.indexOf(':')
  if (colon > 0) {
    const prefix = id.slice(0, colon)
    if (providers.some((p) => p.id === prefix)) return prefix
  }
  for (const p of providers) {
    if (p.has?.(id)) return p.id
  }
  for (const p of providers) {
    if (p.search(id.replace(/[-_]/g, ' '), 50).some((r) => r.id === id)) return p.id
  }
  return null
}

export function blueprintCatalog(source: string): Catalog {
  return provider(source).catalog()
}

export function blueprintCreature(source: string, id: string, name: string): EntityRecord {
  const from = provider(source)
  const catalog = from.catalog()
  const template = from.template(rawId(source, id), catalog)
  const entity = spawn({ ...template, name: name.trim() || template.name }, catalog)
  const record = entity.toRecord()
  entity.stop()
  return record
}

export function spawnBlueprint(world: string, map: string, source: string, id: string, name: string, faction: string, at: Point): GameSave {
  return spawnCreature(world, map, blueprintCreature(source, id, name), faction, at)
}
