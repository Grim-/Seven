import type { WorldEvent } from '@shared/game/worldEvents'

export interface TableSeat {
  key: string
  sheet: string | null
  name: string
  faction: string | null
  role: string
  power: number
}

export function seatsOf(ev: WorldEvent): TableSeat[] {
  return ev.participants.flatMap((p) => {
    const faction = p.factionId || (p.kind === 'faction' ? p.refId ?? null : null) || null
    const base = { faction, role: p.role, power: p.power }
    if (p.kind === 'faction' && p.characters?.length)
      return p.characters.map((sheet) => ({ ...base, key: `${p.id}:${sheet}`, sheet, name: '' }))
    if (p.kind === 'sheet' && p.refId) return [{ ...base, key: p.id, sheet: p.refId, name: '' }]
    return [{ ...base, key: p.id, sheet: null, name: p.name || p.refId || '' }]
  })
}
