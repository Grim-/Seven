export interface Contribution {
  label: string
  items: string[]
}

const byModule = new Map<string, Map<string, Set<string>>>()

export function contribute(module: string, label: string, item: string): void {
  const labels = byModule.get(module) ?? new Map<string, Set<string>>()
  labels.set(label, (labels.get(label) ?? new Set<string>()).add(item))
  byModule.set(module, labels)
}

export function contributionsOf(module: string): Contribution[] {
  return [...(byModule.get(module) ?? new Map<string, Set<string>>())].map(([label, items]) => ({ label, items: [...items].sort() }))
}
