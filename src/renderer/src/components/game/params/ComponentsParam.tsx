import { useState, useMemo } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Blocks,
  Copy,
  ChevronDown,
  ChevronRight,
  Dices,
  Flame,
  HeartPulse,
  Package,
  RotateCw,
  Search,
  Shield,
  Skull,
  Sparkles,
  Sword,
  Swords,
  Timer,
  TrendingUp,
  Wand2,
  X,
  Zap,
  BatteryMedium,
  Heart,
  BarChart2,
  BookOpen,
  ShieldAlert,
  Sliders
} from 'lucide-react'
import { componentClass, componentsFor, resolveParams, type ComponentClass, type ComponentDef } from '@shared/game/core'
import { Button, Input, Modal, Select } from '../../ui'
import { ParamFields } from '../ParamFields'
import { registerParamEditor, type ParamEditorProps } from './registry'

// ---------------------------------------------------------------------------
// Component Metadata & AI Utility Info
// ---------------------------------------------------------------------------

interface ComponentMeta {
  label: string
  category: string
  categoryKey: 'action' | 'logic' | 'equipment' | 'status' | 'entity' | 'custom'
  badgeColor: string
  borderColor: string
  icon: typeof Blocks
  description: string
  aiNote?: string
}

const KNOWN_COMPONENTS: Record<string, ComponentMeta> = {
  'action.heal': {
    label: 'Heal Target',
    category: 'Recovery',
    categoryKey: 'action',
    badgeColor: 'border-emerald-500/50 text-emerald-400 bg-emerald-950/40',
    borderColor: 'border-emerald-500/40',
    icon: HeartPulse,
    description: 'Restores hit points to the target creature using a dice or stat formula.',
    aiNote: 'Combat AI scores this heavily when self or allies are injured.'
  },
  'action.damage': {
    label: 'Inflict Damage',
    category: 'Offense',
    categoryKey: 'action',
    badgeColor: 'border-rose-500/50 text-rose-400 bg-rose-950/40',
    borderColor: 'border-rose-500/40',
    icon: Flame,
    description: 'Deals damage of a specific damage type (fire, slashing, radiant, etc.) before resistances.',
    aiNote: 'Combat AI calculates damage output against enemy weaknesses and remaining health.'
  },
  'action.applyBuff': {
    label: 'Apply Status / Buff',
    category: 'Status',
    categoryKey: 'status',
    badgeColor: 'border-cyan-500/50 text-cyan-400 bg-cyan-950/40',
    borderColor: 'border-cyan-500/40',
    icon: Sparkles,
    description: 'Applies a buff, debuff, or condition from a template (e.g. Poisoned, Shielded, Blessed).',
    aiNote: 'Evaluated by combat AI for tactical advantage, crowd control, and damage over time.'
  },
  'action.chance': {
    label: 'Dice / Chance Check',
    category: 'Logic & Flow',
    categoryKey: 'logic',
    badgeColor: 'border-amber-500/50 text-amber-400 bg-amber-950/40',
    borderColor: 'border-amber-500/40',
    icon: Dices,
    description: 'Rolls a percentile chance. On success, chains to next pieces; on fail, triggers an alternate event.',
    aiNote: 'Introduces probabilistic effects (e.g. 50% chance to inflict burn or stun).'
  },
  'action.weaponHit': {
    label: 'Weapon Strike',
    category: 'Combat',
    categoryKey: 'action',
    badgeColor: 'border-orange-500/50 text-orange-400 bg-orange-950/40',
    borderColor: 'border-orange-500/40',
    icon: Swords,
    description: 'Hits the target with the weapon this ability is inside, executing weapon damage and OnHit procs.',
    aiNote: 'Core attack building block for physical weapons and multi-strike weapon skills.'
  },
  'action.refill': {
    label: 'Refill Ammo / Charges',
    category: 'Utility',
    categoryKey: 'action',
    badgeColor: 'border-sky-500/50 text-sky-400 bg-sky-950/40',
    borderColor: 'border-sky-500/40',
    icon: RotateCw,
    description: 'Consumes items from inventory to refill an item resource, such as loading ammo into a magazine.',
    aiNote: 'Autonomous AI triggers this to restock depleted weapon charges or magazines.'
  },
  'action.kill': {
    label: 'Instant Kill',
    category: 'Offense',
    categoryKey: 'action',
    badgeColor: 'border-rose-500/50 text-rose-400 bg-rose-950/40',
    borderColor: 'border-rose-500/40',
    icon: Skull,
    description: 'Immediately reduces the target’s health to zero, ignoring damage absorption.',
    aiNote: 'High-threat execution effect.'
  },
  'item.weapon': {
    label: 'Weapon Properties',
    category: 'Equipment',
    categoryKey: 'equipment',
    badgeColor: 'border-amber-500/50 text-amber-400 bg-amber-950/40',
    borderColor: 'border-amber-500/40',
    icon: Sword,
    description: 'Turns this item into a weapon with reach in feet, damage formula, damage type, and equip slots.',
    aiNote: 'Sets optimal engagement distance and damage dice for combat AI.'
  },
  'item.wear': {
    label: 'Wearable Armor & Stats',
    category: 'Equipment',
    categoryKey: 'equipment',
    badgeColor: 'border-cyan-500/50 text-cyan-400 bg-cyan-950/40',
    borderColor: 'border-cyan-500/40',
    icon: Shield,
    description: 'Makes the item wearable in gear slots (chest, head, hands), granting passive stat & resist bonuses.',
    aiNote: 'Equipped by characters based on defensive rating and attribute synergies.'
  },
  'item.resource': {
    label: 'Item Ammo / Charges Pool',
    category: 'Properties',
    categoryKey: 'equipment',
    badgeColor: 'border-cyan-500/50 text-cyan-400 bg-cyan-950/40',
    borderColor: 'border-cyan-500/40',
    icon: BatteryMedium,
    description: 'Internal pool of charges, ammo, or durability on this item that abilities can consume or refill.',
    aiNote: 'Monitored by ability gating and reload actions.'
  },
  'buff.damageOverTime': {
    label: 'Damage Over Time (DoT)',
    category: 'Status Effect',
    categoryKey: 'status',
    badgeColor: 'border-rose-500/50 text-rose-400 bg-rose-950/40',
    borderColor: 'border-rose-500/40',
    icon: Timer,
    description: 'Damages the bearer continuously on a timer or simulation tick for the duration of the buff.',
    aiNote: 'Applies steady combat pressure, factoring into target threat scoring.'
  },
  'buff.statBonus': {
    label: 'Stat Modifier',
    category: 'Status Effect',
    categoryKey: 'status',
    badgeColor: 'border-emerald-500/50 text-emerald-400 bg-emerald-950/40',
    borderColor: 'border-emerald-500/40',
    icon: TrendingUp,
    description: 'Increases or decreases attributes and resistances (e.g. +2 Armour, +5 Max Health, -2 Speed).',
    aiNote: 'Multipliers evaluated by combat AI for buffing allies or debuffing enemies.'
  },
  'ability': {
    label: 'Embedded Ability / Spell',
    category: 'Ability',
    categoryKey: 'action',
    badgeColor: 'border-purple-500/50 text-purple-400 bg-purple-950/40',
    borderColor: 'border-purple-500/40',
    icon: Wand2,
    description: 'A full active ability or spell granted by this item or creature, complete with costs and sub-pieces.',
    aiNote: 'Provides an autonomous tactical skill available in battle and RP.'
  },
  'stats': {
    label: 'Base Attributes',
    category: 'Attributes',
    categoryKey: 'entity',
    badgeColor: 'border-amber-500/50 text-amber-400 bg-amber-950/40',
    borderColor: 'border-amber-500/40',
    icon: BarChart2,
    description: 'Primary attributes and stats (Strength, Dexterity, Intelligence, Wisdom, etc.).'
  },
  'health': {
    label: 'Health Pool',
    category: 'Vitals',
    categoryKey: 'entity',
    badgeColor: 'border-emerald-500/50 text-emerald-400 bg-emerald-950/40',
    borderColor: 'border-emerald-500/40',
    icon: Heart,
    description: 'Hit point pool, death handling, and current/maximum health calculation.'
  },
  'resource': {
    label: 'Resource Pool',
    category: 'Vitals',
    categoryKey: 'entity',
    badgeColor: 'border-cyan-500/50 text-cyan-400 bg-cyan-950/40',
    borderColor: 'border-cyan-500/40',
    icon: Zap,
    description: 'Dedicated resource pool (Mana, Stamina, Energy) spent by abilities and spells.'
  },
  'buffs': {
    label: 'Buffs Container',
    category: 'State',
    categoryKey: 'entity',
    badgeColor: 'border-purple-500/50 text-purple-400 bg-purple-950/40',
    borderColor: 'border-purple-500/40',
    icon: Sparkles,
    description: 'Enables this entity to receive, stack, and track temporary buffs and debuffs.'
  },
  'abilities': {
    label: 'Known Abilities & Spells',
    category: 'State',
    categoryKey: 'entity',
    badgeColor: 'border-purple-500/50 text-purple-400 bg-purple-950/40',
    borderColor: 'border-purple-500/40',
    icon: BookOpen,
    description: 'Spellbook and action repository known to this character or creature.'
  },
  'inventory': {
    label: 'Inventory & Equipment',
    category: 'Gear',
    categoryKey: 'entity',
    badgeColor: 'border-amber-500/50 text-amber-400 bg-amber-950/40',
    borderColor: 'border-amber-500/40',
    icon: Package,
    description: 'Inventory capacity, item stacks, and equipped gear slots.'
  },
  'reaction': {
    label: 'Reaction Trigger',
    category: 'Combat',
    categoryKey: 'entity',
    badgeColor: 'border-orange-500/50 text-orange-400 bg-orange-950/40',
    borderColor: 'border-orange-500/40',
    icon: ShieldAlert,
    description: 'Automatic response actions triggered by incoming combat events (e.g. counterattack on hit).'
  }
}

