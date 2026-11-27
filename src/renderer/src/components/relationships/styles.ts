import { Box, Calendar, Lightbulb, MapPin, Shield, User, type LucideIcon } from 'lucide-react'
import type { RelationCategory, RelationStance } from '@shared/relationships'

export interface CategoryUi {
  id: RelationCategory
  label: string
  plural: string
  Icon: LucideIcon
  chipClass: string
  inkClass: string
}

export const CATEGORY_UIS: readonly CategoryUi[] = [
  { id: 'person', label: 'Person', plural: 'People', Icon: User, chipClass: 'border-secondary-ink/40 text-secondary-ink bg-secondary-ink/10', inkClass: 'text-secondary-ink' },
  { id: 'place', label: 'Place', plural: 'Places', Icon: MapPin, chipClass: 'border-secondary/40 text-secondary bg-secondary/10', inkClass: 'text-secondary' },
  { id: 'thing', label: 'Thing', plural: 'Things', Icon: Box, chipClass: 'border-accent/40 text-accent bg-accent/10', inkClass: 'text-accent' },
  { id: 'faction', label: 'Faction', plural: 'Factions', Icon: Shield, chipClass: 'border-tint-purple/40 text-tint-purple bg-tint-purple/10', inkClass: 'text-tint-purple' },
  { id: 'concept', label: 'Concept', plural: 'Concepts', Icon: Lightbulb, chipClass: 'border-line/70 text-ink/85 bg-ink/[0.04]', inkClass: 'text-ink/85' },
  { id: 'event', label: 'Event', plural: 'Events', Icon: Calendar, chipClass: 'border-line/60 text-dim tone-panel-40', inkClass: 'text-dim' }
]

export interface StanceUi {
  id: RelationStance
  label: string
  badgeClass: string
}

export const STANCE_UIS: readonly StanceUi[] = [
  { id: 'devoted', label: 'Devoted', badgeClass: 'border-ok/60 bg-ok/20 text-ok' },
  { id: 'allied', label: 'Allied', badgeClass: 'border-ok/40 bg-ok/10 text-ok' },
  { id: 'friendly', label: 'Friendly', badgeClass: 'border-secondary-ink/40 bg-secondary-ink/10 text-secondary-ink' },
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
