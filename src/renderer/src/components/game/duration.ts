import type { Catalog } from '@shared/game/core'

export interface DurationUnit {
  label: string
  seconds: number
}

export function durationUnits(catalog: Catalog | null): DurationUnit[] {
  const def = catalog?.times()[0] ?? null
  const hour = def?.clock.hourSeconds ?? 3600
  return [
    ...(def ? [{ label: 'rounds', seconds: def.roundSeconds }] : []),
    { label: 'min', seconds: hour / 60 },
    { label: 'h', seconds: hour },
    { label: 'days', seconds: hour * (def?.clock.hoursPerDay ?? 24) }
  ]
}

export function fittingUnit(seconds: number, units: DurationUnit[]): DurationUnit {
  return [...units].reverse().find((u) => seconds > 0 && seconds % u.seconds === 0) ?? units[0]
}

export function durationText(seconds: number, units: DurationUnit[]): string {
  if (!(seconds > 0)) return '—'
  const unit = fittingUnit(seconds, units)
  return `${Math.round((seconds / unit.seconds) * 100) / 100} ${unit.label}`
}