function getComponentMeta(type: string, Class?: ComponentClass | null): ComponentMeta {
  if (KNOWN_COMPONENTS[type]) return KNOWN_COMPONENTS[type]

  // Fallback for custom or unknown pieces
  const parts = type.split('.')
  const rawName = parts[parts.length - 1] ?? type
  const friendlyName = rawName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  const rawCat = parts.length > 1 ? parts[0].toUpperCase() : 'PIECE'

  return {
    label: friendlyName,
    category: rawCat,
    categoryKey: 'custom',
    badgeColor: 'border-line text-accent bg-black/60',
    borderColor: 'border-line',
    icon: Blocks,
    description: Class?.DESCRIPTION ?? 'Custom building block component.'
  }
}

function getComponentSummary(def: ComponentDef): string {
  const { type, ...v } = def
  if (type === 'action.heal') return `Heals ${v.amount ?? '1d8'} HP`
  if (type === 'action.damage') return `Deals ${v.amount ?? '1d6'} ${v.damageType ? String(v.damageType) : ''} damage`
  if (type === 'action.applyBuff') return `Applies ${v.buff ? String(v.buff) : 'buff'}`
  if (type === 'action.chance') return `${v.percent ?? 50}% chance check`
  if (type === 'action.weaponHit') return `${v.times ?? 1}× weapon strike${v.bonus && v.bonus !== '0' ? ` (+${v.bonus})` : ''}`
  if (type === 'action.refill') return `Refills ${v.resource ?? 'charges'} with ${v.item ?? 'items'}`
  if (type === 'action.kill') return 'Instantly eliminates target'
  if (type === 'item.weapon') return `${v.damage ?? '1d6'} ${v.damageType ?? ''} (${v.range ?? 5} ft)`
  if (type === 'item.wear') {
    const slots = Array.isArray(v.slots) ? v.slots.join(', ') : ''
    return slots ? `Wearable in ${slots}` : 'Wearable armor'
  }
  if (type === 'item.resource') return `${v.label ?? v.id ?? 'Charges'} (Max: ${v.max ?? 10})`
  if (type === 'buff.damageOverTime') return `${v.perHit ?? 'strength'} ${v.damageType ?? ''} every ${v.every ?? 0}s`
  if (type === 'buff.statBonus') {
    const amt = Number(v.amount ?? 0)
    return `${amt >= 0 ? '+' : ''}${amt} ${v.stat ?? 'stat'}`
  }
  if (type === 'ability') return `${v.label ?? v.id ?? 'Ability'}`
  return ''
}

