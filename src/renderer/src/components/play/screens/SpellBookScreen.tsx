import { useMemo, useState } from 'react'
import {
  BookOpen,
  Play,
  GripVertical,
  Flame,
  Droplets,
  Zap,
  Shield,
  Heart,
  Skull,
  Sparkles,
  Crosshair,
  Clock,
  Swords,
  Search,
  Sparkle
} from 'lucide-react'
import { Classes, Traits, usableAbilities, type Ability, type Trait } from '@shared/game/components'
import { EmptyState, openMenu } from '../../ui'
import { cn } from '../../../lib/cn'
import { gameTime } from '../../game/character/panels/time'
import { itemName } from './itemTip'
import { registerGameScreen, type ScreenProps } from './registry'
import {
  ACTION_DRAG_MIME,
  setActionSlot,
  setCompactDragGhost,
  type ActionDragPayload
} from '../hud/actionSlots'
import { toast } from '../../../store/toasts'
import { runAbilityUse } from '../state/combatGate'
import { useGameState } from '../state/gameStateStore'

function getAbilityTheme(name: string, damageType?: string) {
  const n = (name + ' ' + (damageType || '')).toLowerCase()
  if (n.includes('fire') || n.includes('flame') || n.includes('burn') || n.includes('pyro')) {
    return {
      Icon: Flame,
      school: 'Evocation (Fire)',
      color: 'text-tint-amber-ink',
      border: 'border-tint-amber/50',
      bg: 'bg-tint-amber/10',
      glow: 'shadow-[0_0_16px_color-mix(in_srgb,var(--color-tint-amber)_calc(30%*var(--glow)),transparent)]',
      accentHex: '#f59e0b',
      tagBg: 'bg-tint-amber/15 border-tint-amber/40 text-tint-amber-ink'
    }
  }
  if (n.includes('cold') || n.includes('ice') || n.includes('frost') || n.includes('water')) {
    return {
      Icon: Droplets,
      school: 'Evocation (Cold)',
      color: 'text-tint-sky-ink',
      border: 'border-tint-sky/50',
      bg: 'bg-tint-sky/10',
      glow: 'shadow-[0_0_16px_color-mix(in_srgb,var(--color-tint-sky-ink)_calc(30%*var(--glow)),transparent)]',
      accentHex: '#38bdf8',
      tagBg: 'bg-tint-sky/15 border-tint-sky/40 text-tint-sky-ink'
    }
  }
  if (n.includes('light') || n.includes('shock') || n.includes('thunder') || n.includes('zap') || n.includes('spark')) {
    return {
      Icon: Zap,
      school: 'Evocation (Lightning)',
      color: 'text-tint-yellow-ink',
      border: 'border-tint-yellow/50',
      bg: 'bg-tint-yellow/10',
      glow: 'shadow-[0_0_16px_color-mix(in_srgb,rgb(250,204,21)_calc(30%*var(--glow)),transparent)]',
      accentHex: '#facc15',
      tagBg: 'bg-tint-yellow/15 border-tint-yellow/40 text-tint-yellow-ink'
    }
  }
  if (n.includes('shield') || n.includes('ward') || n.includes('armor') || n.includes('protect') || n.includes('guard')) {
    return {
      Icon: Shield,
      school: 'Abjuration',
      color: 'text-tint-cyan',
      border: 'border-tint-cyan/50',
      bg: 'bg-tint-cyan/10',
      glow: 'shadow-[0_0_16px_color-mix(in_srgb,var(--color-tint-cyan)_calc(30%*var(--glow)),transparent)]',
      accentHex: '#66fcf1',
      tagBg: 'bg-tint-cyan/15 border-tint-cyan/40 text-tint-cyan'
    }
  }
  if (n.includes('heal') || n.includes('cure') || n.includes('restor') || n.includes('life')) {
    return {
      Icon: Heart,
      school: 'Evocation (Healing)',
      color: 'text-tint-green-ink',
      border: 'border-tint-green/50',
      bg: 'bg-tint-green/10',
      glow: 'shadow-[0_0_16px_color-mix(in_srgb,var(--color-ok)_calc(30%*var(--glow)),transparent)]',
      accentHex: '#34d399',
      tagBg: 'bg-tint-green/15 border-tint-green/40 text-tint-green-ink'
    }
  }
  if (n.includes('necro') || n.includes('death') || n.includes('decay') || n.includes('curse') || n.includes('dark')) {
    return {
      Icon: Skull,
      school: 'Necromancy',
      color: 'text-tint-purple-ink',
      border: 'border-tint-purple/50',
      bg: 'bg-tint-purple/10',
      glow: 'shadow-[0_0_16px_color-mix(in_srgb,var(--color-tint-purple-ink)_calc(30%*var(--glow)),transparent)]',
      accentHex: '#c084fc',
      tagBg: 'bg-tint-purple/15 border-tint-purple/40 text-tint-purple-ink'
    }
  }
  if (n.includes('sword') || n.includes('slash') || n.includes('strike') || n.includes('attack') || n.includes('shot')) {
    return {
      Icon: Swords,
      school: 'Combat Maneuver',
      color: 'text-tint-red-ink',
      border: 'border-tint-red/50',
      bg: 'bg-tint-red/10',
      glow: 'shadow-[0_0_16px_color-mix(in_srgb,var(--color-alert)_calc(30%*var(--glow)),transparent)]',
      accentHex: '#f87171',
      tagBg: 'bg-tint-red/15 border-tint-red/40 text-tint-red-ink'
    }
  }
  return {
    Icon: Sparkles,
    school: 'Transmutation',
    color: 'text-tint-cyan',
    border: 'border-tint-cyan/50',
    bg: 'bg-tint-cyan/10',
    glow: 'shadow-[0_0_16px_color-mix(in_srgb,var(--color-tint-cyan)_calc(25%*var(--glow)),transparent)]',
    accentHex: '#66fcf1',
    tagBg: 'bg-tint-cyan/15 border-tint-cyan/40 text-tint-cyan'
  }
}

