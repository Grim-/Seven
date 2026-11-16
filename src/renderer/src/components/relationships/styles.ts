import { Box, Calendar, Lightbulb, MapPin, Shield, User, type LucideIcon } from 'lucide-react'
import type { RelationCategory, RelationStance } from '@shared/relationships'

export interface CategoryUi {
  id: RelationCategory
  label: string
  plural: string
  Icon: LucideIcon
  chipClass: string
}

export const CATEGORY_UIS: readonly CategoryUi[] = [
  { id: 'person', label: 'Person', plural: 'People', Icon: User, chipClass: 'border-cyan/40 text-cyan bg-cyan/10' },
  { id: 'place', label: 'Place', plural: 'Places', Icon: MapPin, chipClass: 'border-teal/40 text-teal bg-teal/10' },
  { id: 'thing', label: 'Thing', plural: 'Things', Icon: Box, chipClass: 'border-accent/40 text-accent bg-accent/10' },
  { id: 'faction', label: 'Faction', plural: 'Factions', Icon: Shield, chipClass: 'border-purple/40 text-purple bg-purple/10' },
  { id: 'concept', label: 'Concept', plural: 'Concepts', Icon: Lightbulb, chipClass: 'border-line/70 text-white/85 bg-white/[0.04]' },
  { id: 'event', label: 'Event', plural: 'Events', Icon: Calendar, chipClass: 'border-line/60 text-dim bg-black/40' }
]

export interface StanceUi {
  id: RelationStance
  label: string
  badgeClass: string
}

export const STANCE_UIS: readonly StanceUi[] = [
  { id: 'devoted', label: 'Devoted', badgeClass: 'border-ok/60 bg-ok/20 text-ok' },
  { id: 'allied', label: 'Allied', badgeClass: 'border-ok/40 bg-ok/10 text-ok' },
  { id: 'friendly', label: 'Friendly', badgeClass: 'border-cyan/40 bg-cyan/10 text-cyan' },
  { id: 'neutral', label: 'Neutral', badgeClass: 'border-line/70 bg-transparent text-dim' },
  { id: 'wary', label: 'Wary', badgeClass: 'border-accent/40 bg-accent/10 text-accent' },
  { id: 'unfriendly', label: 'Unfriendly', badgeClass: 'border-accent/65 bg-accent/20 text-accent' },
  { id: 'hostile', label: 'Hostile', badgeClass: 'border-alert/50 bg-alert/15 text-alert' }
]

export function categoryUi(category: RelationCategory): CategoryUi {
  return CATEGORY_UIS.find((c) => c.id === category) ?? CATEGORY_UIS[4]
}

export function stanceUi(stance: RelationStance): StanceUi {
  return STANCE_UIS.find((s) => s.id === stance) ?? STANCE_UIS[3]
}