function getHostLabel(host: string): string {
  if (host === 'ability') return 'Ability'
  if (host === 'item') return 'Item'
  if (host === 'buff') return 'Buff'
  if (host === 'entity') return 'Entity'
  return host || 'Entity'
}

// ---------------------------------------------------------------------------
// Component Palette Modal ("Add Building Block")
// ---------------------------------------------------------------------------

interface PaletteModalProps {
  open: boolean
  host: string
  fits: ComponentClass[]
  onSelect: (type: string) => void
  onClose: () => void
}

function ComponentPaletteModal({ open, host, fits, onSelect, onClose }: PaletteModalProps) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const availableMetas = useMemo(() => {
    return fits.map((C) => ({
      type: C.type,
      Class: C,
      meta: getComponentMeta(C.type, C)
    }))
  }, [fits])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const item of availableMetas) {
      set.add(item.meta.categoryKey)
    }
    return ['all', ...Array.from(set)]
  }, [availableMetas])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return availableMetas.filter(({ type, meta }) => {
      if (selectedCategory !== 'all' && meta.categoryKey !== selectedCategory) return false
      if (!q) return true
      return (
        type.toLowerCase().includes(q) ||
        meta.label.toLowerCase().includes(q) ||
        meta.description.toLowerCase().includes(q) ||
        (meta.aiNote && meta.aiNote.toLowerCase().includes(q))
      )
    })
  }, [availableMetas, search, selectedCategory])

  const hostTitle = getHostLabel(host)

  return (
    <Modal open={open} title={`Building Block Library · ${hostTitle}`} onClose={onClose} wide bodyClassName="p-5 flex flex-col gap-4 max-h-[82vh]">
      <div className="flex flex-col gap-1 border-b border-line pb-3">
        <p className="text-[13px] text-dim">
          Select a functional piece to snap into this <span className="font-semibold text-accent">{hostTitle}</span>. Blocks define active effects, weapon stats, passive bonuses, and AI combat behaviors.
        </p>
      </div>

      {/* Search and Category Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-dim pointer-events-none" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blocks by name, effect, or keyword (e.g. heal, fire, ammo, armor)..."
            className="pl-9 h-9 text-[13px]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-2.5 text-dim hover:text-white">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category Filter Buttons (Sharp edged) */}
        {categories.length > 2 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => {
              const active = selectedCategory === cat
              const label =
                cat === 'all'
                  ? `All (${availableMetas.length})`
                  : cat === 'action'
                    ? 'Actions & Spells'
                    : cat === 'equipment'
                      ? 'Equipment & Wear'
                      : cat === 'status'
                        ? 'Status & Buffs'
                        : cat === 'logic'
                          ? 'Logic & Flow'
                          : cat.toUpperCase()
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`h-7 px-2.5 text-[11px] font-mono uppercase tracking-wider transition-colors border ${
                    active
                      ? 'border-accent bg-accent/20 text-accent font-semibold shadow-[inset_0_-2px_0_var(--color-accent)]'
                      : 'border-line bg-black/60 text-dim hover:border-line-hover hover:text-white'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Block Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pr-1 flex-1 min-h-[300px]">
        {filtered.map(({ type, meta }) => {
          const Icon = meta.icon
          return (
            <div
              key={type}
              onClick={() => {
                onSelect(type)
                onClose()
              }}
              className="group flex flex-col justify-between gap-3 p-3.5 border border-line bg-black/60 hover:bg-black/85 hover:border-accent cursor-pointer transition-all duration-150 relative overflow-hidden"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-line bg-black/80 group-hover:border-accent transition-all">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[13.5px] text-white group-hover:text-accent transition-colors">
                      {meta.label}
                    </span>
                    <span className={`px-1.5 py-0.5 border text-[10px] font-mono uppercase tracking-wider ${meta.badgeColor}`}>
                      {meta.category}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-dim opacity-75">{type}</span>
                  <p className="text-[12px] leading-snug text-dim mt-0.5">{meta.description}</p>
                </div>
              </div>

              {meta.aiNote && (
                <div className="flex items-start gap-1.5 bg-black/50 border border-line/50 px-2.5 py-1.5 text-[11px] text-dim">
                  <Zap className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span className="leading-tight">
                    <strong className="text-cyan-300 font-normal">AI Combat Engine: </strong>
                    {meta.aiNote}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-line/40 text-[11px]">
                <span className="text-dim font-mono">Click to snap into {hostTitle}</span>
                <span className="font-mono text-accent opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                  + Add Block →
                </span>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-center text-dim">
            <Blocks className="h-10 w-10 text-dim/40 mb-2" />
            <span className="text-[14px] text-white">No matching building blocks found</span>
            <span className="text-[12px]">Try clearing your search query or switching categories.</span>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Single Building Block Card (Sharp edged cyberpunk style)
// ---------------------------------------------------------------------------

function ComponentCard({
  index,
  total,
  def,
  onChange,
  onRemove,
  onMove,
  onDuplicate,
  nested = false
}: {
  index: number
  total: number
  def: ComponentDef
  onChange: (next: ComponentDef) => void
  onRemove: () => void
  onMove: (by: number) => void
  onDuplicate: () => void
  nested?: boolean
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [showPipeline, setShowPipeline] = useState(false)

  const Class = componentClass(def.type)
  const { type, comps, ...values } = def
  const meta = getComponentMeta(type, Class)
  const Icon = meta.icon
  const inside = Class ? componentsFor(type) : []
  const summary = getComponentSummary(def)

  // Check if this component has execution pipeline parameters (on and emit)
  const isActionPiece = Class && 'on' in Class.PARAMS
  const currentOn = String(values.on ?? (isActionPiece ? 'OnUse' : ''))
  const currentEmit = String(values.emit ?? '')

  // Filter out 'on' and 'emit' so ParamFields only shows functional effect properties
  const functionalSchema = useMemo(() => {
    if (!Class) return {}
    if (!isActionPiece) return Class.PARAMS
    return Object.fromEntries(
      Object.entries(Class.PARAMS).filter(([key]) => key !== 'on' && key !== 'emit')
    )
  }, [Class, isActionPiece])

  const hasFunctionalParams = Object.keys(functionalSchema).length > 0

  return (
    <div
      className={`flex flex-col border ${
        nested ? 'border-line/40 bg-black/40' : 'border-line bg-black/60'
      } transition-colors overflow-hidden`}
    >
      {/* Block Header */}
      <div className="flex items-center gap-2.5 px-3 py-2 bg-black/80 border-b border-line select-none">
        {/* Collapse / Expand Toggle */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-dim hover:text-white p-0.5 transition-colors"
          title={collapsed ? 'Expand block' : 'Collapse block'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {/* Step Badge */}
        <span className="font-mono text-[10.5px] px-1.5 py-0.5 border border-line bg-black text-dim">
          #{String(index + 1).padStart(2, '0')}
        </span>

        {/* Icon & Category Pill */}
        <div className="flex items-center gap-1.5">
          <Icon className="h-4 w-4 text-accent shrink-0" />
          <span className={`px-1.5 py-0.5 border text-[10px] font-mono uppercase tracking-wider ${meta.badgeColor}`}>
            {meta.category}
          </span>
        </div>

        {/* Title & Code Type */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-semibold text-[13px] text-white truncate">{meta.label}</span>
          <span className="font-mono text-[10.5px] text-dim opacity-70 hidden sm:inline truncate">{type}</span>
        </div>

        {/* Collapsed Preview Pill */}
        {collapsed && summary && (
          <span className="font-mono text-[11px] text-accent/90 bg-accent/10 border border-accent/30 px-2 py-0.5 truncate max-w-[200px]">
            {summary}
          </span>
        )}

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {isActionPiece && !collapsed && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Zap className={`h-3.5 w-3.5 ${currentEmit ? 'text-cyan-400' : 'text-dim'}`} />}
              title="Execution trigger & event chaining"
              onClick={() => setShowPipeline(!showPipeline)}
              className={showPipeline ? 'border-accent bg-accent/15 text-accent' : ''}
            />
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<Copy className="h-3.5 w-3.5" />}
            title="Duplicate piece"
            onClick={onDuplicate}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={<ArrowUp className="h-3.5 w-3.5" />}
            title="Move up"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={<ArrowDown className="h-3.5 w-3.5" />}
            title="Move down"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={<X className="h-3.5 w-3.5 hover:text-alert" />}
            title="Remove piece"
            onClick={onRemove}
          />
        </div>
      </div>

      {/* Expanded Block Body */}
      {!collapsed && (
        <div className="flex flex-col gap-3.5 p-3.5">
          {/* Subtitle / Plain English explanation */}
          <div className="flex flex-col gap-1">
            <span className="text-[12px] leading-snug text-dim">
              {Class?.DESCRIPTION ?? meta.description}
            </span>
            {meta.aiNote && (
              <span className="text-[11px] text-cyan-400/90 flex items-center gap-1">
                <Zap className="h-3 w-3 shrink-0" />
                <span>AI Scoring: {meta.aiNote}</span>
              </span>
            )}
          </div>

          {/* Execution & Trigger Pipeline Bar (for Action Pieces) */}
          {isActionPiece && (
            <div className="flex flex-col gap-2 border border-line bg-black/50 p-2.5">
              <div className="flex items-center justify-between text-[11.5px]">
                <div className="flex items-center gap-1.5 text-dim">
                  <Zap className="h-3.5 w-3.5 text-accent" />
                  <span className="font-semibold text-white uppercase tracking-wide text-[11px]">Execution Pipeline</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPipeline(!showPipeline)}
                  className="font-mono text-[11px] text-accent/80 hover:text-accent underline"
                >
                  {showPipeline ? 'Done configuring events' : 'Customize events (OnUse, OnHit, etc.)'}
                </button>
              </div>

              {/* Simplified Pipeline Preview */}
              {!showPipeline && (
                <div className="flex items-center gap-2 text-[12px] font-mono flex-wrap">
                  <span className="text-dim">Runs when:</span>
                  <span className="px-2 py-0.5 bg-accent/15 border border-accent/40 text-accent font-semibold">
                    {currentOn || 'OnUse'}
                  </span>
                  <span className="text-dim">➜</span>
                  <span className="text-dim">Then emits:</span>
                  <span
                    className={`px-2 py-0.5 border ${
                      currentEmit
                        ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300 font-semibold'
                        : 'bg-black/60 border-line text-dim italic'
                    }`}
                  >
                    {currentEmit ? currentEmit : 'Nothing (end of chain)'}
                  </span>
                </div>
              )}

              {/* Advanced Pipeline Editor */}
              {showPipeline && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-line/40">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-mono uppercase text-dim">Event this piece runs on (Trigger)</label>
                    <div className="flex items-center gap-1">
                      <Input
                        value={currentOn}
                        onChange={(e) => onChange({ type, ...values, on: e.target.value, emit: currentEmit, comps })}
                        placeholder="OnUse"
                        className="font-mono text-[12px] h-8"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onChange({ type, ...values, on: 'OnUse', emit: currentEmit, comps })}
                        title="Set to OnUse"
                        className="h-8 text-[11px] px-2 font-mono"
                      >
                        OnUse
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onChange({ type, ...values, on: 'OnHit', emit: currentEmit, comps })}
                        title="Set to OnHit"
                        className="h-8 text-[11px] px-2 font-mono"
                      >
                        OnHit
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-mono uppercase text-dim">Event it emits to next pieces (Chain)</label>
                    <div className="flex items-center gap-1">
                      <Input
                        value={currentEmit}
                        onChange={(e) => onChange({ type, ...values, on: currentOn, emit: e.target.value, comps })}
                        placeholder="Leave empty to end chain"
                        className="font-mono text-[12px] h-8"
                      />
                      {currentEmit && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onChange({ type, ...values, on: currentOn, emit: '', comps })}
                          title="Clear emit"
                          className="h-8 text-[11px] px-2 font-mono"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Functional Parameter Fields */}
          {hasFunctionalParams && (
            <div className="pt-0.5">
              <ParamFields
                schema={functionalSchema}
                values={values}
                onChange={(next) =>
                  onChange({
                    type,
                    ...values,
                    ...next,
                    on: values.on,
                    emit: values.emit,
                    comps
                  })
                }
              />
            </div>
          )}

          {/* Nested Sub-Blocks (e.g. inside an embedded ability) */}
          {inside.length > 0 && (
            <div className="mt-2 flex flex-col gap-2 border border-line bg-black/40 p-3">
              <div className="flex items-center gap-1.5 text-[12px] font-mono text-accent">
                <Sliders className="h-3.5 w-3.5" />
                <span className="uppercase tracking-wide font-semibold text-[11px]">Sub-pieces inside {meta.label}</span>
              </div>
              <ComponentList
                host={type}
                value={Array.isArray(comps) ? (comps as ComponentDef[]) : []}
                onChange={(next) => onChange({ ...def, comps: next })}
                nested
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component List & Flow Orchestrator (Sharp edged)
// ---------------------------------------------------------------------------

function ComponentList({
  host,
  value,
  onChange,
  nested = false
}: {
  host: string
  value: ComponentDef[]
  onChange: (next: ComponentDef[]) => void
  nested?: boolean
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const fits = componentsFor(host)
  const hostTitle = getHostLabel(host)

  const move = (i: number, by: number) => {
    const to = i + by
    if (to < 0 || to >= value.length) return
    const next = [...value]
    ;[next[i], next[to]] = [next[to], next[i]]
    onChange(next)
  }

  const add = (type: string) => {
    const Class = componentClass(type)
    if (Class) {
      onChange([...value, { type, ...resolveParams(Class.PARAMS, {}), comps: [] }])
    }
  }

  const duplicate = (i: number) => {
    const original = value[i]
    if (!original) return
    const copy = JSON.parse(JSON.stringify(original))
    const next = [...value.slice(0, i + 1), copy, ...value.slice(i + 1)]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Existing Blocks List with Flow Connectors */}
      {value.length > 0 ? (
        <div className="flex flex-col">
          {value.map((def, i) => {
            const nextDef = value[i + 1]
            const currEmit = def.emit ? String(def.emit) : ''
            const nextOn = nextDef?.on ? String(nextDef.on) : ''
            const isExplicitChain = currEmit && nextOn && currEmit === nextOn

            return (
              <div key={i} className="flex flex-col">
                <ComponentCard
                  index={i}
                  total={value.length}
                  def={def}
                  onChange={(next) => onChange(value.map((d, j) => (j === i ? next : d)))}
                  onRemove={() => onChange(value.filter((_, j) => j !== i))}
                  onMove={(by) => move(i, by)}
                  onDuplicate={() => duplicate(i)}
                  nested={nested}
                />

                {/* Pipeline Flow Connector between blocks (Sharp badge) */}
                {i < value.length - 1 && (
                  <div className="flex items-center justify-center my-1 relative py-1">
                    <div className="absolute inset-y-0 w-px bg-line/60 -z-0" />
                    <div
                      className={`relative z-10 flex items-center gap-1.5 px-2.5 py-0.5 border text-[10.5px] font-mono uppercase tracking-wider ${
                        isExplicitChain
                          ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                          : 'bg-black border-line text-dim'
                      }`}
                    >
                      <ArrowDown className="h-3 w-3" />
                      <span>{isExplicitChain ? `Chained via "${currEmit}"` : 'Next step'}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Empty State Blueprint Box (Sharp edged) */
        <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-line bg-black/40 px-6 py-8 text-center">
          <div className="flex h-11 w-11 items-center justify-center border border-line bg-black text-accent">
            <Blocks className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-[13.5px] text-white">No building blocks attached yet</span>
            <span className="text-[12px] text-dim max-w-[420px] leading-snug">
              Build this {hostTitle} by snapping pieces together. Add damage, healing, passive armor, or status effects below.
            </span>
          </div>
          <Button
            size="sm"
            variant="badge"
            icon={<Blocks className="h-4 w-4 text-accent" />}
            onClick={() => setModalOpen(true)}
            className="mt-2 font-mono text-[12px]"
          >
            Open Block Library
          </Button>
        </div>
      )}

      {/* Add Building Block Controls (Sharp edged) */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 h-10 px-4 border border-dashed border-accent/50 bg-accent/5 hover:bg-accent/15 hover:border-accent text-accent font-semibold text-[12.5px] uppercase tracking-wider transition-all"
        >
          <Blocks className="h-4 w-4" />
          <span>+ ADD BUILDING BLOCK</span>
          <span className="text-dim font-normal hidden sm:inline text-[11.5px] normal-case">
            (Damage, Healing, Armor, Buffs, Logic...)
          </span>
        </button>

        {/* Quick Add Dropdown for fast workflow */}
        {fits.length > 0 && (
          <div className="w-[180px] shrink-0">
            <Select
              value=""
              options={[
                { value: '', label: 'Quick add…' },
                ...fits.map((C) => {
                  const m = getComponentMeta(C.type, C)
                  return { value: C.type, label: `${m.label} (${C.type})` }
                })
              ]}
              onChange={(type) => type && add(type)}
              className="h-10 text-[12px] bg-black/60 border-line font-mono"
            />
          </div>
        )}
      </div>

      {/* Palette Modal */}
      {modalOpen && (
        <ComponentPaletteModal
          open={modalOpen}
          host={host}
          fits={fits}
          onSelect={(type) => add(type)}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Param Editor Registration
// ---------------------------------------------------------------------------

function ComponentsEdit({ spec, value, onChange }: ParamEditorProps) {
  return (
    <ComponentList
      host={spec.host ?? ''}
      value={Array.isArray(value) ? (value as ComponentDef[]) : []}
      onChange={onChange}
    />
  )
}

registerParamEditor('components', { Editor: ComponentsEdit, wide: true })
