import {
  Droplets,
  Flame,
  FlaskConical,
  Footprints,
  Heart,
  Package,
  Scroll,
  Shield,
  Shirt,
  Skull,
  Sparkles,
  Swords,
  Zap,
  type LucideIcon
} from 'lucide-react'
import { Stats } from '@shared/game/components'
import type { Catalog, GameEntity } from '@shared/game/core'

export interface GameVisual {
  Icon: LucideIcon
  category: string
  color: string
  border: string
  bg: string
  glow: string
  badge: string
}

const RULES: Array<{ test: RegExp; visual: GameVisual }> = [
  {
    test: /potion|elixir|flask|draught|brew/,
    visual: {
      Icon: FlaskConical,
      category: 'Alchemy',
      color: 'text-tint-green-ink',
      border: 'border-tint-green/50',
      bg: 'bg-tint-green/10',
      glow: 'shadow-[inset_0_0_8px_color-mix(in_srgb,var(--color-ok)_calc(20%*var(--glow)),transparent)]',
      badge: 'border-tint-green/40 bg-tint-green/15 text-tint-green-ink'
    }
  },
  {
    test: /heal|cure|restor|life|regen|well fed/,
    visual: {
      Icon: Heart,
      category: 'Restoration',
      color: 'text-tint-green-ink',
      border: 'border-tint-green/50',
      bg: 'bg-tint-green/10',
      glow: 'shadow-[inset_0_0_8px_color-mix(in_srgb,var(--color-ok)_calc(20%*var(--glow)),transparent)]',
      badge: 'border-tint-green/40 bg-tint-green/15 text-tint-green-ink'
    }
  },
  {
    test: /scroll|tome|parchment|grimoire|book/,
    visual: {
      Icon: Scroll,
      category: 'Arcane',
      color: 'text-tint-purple-ink',
      border: 'border-tint-purple/50',
      bg: 'bg-tint-purple/10',
      glow: 'shadow-[inset_0_0_8px_color-mix(in_srgb,var(--color-tint-purple-ink)_calc(20%*var(--glow)),transparent)]',
      badge: 'border-tint-purple/40 bg-tint-purple/15 text-tint-purple-ink'
    }
  },
  {
    test: /necro|death|decay|curse|dark|poison|venom|toxic/,
    visual: {
      Icon: Skull,
      category: 'Affliction',
      color: 'text-tint-purple-ink',
      border: 'border-tint-purple/50',
      bg: 'bg-tint-purple/10',
      glow: 'shadow-[inset_0_0_8px_color-mix(in_srgb,var(--color-tint-purple-ink)_calc(20%*var(--glow)),transparent)]',
      badge: 'border-tint-purple/40 bg-tint-purple/15 text-tint-purple-ink'
    }
  },
  {
    test: /fire|flame|burn|pyro|torch/,
    visual: {
      Icon: Flame,
      category: 'Fire',
      color: 'text-tint-amber-ink',
      border: 'border-tint-amber/50',
      bg: 'bg-tint-amber/10',
      glow: 'shadow-[inset_0_0_8px_color-mix(in_srgb,var(--color-tint-amber)_calc(20%*var(--glow)),transparent)]',
      badge: 'border-tint-amber/40 bg-tint-amber/15 text-tint-amber-ink'
    }
  },
  {
    test: /water|cold|ice|frost/,
    visual: {
      Icon: Droplets,
      category: 'Frost',
      color: 'text-tint-sky-ink',
      border: 'border-tint-sky/50',
      bg: 'bg-tint-sky/10',
      glow: 'shadow-[inset_0_0_8px_color-mix(in_srgb,var(--color-tint-sky-ink)_calc(20%*var(--glow)),transparent)]',
      badge: 'border-tint-sky/40 bg-tint-sky/15 text-tint-sky-ink'
    }
  },
  {
    test: /light|shock|thunder|zap|spark|static/,
    visual: {
      Icon: Zap,
      category: 'Lightning',
      color: 'text-tint-yellow-ink',
      border: 'border-tint-yellow/50',
      bg: 'bg-tint-yellow/10',
      glow: 'shadow-[inset_0_0_8px_color-mix(in_srgb,rgb(250,204,21)_calc(20%*var(--glow)),transparent)]',
      badge: 'border-tint-yellow/40 bg-tint-yellow/15 text-tint-yellow-ink'
    }
  },
  {
    test: /shield|buckler|ward|armor|armour|protect|guard|stone|hide/,
    visual: {
      Icon: Shield,
      category: 'Defense',
      color: 'text-tint-cyan',
      border: 'border-tint-cyan/50',
      bg: 'bg-tint-cyan/10',
      glow: 'shadow-[inset_0_0_8px_color-mix(in_srgb,var(--color-tint-cyan)_calc(20%*var(--glow)),transparent)]',
      badge: 'border-tint-cyan/40 bg-tint-cyan/15 text-tint-cyan'
    }
  },
  {
    test: /sword|blade|dagger|axe|bow|staff|mace|weapon|strike|slash|shot|claw|bite|fist|attack/,
    visual: {
      Icon: Swords,
      category: 'Combat',
      color: 'text-tint-amber-ink',
      border: 'border-tint-amber/50',
      bg: 'bg-tint-amber/10',
      glow: 'shadow-[inset_0_0_8px_color-mix(in_srgb,var(--color-tint-amber)_calc(20%*var(--glow)),transparent)]',
      badge: 'border-tint-amber/40 bg-tint-amber/15 text-tint-amber-ink'
    }
  },
  {
    test: /robe|leather|mail|plate|chest|vest|boots|cloak|helm/,
    visual: {
      Icon: Shirt,
      category: 'Apparel',
      color: 'text-tint-sky-ink',
      border: 'border-tint-sky/50',
      bg: 'bg-tint-sky/10',
      glow: 'shadow-[inset_0_0_8px_color-mix(in_srgb,var(--color-tint-sky-ink)_calc(20%*var(--glow)),transparent)]',
      badge: 'border-tint-sky/40 bg-tint-sky/15 text-tint-sky-ink'
    }
  },
  {
    test: /ring|amulet|gem|crystal|charm|relic|arcane|focus/,
    visual: {
      Icon: Sparkles,
      category: 'Arcana',
      color: 'text-tint-cyan',
      border: 'border-tint-cyan/50',
      bg: 'bg-tint-cyan/10',
      glow: 'shadow-[inset_0_0_8px_color-mix(in_srgb,var(--color-tint-cyan)_calc(20%*var(--glow)),transparent)]',
      badge: 'border-tint-cyan/40 bg-tint-cyan/15 text-tint-cyan'
    }
  }
]

