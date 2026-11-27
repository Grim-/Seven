import { useState } from 'react'
import type { MapLink, WorldMapUse } from '@shared/maps'

export function useMapOrganise() {
  const [selection, setSelection] = useState<string[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [linking, setLinking] = useState<string | null>(null)

  const claim = (use: WorldMapUse, key: string): WorldMapUse => (active ? { ...use, layerOf: { ...(use.layerOf ?? {}), [key]: active } } : use)
  const linked = (use: WorldMapUse, from: string, to: string): WorldMapUse =>
    from === to || (use.links ?? []).some((l) => l.from === from && l.to === to) ? use : { ...use, links: [...(use.links ?? []), { id: crypto.randomUUID(), from, to } satisfies MapLink] }
  const unlinked = (use: WorldMapUse, id: string): WorldMapUse => ({ ...use, links: (use.links ?? []).filter((l) => l.id !== id) })

  return { selection, setSelection, active, setActive, linking, setLinking, claim, linked, unlinked }
}
