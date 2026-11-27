export interface LookOption {
  slot: string
  id: string
  name: string
  description: string
  standard?: boolean
}

const options = new Map<string, LookOption[]>()

export function registerLookOption(option: LookOption): void {
  const list = (options.get(option.slot) ?? []).filter((o) => o.id !== option.id)
  options.set(option.slot, [...list, option])
}

export function lookSlots(): string[] {
  return [...options.keys()]
}

export function lookOptions(slot: string): LookOption[] {
  return options.get(slot) ?? []
}

export function lookOption(slot: string, id: string | null | undefined): LookOption | null {
  return (id && lookOptions(slot).find((o) => o.id === id)) || null
}

export function standardLook(slot: string): LookOption | null {
  return lookOptions(slot).find((o) => o.standard) ?? null
}