const DEFAULT_ITEM_VISUAL: GameVisual = {
  Icon: Package,
  category: 'Gear',
  color: 'text-ink/80',
  border: 'border-line/60',
  bg: 'bg-ink/[0.04]',
  glow: 'shadow-[inset_0_0_8px_color-mix(in_srgb,rgb(255,255,255)_calc(5%*var(--glow)),transparent)]',
  badge: 'border-line/60 bg-ink/[0.05] text-dim'
}

export function getGameVisual(label: string, hint = '', fallback: 'item' | 'ability' = 'item'): GameVisual {
  const hay = `${label} ${hint}`.toLowerCase()
  const hit = RULES.find((r) => r.test.test(hay))
  if (hit) return hit.visual
  if (fallback === 'ability') {
    return {
      Icon: Sparkles,
      category: 'Ability',
      color: 'text-tint-cyan',
      border: 'border-tint-cyan/50',
      bg: 'bg-tint-cyan/10',
      glow: 'shadow-[inset_0_0_8px_color-mix(in_srgb,var(--color-tint-cyan)_calc(20%*var(--glow)),transparent)]',
      badge: 'border-tint-cyan/40 bg-tint-cyan/15 text-tint-cyan'
    }
  }
  return DEFAULT_ITEM_VISUAL
}

export function statNumber(entity: GameEntity, catalog: Catalog, nameLike: string, fallback: number): number {
  const stats = entity.comp(Stats)
  if (!stats) return fallback
  const target = nameLike.toLowerCase()
  const hit = catalog.stats().find((s) => s.id.toLowerCase() === target || s.label.toLowerCase() === target)
  return hit ? stats.value(hit.id) : fallback
}

export interface CombatVital {
  key: string
  label: string
  value: string
  Icon: LucideIcon
  toneClass: string
}

export function combatVitalsOf(entity: GameEntity, catalog: Catalog): CombatVital[] {
  const stats = entity.comp(Stats)
  const dex = stats?.value('dexterity') ?? 10
  const mod = Math.floor((dex - 10) / 2)
  const signedMod = `${mod >= 0 ? '+' : ''}${mod}`
  const armour = Math.round(statNumber(entity, catalog, 'armour', statNumber(entity, catalog, 'armor', 10)))
  const speed = Math.round(statNumber(entity, catalog, 'speed', 30))
  const carry = Math.round(statNumber(entity, catalog, 'carry weight', statNumber(entity, catalog, 'carryweight', 90)))
  const belt = Math.round(statNumber(entity, catalog, 'belt slots', statNumber(entity, catalog, 'belt', 4)))
  return [
    { key: 'ac', label: 'Armor', value: `${armour} AC`, Icon: Shield, toneClass: 'border-tint-cyan/40 bg-tint-cyan/10 text-tint-cyan' },
    { key: 'init', label: 'Init', value: signedMod, Icon: Zap, toneClass: 'border-tint-yellow/40 bg-tint-yellow/10 text-tint-yellow-ink' },
    { key: 'speed', label: 'Speed', value: `${speed} ft`, Icon: Footprints, toneClass: 'border-tint-sky/40 bg-tint-sky/10 text-tint-sky-ink' },
    { key: 'carry', label: 'Carry', value: `${carry} lb`, Icon: Package, toneClass: 'border-tint-green/40 bg-tint-green/10 text-tint-green-ink' },
    { key: 'belt', label: 'Belt', value: String(belt), Icon: Sparkles, toneClass: 'border-accent/40 bg-accent/10 text-accent' }
  ]
}