function getSpellLore(name: string, damage?: string, reach?: number) {
  const n = name.toLowerCase()
  if (n.includes('fire bolt') || (n.includes('fire') && n.includes('bolt'))) {
    return {
      lore: 'You hurl a crackling mote of incandescent fire at a creature or object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage. A flammable object hit by this spell ignites if it isn\'t being worn or carried.',
      scaling: 'The spell\'s damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).',
      components: 'V, S (Verbal, Somatic)',
      duration: 'Instantaneous'
    }
  }
  if (n.includes('ray of frost') || (n.includes('frost') && n.includes('ray'))) {
    return {
      lore: 'A frigid beam of blue-white light streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, it takes cold damage and its movement speed is reduced by 10 feet until the start of your next turn.',
      scaling: 'Damage increases to 2d8 at 5th level, 3d8 at 11th level, and 4d8 at 17th level.',
      components: 'V, S (Verbal, Somatic)',
      duration: 'Instantaneous'
    }
  }
  if (n.includes('shocking grasp')) {
    return {
      lore: 'Lightning springs from your hand to deliver a shock to a creature you try to touch. Make a melee spell attack against the target. You have advantage on the attack roll if the target is wearing armor made of metal. On a hit, the target takes lightning damage, and it can\'t take reactions until the start of its next turn.',
      scaling: 'Damage increases to 2d8 at 5th level, 3d8 at 11th level, and 4d8 at 17th level.',
      components: 'V, S',
      duration: 'Instantaneous'
    }
  }
  if (n.includes('cure wounds') || n.includes('heal')) {
    return {
      lore: 'A creature you touch regains hit points equal to 1d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs.',
      scaling: 'When you cast this spell using a spell slot of 2nd level or higher, the healing increases by 1d8 for each slot level above 1st.',
      components: 'V, S',
      duration: 'Instantaneous'
    }
  }
  if (n.includes('shield')) {
    return {
      lore: 'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from magic missile.',
      scaling: 'Cast as a reaction when you are hit by an attack or targeted by magic missile.',
      components: 'V, S',
      duration: '1 round'
    }
  }
  return {
    lore: damage
      ? `Channel magical energy to strike targets up to ${reach || 5} ft away, dealing ${damage} on a successful check.`
      : `Harness arcane power to manipulate the battlefield and affect targets within ${reach || 5} ft.`,
    scaling: 'Scales in potency according to character level and primary casting attribute.',
    components: 'V, S',
    duration: 'Instantaneous'
  }
}

