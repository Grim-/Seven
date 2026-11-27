export interface PlaceTarget {
  target: string
  label: string
  home: string | null
  asks: boolean
}

const registered = new Map<string, PlaceTarget>()

export function registerPlaceTarget(target: PlaceTarget): void {
  registered.set(target.target, target)
}

export function placeTarget(target: string): PlaceTarget | null {
  return registered.get(target) ?? null
}

export function placeTargets(): PlaceTarget[] {
  return [...registered.values()]
}
