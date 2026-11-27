import { useState } from 'react'
import {
  Shield,
  Zap,
  Footprints,
  Weight,
  Sparkles,
  Search,
  Flame,
  Swords,
  Heart
} from 'lucide-react'
import { Buffs, Stats, resourcesOf } from '@shared/game/components'
import { BUFF_TEMPLATES } from '@shared/game/defs'
import { checkBonus } from '@shared/game/rules'
import { cn } from '../../../lib/cn'
import { gameTime } from '../../game/character/panels/time'
import { registerGameScreen, type ScreenProps } from './registry'
import { toast } from '../../../store/toasts'

const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`
const round = (n: number) => Math.round(n * 100) / 100

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1
}

function CharacterScreen({ entity, catalog }: ScreenProps) {
  const stats = entity.comp(Stats)
  const buffs = entity.comp(Buffs)?.held ?? []
  const checks = catalog.checks()
  const resources = resourcesOf(entity)

  const [filterSkill, setFilterSkill] = useState('')

  // Split stats by domain
  const allStats = catalog.stats()
  const attributes = allStats.filter((d) => d.domain.toLowerCase() === 'attribute')
  const resistStats = allStats.filter((d) => d.domain.toLowerCase() === 'resist')

  // Combat vitals
  const getStatVal = (idLike: string) => {
    if (!stats) return 0
    const found = allStats.find(
      (s) => s.id.toLowerCase() === idLike.toLowerCase() || s.label.toLowerCase() === idLike.toLowerCase()
    )
    return found ? stats.value(found.id) : 0
  }

  const armour = getStatVal('armour') || getStatVal('armor') || 10
  const speed = getStatVal('speed') || 30
  const carryWeight = getStatVal('carry weight') || getStatVal('carryweight') || 90
  const beltSlots = getStatVal('belt slots') || 4

  // Dex modifier for initiative
  const dexVal = stats?.value('dexterity') ?? 10
  const dexMod = Math.floor((dexVal - 10) / 2)

  // Skills list
  const skillsList = checks.filter((c) => (c.group || '').toLowerCase() === 'skill')

  const handleRollCheck = (label: string, bonus: number) => {
    const d = rollD20()
    const total = d + bonus
    const crit = d === 20 ? ' ★ CRITICAL SUCCESS!' : d === 1 ? ' ⚠ CRITICAL FAILURE!' : ''
    toast.info(
      `${label} Check`,
      `Rolled 1d20: [${d}] ${signed(bonus)} = ${total}${crit}`
    )
  }

  const filteredSkills = skillsList.filter((s) =>
    s.label.toLowerCase().includes(filterSkill.toLowerCase())
  )

  // Identify non-zero resistances
  const activeResists = resistStats.filter((r) => (stats?.value(r.id) ?? 0) !== 0)

  return (
    <div className="h-full flex flex-col gap-2.5 min-h-0 text-ink">
      {/* 1. TOP HERO SECTION: RESOURCE POOLS (HEALTH, STAMINA, MANA) & COMBAT VITALS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 shrink-0">
        {/* Left: Resource Pools (Health, Stamina, Mana) */}
        <div className="lg:col-span-7 border border-line/60 bg-surface p-2.5 flex flex-col justify-between gap-1.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-line/40 pb-1">
            <span className="font-label text-[11px] font-bold caps-5 text-tint-cyan flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 text-tint-red-ink" />
              Resource Pools
            </span>
            <span className="font-ui text-[9.5px] text-faint">Active Status</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {resources.map((r) => {
              const pct = Math.max(0, Math.min(100, Math.round((r.current / (r.max || 1)) * 100)))
              const isHp = r.stat.toLowerCase().includes('health') || r.stat.toLowerCase().includes('hp')
              const isMana = r.stat.toLowerCase().includes('mana')
              const barColor = isHp
                ? 'bg-gradient-to-r from-tint-red to-tint-red-ink'
                : isMana
                ? 'bg-gradient-to-r from-tint-purple to-tint-purple-ink'
                : 'bg-gradient-to-r from-tint-green to-tint-green-ink'
              const textColor = isHp ? 'text-tint-red-ink' : isMana ? 'text-tint-purple-ink' : 'text-tint-green-ink'

              return (
                <div key={r.stat} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between font-ui text-[11px]">
                    <span className={cn('font-bold caps-5 text-[10px]', textColor)}>
                      {r.label}
                    </span>
                    <span className="text-ink/95 font-bold text-[11.5px]">
                      {Math.round(r.current)} / {Math.round(r.max)}
                    </span>
                  </div>
                  <div className="h-2 w-full tone-panel-80 border border-line/50 overflow-hidden">
                    <div
                      className={cn('h-full transition-all duration-300', barColor)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Core Combat Vitals Grid */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-1.5">
          <div className="grid grid-cols-3 gap-1.5">
            <div className="flex items-center gap-2 border border-line/60 bg-surface px-2 py-1.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-tint-cyan/40 bg-tint-cyan/10 text-tint-cyan">
                <Shield className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label text-[8.5px] caps-5 text-dim">Armor</span>
                <span className="font-ui text-[13px] font-bold text-ink leading-none">{armour} AC</span>
              </div>
            </div>

            <div className="flex items-center gap-2 border border-line/60 bg-surface px-2 py-1.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-tint-yellow/40 bg-tint-yellow/10 text-tint-yellow-ink">
                <Zap className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label text-[8.5px] caps-5 text-dim">Init</span>
                <span className="font-ui text-[13px] font-bold text-ink leading-none">{signed(dexMod)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 border border-line/60 bg-surface px-2 py-1.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-tint-cyan/40 bg-tint-cyan/10 text-tint-cyan">
                <Footprints className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label text-[8.5px] caps-5 text-dim">Speed</span>
                <span className="font-ui text-[13px] font-bold text-ink leading-none">{speed} ft</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex items-center gap-2 border border-line/60 bg-surface px-2 py-1.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-tint-cyan/40 bg-tint-cyan/10 text-tint-cyan">
                <Weight className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label text-[8.5px] caps-5 text-dim">Carry Cap</span>
                <span className="font-ui text-[13px] font-bold text-ink leading-none">{carryWeight} lbs</span>
              </div>
            </div>

            <div className="flex items-center gap-2 border border-line/60 bg-surface px-2 py-1.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label text-[8.5px] caps-5 text-dim">Belt Slots</span>
                <span className="font-ui text-[13px] font-bold text-accent leading-none">{beltSlots}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN VIEWPORT: ATTRIBUTES (LEFT) & SKILLS (RIGHT) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2.5">
        {/* LEFT COLUMN: CORE ATTRIBUTES & DEFENSES (7 COLS) */}
        <div className="lg:col-span-7 flex flex-col gap-2.5 min-h-0 overflow-y-auto pr-1">
          {/* Core Attributes Grid */}
          <div className="border border-line/50 bg-surface">
            <div className="flex items-center justify-between border-b border-line/50 tone-panel-60 px-3 py-1.5">
              <span className="font-label text-[11px] font-bold caps-5 text-tint-cyan">
                Attributes & Modifiers
              </span>
              <span className="font-ui text-[10px] text-faint">Click to Roll (1d20 + Mod)</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5">
              {attributes.map((def) => {
                const base = stats?.baseValue(def.id) ?? 10
                const now = stats?.value(def.id) ?? 10
                const mod = Math.floor((now - 10) / 2)
                const bonus = signed(mod)

                return (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() => handleRollCheck(def.label, mod)}
                    className="group flex flex-col gap-1 border border-line/50 tone-well-50 p-2.5 text-left transition-all hover:border-tint-cyan hover:bg-tint-cyan/[0.04]"
                    title={`Click to roll ${def.label} test (1d20 ${bonus})`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-label text-[10px] font-bold caps-5 text-tint-cyan group-hover:text-tint-cyan/80">
                        {def.label.slice(0, 3)}
                      </span>
                      <span className="border border-tint-cyan/40 bg-tint-cyan/15 px-1.5 py-0.2 font-ui text-[11px] font-bold text-tint-cyan shadow-sm">
                        {bonus}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="truncate text-[12px] font-medium text-ink/90">{def.label}</span>
                      <span className={cn('font-ui text-[15px] font-bold', now > base ? 'text-ok' : now < base ? 'text-alert' : 'text-ink')}>
                        {round(now)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Defenses & Resistances Matrix */}
          <div className="border border-line/50 bg-surface">
            <div className="flex items-center justify-between border-b border-line/50 tone-panel-60 px-3 py-1.5">
              <span className="font-label text-[11px] font-bold caps-5 text-tint-cyan">
                Damage Resistances & Ward Matrix
              </span>
              <span className="font-ui text-[10px] text-faint">
                {activeResists.length} Active Modifiers
              </span>
            </div>

            <div className="p-2.5">
              {activeResists.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2.5">
                  {activeResists.map((r) => {
                    const val = stats?.value(r.id) ?? 0
                    const isResist = val > 0
                    return (
                      <div
                        key={r.id}
                        className={cn(
                          'flex items-center justify-between border px-2.5 py-1.5 font-ui text-[11px]',
                          isResist ? 'border-ok/60 bg-ok/15 text-ok font-bold' : 'border-alert/60 bg-alert/15 text-alert font-bold'
                        )}
                      >
                        <span className="truncate">{r.label.replace(/resist$/i, '').trim()}</span>
                        <span>{signed(val)}</span>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {/* Categorized Matrix Badges */}
              <div className="grid grid-cols-3 gap-2 text-[10.5px] font-ui">
                <div className="border border-line/30 tone-panel-40 p-2 flex flex-col gap-1">
                  <span className="text-faint caps font-bold text-[9px] flex items-center gap-1">
                    <Swords className="h-3 w-3 text-dim" /> Physical
                  </span>
                  <span className="text-dim">Slash, Pierce, Bludgeon (Standard)</span>
                </div>
                <div className="border border-line/30 tone-panel-40 p-2 flex flex-col gap-1">
                  <span className="text-faint caps font-bold text-[9px] flex items-center gap-1">
                    <Flame className="h-3 w-3 text-tint-amber-ink/80" /> Elemental
                  </span>
                  <span className="text-dim">Fire, Cold, Lightning, Acid (Standard)</span>
                </div>
                <div className="border border-line/30 tone-panel-40 p-2 flex flex-col gap-1">
                  <span className="text-faint caps font-bold text-[9px] flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-tint-purple-ink/80" /> Arcane
                  </span>
                  <span className="text-dim">Force, Necrotic, Radiant, Psychic (Standard)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Buffs & Conditions */}
          {buffs.length > 0 && (
            <div className="border border-line/50 bg-surface">
              <div className="border-b border-line/50 tone-panel-60 px-3 py-1.5 font-label text-[11px] font-bold caps-5 text-accent">
                Active Buffs & Conditions ({buffs.length})
              </div>
              <div className="flex flex-col gap-1.5 p-2.5">
                {buffs.map((b) => (
                  <div
                    key={b.uid}
                    className="flex items-center justify-between border border-accent/30 bg-accent/[0.04] px-3 py-1.5 text-[12px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">
                        {String(catalog.template(BUFF_TEMPLATES, b.id)?.label || b.id)}
                      </span>
                      {b.stacks > 1 && (
                        <span className="border border-accent/40 bg-accent/15 px-1 font-ui text-[10px] font-bold text-accent">
                          ×{b.stacks}
                        </span>
                      )}
                    </div>
                    <span className="font-ui text-[11px] text-tint-cyan">{gameTime(b.remaining)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SKILLS & PROFICIENCIES (5 COLS) */}
        <div className="lg:col-span-5 flex flex-col min-h-0 border border-line/50 bg-surface">
          <div className="flex items-center justify-between border-b border-line/50 tone-panel-60 px-3 py-1.5 shrink-0">
            <span className="font-label text-[11px] font-bold caps-5 text-tint-cyan">
              Skills & Proficiencies
            </span>
            <span className="font-ui text-[10px] text-faint">{filteredSkills.length} SKILLS</span>
          </div>

          {/* Filter Search */}
          <div className="border-b border-line/40 tone-panel-40 p-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-faint" />
              <input
                type="text"
                placeholder="Filter skills..."
                value={filterSkill}
                onChange={(e) => setFilterSkill(e.target.value)}
                className="w-full border border-line tone-panel-80 pl-8 pr-2.5 py-1 font-ui text-[11px] text-ink placeholder-faint focus:border-tint-cyan focus:outline-none"
              />
            </div>
          </div>

          {/* Skills List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
            {filteredSkills.map((c) => {
              const bonus = checkBonus(entity, c)
              const bonusText = signed(bonus)

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleRollCheck(c.label, bonus)}
                  className="w-full flex items-center justify-between border border-line/30 tone-well-40 px-2.5 py-1.5 text-left transition-all hover:border-tint-cyan hover:bg-tint-cyan/[0.06]"
                  title={`Click to roll ${c.label} test (1d20 ${bonusText})`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('h-2 w-2 rounded-none border', bonus > 0 ? 'bg-tint-cyan border-tint-cyan' : 'border-line/60 bg-transparent')} />
                    <span className="truncate text-[12px] font-medium text-ink/90">
                      {c.label}
                    </span>
                  </div>

                  <span className={cn('font-ui text-[11.5px] font-bold', bonus > 0 ? 'text-tint-cyan' : 'text-dim')}>
                    {bonusText}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

registerGameScreen({
  id: 'character',
  label: 'Character',
  icon: <Heart />,
  key: 'c',
  order: 10,
  Screen: CharacterScreen
})
