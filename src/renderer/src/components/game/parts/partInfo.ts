import type { ComponentClass } from '@shared/game/core'

type Described = ComponentClass & { LABEL?: string; ICON?: string; GROUP?: { tone: string } | null }

const humanize = (type: string): string => {
  const last = type.split('.').pop() ?? type
  const words = last.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const partLabel = (Class: ComponentClass | null, type: string): string => (Class as Described | null)?.LABEL ?? humanize(type)

export const partIcon = (Class: ComponentClass | null): string => (Class as Described | null)?.ICON ?? 'Box'

export const partTone = (Class: ComponentClass | null): string => (Class as Described | null)?.GROUP?.tone ?? 'var(--color-accent)'
