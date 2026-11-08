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
import { usableAbilities, type Ability } from '@shared/game/components'
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

function getAbilityTheme(name: string, damageType?: string) {
  const n = (name + ' ' + (damageType || '')).toLowerCase()
  if (n.includes('fire') || n.includes('flame') || n.includes('burn') || n.includes('pyro')) {
    return {
      Icon: Flame,
      school: 'Evocation (Fire)',
      color: 'text-amber-400',
      border: 'border-amber-500/50',
      bg: 'bg-amber-500/10',
      glow: 'shadow-[0_0_16px_rgba(245,158,11,0.3)]',
      accentHex: '#f59e0b',
      tagBg: 'bg-amber-500/15 border-amber-500/40 text-amber-400'
    }
  }
  if (n.includes('cold') || n.includes('ice') || n.includes('frost') || n.includes('water')) {
    return {
      Icon: Droplets,
      school: 'Evocation (Cold)',
      color: 'text-sky-400',
      border: 'border-sky-500/50',
      bg: 'bg-sky-500/10',
      glow: 'shadow-[0_0_16px_rgba(56,189,248,0.3)]',
      accentHex: '#38bdf8',
      tagBg: 'bg-sky-500/15 border-sky-500/40 text-sky-400'
    }
  }
  if (n.includes('light') || n.includes('shock') || n.includes('thunder') || n.includes('zap') || n.includes('spark')) {
    return {
      Icon: Zap,
      school: 'Evocation (Lightning)',
      color: 'text-yellow-400',
      border: 'border-yellow-500/50',
      bg: 'bg-yellow-500/10',
      glow: 'shadow-[0_0_16px_rgba(250,204,21,0.3)]',
      accentHex: '#facc15',
      tagBg: 'bg-yellow-500/15 border-yellow-500/40 text-yellow-400'
    }
  }
  if (n.includes('shield') || n.includes('ward') || n.includes('armor') || n.includes('protect') || n.includes('guard')) {
    return {
      Icon: Shield,
      school: 'Abjuration',
      color: 'text-cyan',
      border: 'border-cyan/50',
      bg: 'bg-cyan/10',
      glow: 'shadow-[0_0_16px_rgba(102,252,241,0.3)]',
      accentHex: '#66fcf1',
      tagBg: 'bg-cyan/15 border-cyan/40 text-cyan'
    }
  }
  if (n.includes('heal') || n.includes('cure') || n.includes('restor') || n.includes('life')) {
    return {
      Icon: Heart,
      school: 'Evocation (Healing)',
      color: 'text-emerald-400',
      border: 'border-emerald-500/50',
      bg: 'bg-emerald-500/10',
      glow: 'shadow-[0_0_16px_rgba(52,211,153,0.3)]',
      accentHex: '#34d399',
      tagBg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
    }
  }
  if (n.includes('necro') || n.includes('death') || n.includes('decay') || n.includes('curse') || n.includes('dark')) {
    return {
      Icon: Skull,
      school: 'Necromancy',
      color: 'text-purple-400',
      border: 'border-purple-500/50',
      bg: 'bg-purple-500/10',
      glow: 'shadow-[0_0_16px_rgba(192,132,252,0.3)]',
      accentHex: '#c084fc',
      tagBg: 'bg-purple-500/15 border-purple-500/40 text-purple-400'
    }
  }
  if (n.includes('sword') || n.includes('slash') || n.includes('strike') || n.includes('attack') || n.includes('shot')) {
    return {
      Icon: Swords,
      school: 'Combat Maneuver',
      color: 'text-red-400',
      border: 'border-red-500/50',
      bg: 'bg-red-500/10',
      glow: 'shadow-[0_0_16px_rgba(239,68,68,0.3)]',
      accentHex: '#f87171',
      tagBg: 'bg-red-500/15 border-red-500/40 text-red-400'
    }
  }
  return {
    Icon: Sparkles,
    school: 'Transmutation',
    color: 'text-cyan',
    border: 'border-cyan/50',
    bg: 'bg-cyan/10',
    glow: 'shadow-[0_0_16px_rgba(102,252,241,0.25)]',
    accentHex: '#66fcf1',
    tagBg: 'bg-cyan/15 border-cyan/40 text-cyan'
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
  const [selectedUid, setSelectedUid] = useState<string | null>(all[0]?.uid ?? null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'spells' | 'items'>('all')

  const selectedAbility = all.find((a) => a.uid === selectedUid) ?? all[0] ?? null

  const filteredAbilities = useMemo(() => {
    return all.filter((a) => {
      const name = String(a.params.label || a.id).toLowerCase()
      if (search && !name.includes(search.toLowerCase())) return false
      if (filterType === 'spells' && a.item) return false
      if (filterType === 'items' && !a.item) return false
      return true
    })
  }, [all, search, filterType])

  if (!all.length) {
    return (
      <EmptyState title="Nothing to use">
        This character knows no abilities or spells, and nothing they wear or carry gives any.
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

  const handleCast = (a: Ability) => {
    const label = String(a.params.label || a.id)
    const check = a.canUse({ user: entity, target: entity, at: null, distance: 0 })
    if (check !== true) {
      toast.info(label, String(check))
      return
    }

    if (a.reach() > 0 && props.onAim) {
      props.onAim({ uid: a.uid, label })
      props.onClose?.()
      toast.info(label, 'Aiming spell: click a target or location on the map')
      return
    }

    act((e) => {
      const found = usableAbilities(e).find((x) => x.uid === a.uid || x.id === a.id)
      if (!found) return 'spell not found'
      const res = found.use({ user: e, target: e, at: null, distance: 0 })
      if (res === true) {
        toast.info(label, `Cast ${label}`)
        return true
      }
      return res
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
    <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3 min-h-0 text-white">
      {/* 1. LEFT: SPELL LIBRARY & CATALOG */}
      <div className="h-full flex flex-col min-h-0 border border-line/45 bg-[#070b10]">
        {/* Header & Filter Controls */}
        <div className="flex flex-col gap-2.5 border-b border-line/50 bg-black/60 p-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-cyan" />
              <span className="font-mono text-[11.5px] font-bold uppercase tracking-[0.16em] text-cyan">
                Known Spells & Inscribed Abilities
              </span>
              <span className="font-mono text-[10.5px] text-faint">({all.length})</span>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1">
              {(['all', 'spells', 'items'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  className={cn(
                    'px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-all',
                    filterType === t
                      ? 'border border-cyan bg-cyan/20 text-cyan'
                      : 'border border-line/40 bg-black/40 text-faint hover:text-white'
                  )}
                >
                  {t === 'all' ? 'All' : t === 'spells' ? 'Spells' : 'Gear'}
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
              className="w-full border border-line bg-black/80 pl-8 pr-3 py-1 font-mono text-[11px] text-white placeholder-faint focus:border-cyan focus:outline-none"
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
                    ? 'border-cyan bg-cyan/[0.08] shadow-[0_0_14px_rgba(102,252,241,0.25)]'
                    : 'border-line/50 bg-black/40 hover:border-line-bright hover:bg-white/[0.02]',
                  a.cooling > 0 && 'opacity-65'
                )}
              >
                {/* 1:1 Action Bar draggable token */}
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, a)}
                  className={cn(
                    'group/token relative flex h-11 w-11 shrink-0 select-none items-center justify-center border font-mono cursor-grab active:cursor-grabbing transition-transform hover:scale-105',
                    theme.border,
                    theme.bg,
                    theme.color,
                    theme.glow
                  )}
                  title="Drag token to any Action Bar slot"
                >
                  <CardIcon className="h-5 w-5" />
                  <GripVertical className="absolute right-0.5 top-0.5 h-3 w-3 text-faint group-hover/token:text-white" />
                </div>

                {/* Spell Info */}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[13.5px] text-white tracking-wide truncate">
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
                          'flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] font-bold uppercase transition-all',
                          ready === true
                            ? 'border border-cyan bg-cyan/20 text-cyan hover:bg-cyan/35 shadow-[0_0_8px_rgba(102,252,241,0.3)]'
                            : 'border border-line/40 bg-black/40 text-faint cursor-not-allowed opacity-50'
                        )}
                        title={ready === true ? (reach > 0 ? `Cast ${label} (${reach} ft)` : `Cast ${label}`) : String(ready)}
                      >
                        <Play className="h-2.5 w-2.5" />
                        <span>Cast</span>
                      </button>
                      <span className={cn('px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase border', theme.tagBg)}>
                        {theme.school}
                      </span>
                    </div>
                  </div>

                  {/* Tactical Attributes Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                    <span className="border border-line/60 bg-line/20 px-1.5 py-0.5 text-white/90 uppercase">
                      {String(a.params.action || 'action')}
                    </span>

                    <span className="flex items-center gap-1 border border-line/60 bg-line/20 px-1.5 py-0.5 text-dim">
                      <Crosshair className="h-3 w-3 text-cyan/70" />
                      <span>{isSelf ? 'Self' : `${reach} ft`}</span>
                    </span>

                    {damageRow && (
                      <span className="border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-bold text-amber-400">
                        {damageRow.value}
                      </span>
                    )}

                    {healRow && (
                      <span className="border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 font-bold text-emerald-400">
                        {healRow.value}
                      </span>
                    )}

                    {hasCost ? (
                      costEntries.map(([s, n]) => (
                        <span key={s} className="border border-purple/40 bg-purple/10 px-1.5 py-0.5 font-bold text-purple">
                          {n} {catalog.stat(s)?.label ?? s}
                        </span>
                      ))
                    ) : (
                      <span className="border border-line/40 bg-line/10 px-1.5 py-0.5 text-faint">
                        Cantrip / Free
                      </span>
                    )}

                    {a.item && (
                      <span className="ml-auto font-mono text-[9.5px] text-purple">
                        from {itemName(a.item)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 2. RIGHT: GRIMOIRE CODEX INSPECTOR (ARCANE TOME) */}
      <div className="h-full flex flex-col justify-between min-h-0 border border-line/45 bg-[#070b10] p-4 overflow-y-auto">
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
                <span className="text-[17px] font-bold text-white tracking-wide truncate">
                  {selLabel}
                </span>
                <span className={cn('font-mono text-[11px] font-semibold uppercase mt-0.5', selTheme.color)}>
                  {selTheme.school}
                </span>
                {selectedAbility.item && (
                  <span className="font-mono text-[10px] text-purple mt-0.5">
                    Granted by {itemName(selectedAbility.item)}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Specs Matrix */}
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="border border-line/40 bg-black/50 p-2 flex flex-col gap-0.5">
                <span className="text-[9.5px] uppercase tracking-wider text-faint">Casting Time</span>
                <span className="font-bold text-white uppercase">{selAction}</span>
              </div>
              <div className="border border-line/40 bg-black/50 p-2 flex flex-col gap-0.5">
                <span className="text-[9.5px] uppercase tracking-wider text-faint">Range</span>
                <span className="font-bold text-cyan">{selSelf ? 'Self' : `${selReach} feet`}</span>
              </div>
              <div className="border border-line/40 bg-black/50 p-2 flex flex-col gap-0.5">
                <span className="text-[9.5px] uppercase tracking-wider text-faint">Components</span>
                <span className="font-bold text-white">{selLore.components}</span>
              </div>
              <div className="border border-line/40 bg-black/50 p-2 flex flex-col gap-0.5">
                <span className="text-[9.5px] uppercase tracking-wider text-faint">Duration</span>
                <span className="font-bold text-white">{selLore.duration}</span>
              </div>
              {selDamage && (
                <div className="border border-amber-500/40 bg-amber-500/10 p-2 flex flex-col gap-0.5 col-span-2">
                  <span className="text-[9.5px] uppercase tracking-wider text-amber-400/80">Primary Effect</span>
                  <span className="font-bold text-amber-400 text-[13px]">{selDamage}</span>
                </div>
              )}
            </div>

            {/* Mechanical Lore & Description */}
            <div className="flex flex-col gap-2 border border-line/40 bg-black/40 p-3">
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-dim">
                Spell Description & Rules
              </span>
              <p className="text-[12.5px] leading-relaxed text-white/85">
                {selLore.lore}
              </p>
              {selLore.scaling && (
                <p className="text-[11.5px] leading-relaxed text-dim border-t border-line/30 pt-2 italic">
                  {selLore.scaling}
                </p>
              )}
            </div>

            {/* Cooldown Status */}
            {selectedAbility.cooling > 0 && (
              <div className="flex items-center gap-2 border border-line/40 bg-black/50 px-3 py-2 text-[11.5px] text-dim">
                <Clock className="h-4 w-4 text-faint" />
                <span>Cooling down: {gameTime(selectedAbility.cooling)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-faint text-[12px]">
            No spell selected.
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
                'flex items-center justify-center gap-2 py-2.5 font-mono text-[12px] font-bold uppercase tracking-wider transition-all',
                selReady === true
                  ? 'border border-cyan bg-cyan/25 text-cyan hover:bg-cyan/35 shadow-[0_0_14px_rgba(102,252,241,0.4)]'
                  : 'border border-line/40 bg-black/40 text-faint cursor-not-allowed opacity-50'
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
              className="flex items-center justify-center gap-2 border border-line/60 bg-black/60 py-2 font-mono text-[11.5px] font-bold text-white hover:border-cyan hover:text-cyan transition-all"
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
