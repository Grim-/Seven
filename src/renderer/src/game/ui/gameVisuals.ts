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
      color: 'text-emerald-400',
      border: 'border-emerald-500/50',
      bg: 'bg-emerald-500/10',
      glow: 'shadow-[inset_0_0_8px_rgba(52,211,153,0.2)]',
      badge: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
    }
  },
  {
    test: /heal|cure|restor|life|regen|well fed/,
    visual: {
      Icon: Heart,
      category: 'Restoration',
      color: 'text-emerald-400',
      border: 'border-emerald-500/50',
      bg: 'bg-emerald-500/10',
      glow: 'shadow-[inset_0_0_8px_rgba(52,211,153,0.2)]',
      badge: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
    }
  },
  {
    test: /scroll|tome|parchment|grimoire|book/,
    visual: {
      Icon: Scroll,
      category: 'Arcane',
      color: 'text-purple-400',
      border: 'border-purple-500/50',
      bg: 'bg-purple-500/10',
      glow: 'shadow-[inset_0_0_8px_rgba(192,132,252,0.2)]',
      badge: 'border-purple-500/40 bg-purple-500/15 text-purple-300'
    }
  },
  {
    test: /necro|death|decay|curse|dark|poison|venom|toxic/,
    visual: {
      Icon: Skull,
      category: 'Affliction',
      color: 'text-purple-400',
      border: 'border-purple-500/50',
      bg: 'bg-purple-500/10',
      glow: 'shadow-[inset_0_0_8px_rgba(192,132,252,0.2)]',
      badge: 'border-purple-500/40 bg-purple-500/15 text-purple-300'
    }
  },
  {
    test: /fire|flame|burn|pyro|torch/,
    visual: {
      Icon: Flame,
      category: 'Fire',
      color: 'text-amber-400',
      border: 'border-amber-500/50',
      bg: 'bg-amber-500/10',
      glow: 'shadow-[inset_0_0_8px_rgba(245,158,11,0.2)]',
      badge: 'border-amber-500/40 bg-amber-500/15 text-amber-300'
    }
  },
  {
    test: /water|cold|ice|frost/,
    visual: {
      Icon: Droplets,
      category: 'Frost',
      color: 'text-sky-400',
      border: 'border-sky-500/50',
      bg: 'bg-sky-500/10',
      glow: 'shadow-[inset_0_0_8px_rgba(56,189,248,0.2)]',
      badge: 'border-sky-500/40 bg-sky-500/15 text-sky-300'
    }
  },
  {
    test: /light|shock|thunder|zap|spark|static/,
    visual: {
      Icon: Zap,
      category: 'Lightning',
      color: 'text-yellow-400',
      border: 'border-yellow-500/50',
      bg: 'bg-yellow-500/10',
      glow: 'shadow-[inset_0_0_8px_rgba(250,204,21,0.2)]',
      badge: 'border-yellow-500/40 bg-yellow-500/15 text-yellow-300'
    }
  },
  {
    test: /shield|buckler|ward|armor|armour|protect|guard|stone|hide/,
    visual: {
      Icon: Shield,
      category: 'Defense',
      color: 'text-cyan',
      border: 'border-cyan/50',
      bg: 'bg-cyan/10',
      glow: 'shadow-[inset_0_0_8px_rgba(102,252,241,0.2)]',
      badge: 'border-cyan/40 bg-cyan/15 text-cyan'
    }
  },
  {
    test: /sword|blade|dagger|axe|bow|staff|mace|weapon|strike|slash|shot|claw|bite|fist|attack/,
    visual: {
      Icon: Swords,
      category: 'Combat',
      color: 'text-amber-400',
      border: 'border-amber-500/50',
      bg: 'bg-amber-500/10',
      glow: 'shadow-[inset_0_0_8px_rgba(245,158,11,0.2)]',
      badge: 'border-amber-500/40 bg-amber-500/15 text-amber-300'
    }
  },
  {
    test: /robe|leather|mail|plate|chest|vest|boots|cloak|helm/,
    visual: {
      Icon: Shirt,
      category: 'Apparel',
      color: 'text-sky-400',
      border: 'border-sky-500/50',
      bg: 'bg-sky-500/10',
      glow: 'shadow-[inset_0_0_8px_rgba(56,189,248,0.2)]',
      badge: 'border-sky-500/40 bg-sky-500/15 text-sky-300'
    }
  },
  {
    test: /ring|amulet|gem|crystal|charm|relic|arcane|focus/,
    visual: {
      Icon: Sparkles,
      category: 'Arcana',
      color: 'text-cyan',
      border: 'border-cyan/50',
      bg: 'bg-cyan/10',
      glow: 'shadow-[inset_0_0_8px_rgba(102,252,241,0.2)]',
      badge: 'border-cyan/40 bg-cyan/15 text-cyan'
    }
  }
]

const DEFAULT_ITEM_VISUAL: GameVisual = {
  Icon: Package,
  category: 'Gear',
  color: 'text-white/80',
  border: 'border-line/60',
  bg: 'bg-white/[0.04]',
  glow: 'shadow-[inset_0_0_8px_rgba(255,255,255,0.05)]',
  badge: 'border-line/60 bg-white/[0.05] text-dim'
}

export function getGameVisual(label: string, hint = '', fallback: 'item' | 'ability' = 'item'): GameVisual {
  const hay = `${label} ${hint}`.toLowerCase()
  const hit = RULES.find((r) => r.test.test(hay))
  if (hit) return hit.visual
  if (fallback === 'ability') {
    return {
      Icon: Sparkles,
      category: 'Ability',
      color: 'text-cyan',
      border: 'border-cyan/50',
      bg: 'bg-cyan/10',
      glow: 'shadow-[inset_0_0_8px_rgba(102,252,241,0.2)]',
      badge: 'border-cyan/40 bg-cyan/15 text-cyan'
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
    { key: 'ac', label: 'Armor', value: `${armour} AC`, Icon: Shield, toneClass: 'border-cyan/40 bg-cyan/10 text-cyan' },
    { key: 'init', label: 'Init', value: signedMod, Icon: Zap, toneClass: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400' },
    { key: 'speed', label: 'Speed', value: `${speed} ft`, Icon: Footprints, toneClass: 'border-sky-500/40 bg-sky-500/10 text-sky-300' },
    { key: 'carry', label: 'Carry', value: `${carry} lb`, Icon: Package, toneClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
    { key: 'belt', label: 'Belt', value: String(belt), Icon: Sparkles, toneClass: 'border-accent/40 bg-accent/10 text-accent' }
  ]
}
