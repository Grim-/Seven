export interface ModuleEntry {
  id: string
  module: string
  name: string
  order: number
}

export interface ModuleList<T extends ModuleEntry> {
  add(entry: T): void
  all(): T[]
  on(isOn: (module: string) => boolean): T[]
  ofModule(module: string): string[]
}

export function moduleList<T extends ModuleEntry>(): ModuleList<T> {
  const list: T[] = []
  return {
    add(entry) {
      const at = list.findIndex((e) => e.id === entry.id)
      if (at >= 0) list[at] = entry
      else list.push(entry)
      list.sort((a, b) => a.order - b.order)
    },
    all: () => list,
    on: (isOn) => list.filter((e) => isOn(e.module)),
    ofModule: (module) => list.filter((e) => e.module === module).map((e) => e.name)
  }
}
