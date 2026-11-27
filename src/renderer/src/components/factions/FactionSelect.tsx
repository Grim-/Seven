import { useMemo } from 'react'
import type { StoredFaction } from '@shared/game/factions'
import { BrowsePick } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'

export function assignFaction(sheet: string, faction: string | null): Promise<void> {
  return engine('sheets.setFaction', { id: sheet, faction })
    .then(() => toast.success('Faction Updated', `Assigned to ${faction ?? 'no faction'}.`))
    .catch(failed('Could not change faction'))
}

export function FactionSelect({
  value,
  onChange,
  worldId,
  placeholder = 'Independent (No Faction)',
  className
}: {
  value: string | null
  onChange: (faction: string | null) => void
  worldId?: string
  placeholder?: string
  className?: string
}) {
  const factions: StoredFaction[] =
    useLive(
      () => engine('factions.list', worldId ? { world: worldId } : undefined),
      'factions.changed',
      [worldId ?? '']
    ) ?? []

  const options = useMemo(
    () =>
      factions.map((f) => ({
        value: f.id,
        label: f.name,
        group: f.defaultStance.charAt(0).toUpperCase() + f.defaultStance.slice(1),
        note: f.description ? f.description.slice(0, 64) : f.defaultStance
      })),
    [factions]
  )

  return (
    <BrowsePick
      value={value}
      options={options}
      placeholder={placeholder}
      clearable
      onChange={onChange}
      className={className}
    />
  )
}
