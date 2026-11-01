export function unitText(e: { unit?: string }): string {
  return e.unit?.trim() ?? ''
}

export function targetText(min: number, max: number): string {
  return min === max ? `${max}` : `${min}-${max}`
}

export function doseText(item: { sets: number; min: number; max: number }, unit = ''): string {
  return `${item.sets} × ${targetText(item.min, item.max)}${unit.trim() ? ` ${unit.trim()}` : ''}`
}

export function valuesText(values: number[]): string {
  return values.join(' · ')
}
