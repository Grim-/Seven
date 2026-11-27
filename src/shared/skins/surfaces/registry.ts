export interface SkinSurfaceDef {
  id: string
  label: string
  group: string
}

const surfaces = new Map<string, SkinSurfaceDef>()

export function registerSurface(def: SkinSurfaceDef): void {
  surfaces.set(def.id, def)
}

export function skinSurfaces(): SkinSurfaceDef[] {
  return [...surfaces.values()]
}

export function isSkinSurface(id: string): boolean {
  return surfaces.has(id)
}
