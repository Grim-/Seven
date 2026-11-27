import { layerDescendants, type ConditionGating, type MapUseLayer, type WorldMapUse } from '@shared/maps'

export type LayerPatch = Pick<WorldMapUse, 'layers' | 'layerOf'>

const parts = (use: WorldMapUse): { layers: MapUseLayer[]; layerOf: Record<string, string> } => ({ layers: use.layers ?? [], layerOf: use.layerOf ?? {} })

export function addLayer(use: WorldMapUse, parent: string | null): { patch: LayerPatch; id: string } {
  const { layers, layerOf } = parts(use)
  const id = crypto.randomUUID()
  return { id, patch: { layers: [...layers, { id, name: `Layer ${layers.length + 1}`, parent, gating: {} }], layerOf } }
}

export function changeUseLayer(use: WorldMapUse, id: string, change: Partial<Pick<MapUseLayer, 'name' | 'gating'>>): LayerPatch {
  const { layers, layerOf } = parts(use)
  return { layers: layers.map((l) => (l.id === id ? { ...l, ...change } : l)), layerOf }
}

export function deleteUseLayer(use: WorldMapUse, id: string): LayerPatch {
  const { layers, layerOf } = parts(use)
  const gone = layers.find((l) => l.id === id)
  const up = gone?.parent ?? null
  return {
    layers: layers.filter((l) => l.id !== id).map((l) => (l.parent === id ? { ...l, parent: up } : l)),
    layerOf: Object.fromEntries(Object.entries(layerOf).flatMap(([k, l]) => (l !== id ? [[k, l]] : up ? [[k, up]] : [])))
  }
}

export function putThings(use: WorldMapUse, things: string[], layer: string | null): LayerPatch {
  const { layers, layerOf } = parts(use)
  const next = { ...layerOf }
  for (const key of things) {
    if (layer) next[key] = layer
    else delete next[key]
  }
  return { layers, layerOf: next }
}

export function nestLayer(use: WorldMapUse, id: string, parent: string | null): LayerPatch | null {
  const { layers, layerOf } = parts(use)
  if (parent && layerDescendants(layers, id).has(parent)) return null
  return { layers: layers.map((l) => (l.id === id ? { ...l, parent } : l)), layerOf }
}

export function dropThing(use: WorldMapUse, key: string): LayerPatch | null {
  const { layers, layerOf } = parts(use)
  if (!(key in layerOf)) return null
  const { [key]: _gone, ...rest } = layerOf
  return { layers, layerOf: rest }
}

export function layerFlags(use: WorldMapUse): string[] {
  return (use.layers ?? []).flatMap((l: { gating: ConditionGating }) => [l.gating.needsFlag, l.gating.hiddenIfFlag].filter((f): f is string => Boolean(f)))
}