function SpellBookScreen(props: ScreenProps) {
  const { entity, act, visitor, catalog } = props
  const all = usableAbilities(entity)
  const traits = entity.comp(Traits)?.held ?? []
  const heldClasses = entity.comp(Classes)?.held ?? []
  const classTitleOf = (classId: string) =>
    heldClasses.find((c) => c.id === classId)?.title || String(catalog.template('game_class', classId)?.label || classId)

  const [selectedUid, setSelectedUid] = useState<string | null>(all[0]?.uid ?? traits[0]?.uid ?? null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'spells' | 'items' | 'traits'>('all')

  const filteredAbilities = useMemo(() => {
    if (filterType === 'traits') return []
    return all.filter((a) => {
      const name = String(a.params.label || a.id).toLowerCase()
      const src = String(a.params.sourceClass || '').toLowerCase()
      if (search && !name.includes(search.toLowerCase()) && !src.includes(search.toLowerCase())) return false
      if (filterType === 'spells' && a.item) return false
      if (filterType === 'items' && !a.item) return false
      return true
    })
  }, [all, search, filterType])

  const filteredTraits = useMemo(() => {
    if (filterType === 'spells' || filterType === 'items') return []
    const q = search.trim().toLowerCase()
    if (!q) return traits
    return traits.filter((t) => {
      const haystack = `${t.title} ${String(t.params.description || '')} ${t.sourceClass} ${String(t.params.signal || '')}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [traits, search, filterType])

  const selectedTrait: Trait | null = traits.find((t) => t.uid === selectedUid) ?? null
  const selectedAbility = selectedTrait ? null : (all.find((a) => a.uid === selectedUid) ?? (!traits.length ? all[0] : all[0] ?? null))

  if (!all.length && !traits.length) {
    return (
      <EmptyState title="Nothing to use">
        This character knows no abilities, spells, or traits, and nothing they wear or carry gives any.
      </EmptyState>
    )
  }

  // Selected details
  const selReach = selectedAbility?.reach() ?? 0
  const selSelf = selReach === 0
  const selReady = selectedAbility?.canUse({ user: entity, target: entity, at: null, distance: 0 })
  const selLabel = selectedAbility ? String(selectedAbility.params.label || selectedAbility.id) : ''
  const selAction = selectedAbility ? String(selectedAbility.params.action || 'action') : 'action'
  const selRows = selectedAbility ? selectedAbility.comps.flatMap((c) => c.tooltipRows()) : []
  const selDamage = selRows.find((r) => r.label.toLowerCase() === 'damage')?.value
  const selTheme = getAbilityTheme(selLabel, selDamage)
  const SelIcon = selTheme.Icon
  const selLore = getSpellLore(selLabel, selDamage, selReach)

  const world = useGameState((s) => s.world)
  const battle = useGameState((s) => s.battle)

  const handleCast = (a: Ability) => {
    runAbilityUse({
      sheet: visitor.sheet,
      entity,
      ability: a,
      world,
      battle,
      onAim: props.onAim,
      onAimStart: () => {
        props.onClose?.()
        toast.info(String(a.params.label || a.id), 'Aiming spell: click a target or location on the map')
      },
      act: (fn) =>
        act((e) => {
          const res = fn(e)
          if (res === true) {
            const label = String(a.params.label || a.id)
            toast.info(label, `Cast ${label}`)
          }
          return res
        })
    })
  }

  const handleDragStart = (e: React.DragEvent, a: Ability) => {
    const label = String(a.params.label || a.id)
    const rows = a.comps.flatMap((c) => c.tooltipRows())
    const dmg = rows.find((r) => r.label.toLowerCase() === 'damage')?.value
    const theme = getAbilityTheme(label, dmg)

    e.dataTransfer.setData(
      ACTION_DRAG_MIME,
      JSON.stringify({
        kind: 'ability',
        uid: a.uid,
        id: a.id,
        label
      } satisfies ActionDragPayload)
    )
    e.dataTransfer.effectAllowed = 'copyMove'
    setCompactDragGhost(e, label, theme.accentHex)
  }

  const handleOpenSlotMenu = (e: React.MouseEvent, ability: Ability) => {
    e.preventDefault()
    const label = String(ability.params.label || ability.id)
    openMenu(
      e,
      `Assign ${label} to:`,
      Array.from({ length: 9 }, (_, i) => ({
        label: `Action Bar Slot ${i + 1}`,
        onSelect: () => {
          setActionSlot(visitor.sheet, i, {
            kind: 'ability',
            uid: ability.uid,
            id: ability.id,
            label
          })
          toast.info('Action Bar', `Assigned ${label} to Slot ${i + 1}`)
        }
      }))
    )
  }

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3 min-h-0 text-ink">
      {/* 1. LEFT: SPELL LIBRARY & CATALOG */}
      <div className="h-full flex flex-col min-h-0 border border-line/45 bg-surface">
        {/* Header & Filter Controls */}
        <div className="flex flex-col gap-2.5 border-b border-line/50 tone-panel-60 p-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-tint-cyan" />
              <span className="font-label text-[11.5px] font-bold caps-16 text-tint-cyan">
                Known Spells, Abilities & Traits
              </span>
              <span className="font-ui text-[10.5px] text-faint">({all.length + traits.length})</span>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1">
              {(['all', 'spells', 'items', 'traits'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  className={cn(
                    'px-2 py-0.5 font-label text-[10px] font-bold caps-5 transition-all',
                    filterType === t
                      ? 'border border-tint-cyan bg-tint-cyan/20 text-tint-cyan'
                      : 'border border-line/40 tone-well-40 text-faint hover:text-ink'
                  )}
                >
                  {t === 'all' ? 'All' : t === 'spells' ? 'Spells' : t === 'items' ? 'Gear' : 'Traits'}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-faint" />
            <input
              type="text"
              placeholder="Search spells by name or school..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-line tone-panel-80 pl-8 pr-3 py-1 font-ui text-[11px] text-ink placeholder-faint focus:border-tint-cyan focus:outline-none"
            />
          </div>
        </div>

        {/* Spell Cards List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
          {filteredAbilities.map((a) => {
            const label = String(a.params.label || a.id)
            const reach = a.reach()
            const isSelf = reach === 0
            const rows = a.comps.flatMap((c) => c.tooltipRows())
            const damageRow = rows.find((r) => r.label.toLowerCase() === 'damage')
            const healRow = rows.find((r) => r.label.toLowerCase() === 'heal')
            const theme = getAbilityTheme(label, damageRow?.value)
            const CardIcon = theme.Icon
            const isSelected = selectedAbility?.uid === a.uid
            const costEntries = Object.entries(a.cost)
            const hasCost = costEntries.length > 0
            const ready = a.canUse({ user: entity, target: entity, at: null, distance: 0 })

            return (
              <div
                key={a.uid}
                onClick={() => setSelectedUid(a.uid)}
                onContextMenu={(e) => handleOpenSlotMenu(e, a)}
                className={cn(
                  'group relative flex items-start gap-3 border p-3 cursor-pointer transition-all',
                  isSelected
                    ? 'border-tint-cyan bg-tint-cyan/[0.08] shadow-[0_0_14px_color-mix(in_srgb,var(--color-tint-cyan)_calc(25%*var(--glow)),transparent)]'
                    : 'border-line/50 tone-well-40 hover:border-line-strong hover:bg-ink/[0.02]'
                )}
              >
                {/* 1:1 Action Bar draggable token */}
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, a)}
                  className={cn(
                    'group/token relative flex h-11 w-11 shrink-0 select-none items-center justify-center border font-ui cursor-grab active:cursor-grabbing transition-transform hover:scale-105',
                    theme.border,
                    theme.bg,
                    theme.color,
                    theme.glow
                  )}
                  title="Drag token to any Action Bar slot"
                >
                  <CardIcon className="h-5 w-5" />
                  <GripVertical className="absolute right-0.5 top-0.5 h-3 w-3 text-faint group-hover/token:text-ink" />
                </div>

                {/* Spell Info */}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[13.5px] text-ink tracking-wide truncate">
                      {label}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={ready !== true}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCast(a)
                        }}
                        className={cn(
                          'flex items-center gap-1 px-2 py-0.5 font-label text-[10px] font-bold caps transition-all',
                          ready === true
                            ? 'border border-tint-cyan bg-tint-cyan/20 text-tint-cyan hover:bg-tint-cyan/35 shadow-[0_0_8px_color-mix(in_srgb,var(--color-tint-cyan)_calc(30%*var(--glow)),transparent)]'
                            : 'border border-line/40 tone-panel-40 text-faint cursor-not-allowed opacity-50'
                        )}
                        title={ready === true ? (reach > 0 ? `Cast ${label} (${reach} ft)` : `Cast ${label}`) : String(ready)}
                      >
                        <Play className="h-2.5 w-2.5" />
                        <span>Cast</span>
                      </button>
                      <span className={cn('px-1.5 py-0.5 font-label text-[9.5px] font-bold caps border', theme.tagBg)}>
                        {theme.school}
                      </span>
                    </div>
                  </div>

                  {/* Tactical Attributes Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 font-ui text-[10px]">
                    <span className="border border-line/60 bg-line/20 px-1.5 py-0.5 text-ink/90 caps">
                      {String(a.params.action || 'action')}
                    </span>

                    <span className="flex items-center gap-1 border border-line/60 bg-line/20 px-1.5 py-0.5 text-dim">
                      <Crosshair className="h-3 w-3 text-tint-cyan/70" />
                      <span>{isSelf ? 'Self' : `${reach} ft`}</span>
                    </span>

                    {damageRow && (
                      <span className="border border-tint-amber/40 bg-tint-amber/10 px-1.5 py-0.5 font-bold text-tint-amber-ink">
                        {damageRow.value}
                      </span>
                    )}

                    {healRow && (
                      <span className="border border-tint-green/40 bg-tint-green/10 px-1.5 py-0.5 font-bold text-tint-green-ink">
                        {healRow.value}
                      </span>
                    )}

                    {hasCost ? (
                      costEntries.map(([s, n]) => (
                        <span key={s} className="border border-tint-purple/40 bg-tint-purple/10 px-1.5 py-0.5 font-bold text-tint-purple">
                          {n} {catalog.stat(s)?.label ?? s}
                        </span>
                      ))
                    ) : (
                      <span className="border border-line/40 bg-line/10 px-1.5 py-0.5 text-faint">
                        Cantrip / Free
                      </span>
                    )}

                    {a.item && (
                      <span className="ml-auto font-ui text-[9.5px] text-tint-purple">
                        from {itemName(a.item)}
                      </span>
                    )}
                    {Boolean(a.params.sourceClass) && (
                      <span className={cn('border border-tint-cyan/40 bg-tint-cyan/10 px-1.5 py-0.5 font-label text-[9.5px] font-bold caps text-tint-cyan', !a.item && 'ml-auto')}>
                        {classTitleOf(String(a.params.sourceClass))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {filteredTraits.length > 0 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-line/40">
              <div className="font-label text-[10px] font-bold caps-5 text-tint-purple">
                Active & Innate Traits ({filteredTraits.length})
              </div>
              {filteredTraits.map((t) => {
                const active = t.isActive()
                const sig = String(t.params.signal || '')
                const maxUses = Number(t.params.maxUses ?? 0)
                const isSelected = selectedTrait?.uid === t.uid
                return (
                  <div
                    key={t.uid}
                    onClick={() => setSelectedUid(t.uid)}
                    className={cn(
                      'flex items-start gap-3 border p-3 cursor-pointer transition-all',
                      isSelected
                        ? 'border-tint-purple bg-tint-purple/[0.1] shadow-[0_0_14px_color-mix(in_srgb,var(--color-tint-purple-ink)_calc(22%*var(--glow)),transparent)]'
                        : 'border-line/50 tone-well-40 hover:border-line-strong hover:bg-ink/[0.02]',
                      !active && 'opacity-60'
                    )}
                  >
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center border', active ? 'border-tint-purple/60 bg-tint-purple/15 text-tint-purple' : 'border-line/40 tone-panel-60 text-faint')}>
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[13px] text-ink truncate">{t.title}</span>
                        <span className={cn('border px-1.5 py-0.5 font-label text-[9px] font-bold caps', active ? 'border-ok/40 bg-ok/15 text-ok' : 'border-line/50 tone-panel-50 text-faint')}>
                          {t.exhausted ? 'Exhausted' : t.cooldownLeft > 0 ? gameTime(t.cooldownLeft) : active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {Boolean(t.params.description) && (
                        <p className="text-[11.5px] text-dim line-clamp-2">{String(t.params.description)}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 font-ui text-[9.5px]">
                        {t.sourceClass && (
                          <span className="border border-tint-cyan/40 bg-tint-cyan/10 px-1.5 py-0.5 font-bold caps text-tint-cyan">
                            {classTitleOf(t.sourceClass)}
                          </span>
                        )}
                        {sig && (
                          <span className="border border-tint-purple/40 bg-tint-purple/10 px-1.5 py-0.5 text-tint-purple">
                            Trigger: {sig}
                          </span>
                        )}
                        {maxUses > 0 && (
                          <span className="border border-line/50 bg-line/15 px-1.5 py-0.5 text-dim">
                            Uses: {Math.max(0, maxUses - t.uses)}/{maxUses}
                          </span>
                        )}
                        {t.isPermanent && (
                          <span className="border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-accent caps">
                            Permanent
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. RIGHT: GRIMOIRE CODEX INSPECTOR (ARCANE TOME) */}
      <div className="h-full flex flex-col justify-between min-h-0 border border-line/45 bg-surface p-4 overflow-y-auto">
        {selectedAbility ? (
          <div className="flex flex-col gap-4">
            {/* Header Emblem & Title */}
            <div className="flex items-start gap-3.5 border-b border-line/50 pb-3">
              <div
                className={cn(
                  'flex h-14 w-14 shrink-0 items-center justify-center border',
                  selTheme.border,
                  selTheme.bg,
                  selTheme.color,
                  selTheme.glow
                )}
              >
                <SelIcon className="h-7 w-7" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[17px] font-bold text-ink tracking-wide truncate">
                  {selLabel}
                </span>
                <span className={cn('font-label text-[11px] font-semibold caps mt-0.5', selTheme.color)}>
                  {selTheme.school}
                </span>
                {Boolean(selectedAbility.params.sourceClass) && (
                  <span className="font-ui text-[10px] text-tint-cyan mt-0.5">
                    Granted by class {classTitleOf(String(selectedAbility.params.sourceClass))}
                  </span>
                )}
                {selectedAbility.item && (
                  <span className="font-ui text-[10px] text-tint-purple mt-0.5">
                    Granted by {itemName(selectedAbility.item)}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Specs Matrix */}
            <div className="grid grid-cols-2 gap-2 font-ui text-[11px]">
              <div className="border border-line/40 tone-panel-50 p-2 flex flex-col gap-0.5">
                <span className="text-[9.5px] caps-5 text-faint">Casting Time</span>
                <span className="font-bold text-ink caps">{selAction}</span>
              </div>
              <div className="border border-line/40 tone-panel-50 p-2 flex flex-col gap-0.5">
                <span className="text-[9.5px] caps-5 text-faint">Range</span>
                <span className="font-bold text-tint-cyan">{selSelf ? 'Self' : `${selReach} feet`}</span>
              </div>
              <div className="border border-line/40 tone-panel-50 p-2 flex flex-col gap-0.5">
                <span className="text-[9.5px] caps-5 text-faint">Components</span>
                <span className="font-bold text-ink">{selLore.components}</span>
              </div>
              <div className="border border-line/40 tone-panel-50 p-2 flex flex-col gap-0.5">
                <span className="text-[9.5px] caps-5 text-faint">Duration</span>
                <span className="font-bold text-ink">{selLore.duration}</span>
              </div>
              {selDamage && (
                <div className="border border-tint-amber/40 bg-tint-amber/10 p-2 flex flex-col gap-0.5 col-span-2">
                  <span className="text-[9.5px] caps-5 text-tint-amber-ink/80">Primary Effect</span>
                  <span className="font-bold text-tint-amber-ink text-[13px]">{selDamage}</span>
                </div>
              )}
            </div>

            {/* Mechanical Lore & Description */}
            <div className="flex flex-col gap-2 border border-line/40 tone-panel-40 p-3">
              <span className="font-label text-[10.5px] font-bold caps-5 text-dim">
                Spell Description & Rules
              </span>
              <p className="text-[12.5px] leading-relaxed text-ink/85">
                {selLore.lore}
              </p>
              {selLore.scaling && (
                <p className="text-[11.5px] leading-relaxed text-dim border-t border-line/30 pt-2 italic">
                  {selLore.scaling}
                </p>
              )}
            </div>
          </div>
        ) : selectedTrait ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3.5 border-b border-line/50 pb-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-tint-purple/50 bg-tint-purple/10 text-tint-purple">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[17px] font-bold text-ink tracking-wide truncate">{selectedTrait.title}</span>
                <span className="font-label text-[11px] font-semibold caps text-tint-purple mt-0.5">
                  {selectedTrait.isActive() ? 'Active Trait' : 'Inactive Trait'}
                </span>
                {selectedTrait.sourceClass && (
                  <span className="font-ui text-[10px] text-tint-cyan mt-0.5">
                    Granted by class {classTitleOf(selectedTrait.sourceClass)}
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 font-ui text-[11px]">
              <div className="border border-line/40 tone-panel-50 p-2 flex flex-col gap-0.5">
                <span className="text-[9.5px] caps-5 text-faint">Trigger</span>
                <span className="font-bold text-ink">{String(selectedTrait.params.signal || 'Passive')}</span>
              </div>
              <div className="border border-line/40 tone-panel-50 p-2 flex flex-col gap-0.5">
                <span className="text-[9.5px] caps-5 text-faint">Uses</span>
                <span className="font-bold text-tint-cyan">
                  {Number(selectedTrait.params.maxUses ?? 0) > 0
                    ? `${Math.max(0, Number(selectedTrait.params.maxUses) - selectedTrait.uses)}/${Number(selectedTrait.params.maxUses)}`
                    : 'Unlimited'}
                </span>
              </div>
            </div>
            {Boolean(selectedTrait.params.description) && (
              <div className="flex flex-col gap-2 border border-line/40 tone-panel-40 p-3">
                <span className="font-label text-[10.5px] font-bold caps-5 text-dim">
                  Trait Rules
                </span>
                <p className="text-[12.5px] leading-relaxed text-ink/85">
                  {String(selectedTrait.params.description)}
                </p>
              </div>
            )}
            {selectedTrait.cooldownLeft > 0 && (
              <div className="flex items-center gap-2 border border-line/40 tone-panel-50 px-3 py-2 text-[11.5px] text-dim">
                <Clock className="h-4 w-4 text-faint" />
                <span>Cooling down: {gameTime(selectedTrait.cooldownLeft)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-faint text-[12px]">
            No spell or trait selected.
          </div>
        )}

        {/* Action Controls */}
        {selectedAbility && (
          <div className="flex flex-col gap-2 pt-3 border-t border-line/40 mt-4">
            <button
              type="button"
              disabled={selReady !== true}
              onClick={() => handleCast(selectedAbility)}
              className={cn(
                'flex items-center justify-center gap-2 py-2.5 font-label text-[12px] font-bold caps-5 transition-all',
                selReady === true
                  ? 'border border-tint-cyan bg-tint-cyan/25 text-tint-cyan hover:bg-tint-cyan/35 shadow-[0_0_14px_color-mix(in_srgb,var(--color-tint-cyan)_calc(40%*var(--glow)),transparent)]'
                  : 'border border-line/40 tone-panel-40 text-faint cursor-not-allowed opacity-50'
              )}
              title={selReady === true ? 'Cast this spell' : String(selReady)}
            >
              <Play className="h-3.5 w-3.5" />
              <span>
                {selReach > 0 ? `Cast Spell (${selReach} ft Range)` : 'Cast Spell Now'}
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => handleOpenSlotMenu(e, selectedAbility)}
              className="flex items-center justify-center gap-2 border border-line/60 tone-well-60 py-2 font-ui text-[11.5px] font-bold text-ink hover:border-tint-cyan hover:text-tint-cyan transition-all"
            >
              <Sparkle className="h-3.5 w-3.5" />
              <span>Bind to Action Bar</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

registerGameScreen({
  id: 'spellbook',
  label: 'Spell book',
  icon: <BookOpen />,
  key: 'k',
  order: 30,
  Screen: SpellBookScreen
})
