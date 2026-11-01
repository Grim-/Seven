import { useMemo } from 'react'
import type { CompendiumKind, CompendiumRef } from '@shared/compendium'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'

export interface CompendiumList {
  refs: CompendiumRef[]
  names: string[]
  find: (name: string) => CompendiumRef | null
}

export function useCompendiumList(kind: CompendiumKind): CompendiumList {
  const refs = useLive(() => engine('dnd.list', { kind }), 'dnd.changed')
  return useMemo(() => {
    const list = refs ?? []
    const byName = new Map(list.map((r) => [r.name.toLowerCase(), r]))
    return { refs: list, names: list.map((r) => r.name), find: (name: string) => byName.get(name.trim().toLowerCase()) ?? null }
  }, [refs])
}
