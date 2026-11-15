import type { CompendiumRef } from './compendium'
import { signed } from './text'

export { signed }

export const DND_STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

export type DndStat = (typeof DND_STATS)[number]

export const DND_STAT_NAMES: Record<DndStat, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }

export const DND_SKILLS: { id: string; name: string; stat: DndStat }[] = [
  { id: 'acrobatics', name: 'Acrobatics', stat: 'dex' },
  { id: 'animal_handling', name: 'Animal Handling', stat: 'wis' },
  { id: 'arcana', name: 'Arcana', stat: 'int' },
  { id: 'athletics', name: 'Athletics', stat: 'str' },
  { id: 'deception', name: 'Deception', stat: 'cha' },
  { id: 'history', name: 'History', stat: 'int' },
  { id: 'insight', name: 'Insight', stat: 'wis' },
  { id: 'intimidation', name: 'Intimidation', stat: 'cha' },
  { id: 'investigation', name: 'Investigation', stat: 'int' },
  { id: 'medicine', name: 'Medicine', stat: 'wis' },
  { id: 'nature', name: 'Nature', stat: 'int' },
  { id: 'perception', name: 'Perception', stat: 'wis' },
  { id: 'performance', name: 'Performance', stat: 'cha' },
  { id: 'persuasion', name: 'Persuasion', stat: 'cha' },
  { id: 'religion', name: 'Religion', stat: 'int' },
  { id: 'sleight_of_hand', name: 'Sleight of Hand', stat: 'dex' },
  { id: 'stealth', name: 'Stealth', stat: 'dex' },
  { id: 'survival', name: 'Survival', stat: 'wis' }
]

export const DND_CONDITIONS = ['Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious']

export const DND_PERSONA_FIELDS = ['Personality traits', 'Ideals', 'Bonds', 'Flaws', 'Backstory']

export const DND_COINS = ['cp', 'sp', 'ep', 'gp', 'pp'] as const

export type DndCoin = (typeof DND_COINS)[number]

export type Proficiency = 0 | 1 | 2

export interface DndAttack {
  name: string
  bonus: string
  damage: string
  notes: string
}

export interface DndItem {
  name: string
  qty: number
  equipped: boolean
  note: string
}

export interface DndFeature {
  name: string
  text: string
}

export interface DndSpell {
  name: string
  level: number
  prepared: boolean
  note: string
}

export type DndExtra = number | { cur: number; max: number }

export const DND_POOL_STATS = { hp: 'health', ac: 'armour', speed: 'speed' } as const satisfies Partial<Record<keyof DndStats, string>>

export interface DndStats {
  race: string
  cls: string
  level: number
  background: string
  alignment: string
  xp: number
  inspiration: boolean
  hp: { cur: number; max: number; temp: number }
  hitDice: { total: string; used: number }
  deathSaves: { ok: number; fail: number }
  ac: number
  speed: number
  stats: Record<DndStat, number>
  saves: Record<DndStat, boolean>
  skills: Record<string, Proficiency>
  conditions: string[]
  exhaustion: number
  attacks: DndAttack[]
  proficiencies: { armor: string; weapons: string; tools: string; languages: string }
  equipment: DndItem[]
  coins: Record<DndCoin, number>
  features: DndFeature[]
  spellAbility: DndStat | null
  slots: { max: number; used: number }[]
  spells: DndSpell[]
  extra: Record<string, DndExtra>
}

const ZERO_STATS = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

export function blankDnd(): DndStats {
  return {
    race: '',
    cls: '',
    level: 1,
    background: '',
    alignment: '',
    xp: 0,
    inspiration: false,
    hp: { cur: 10, max: 10, temp: 0 },
    hitDice: { total: '', used: 0 },
    deathSaves: { ok: 0, fail: 0 },
    ac: 10,
    speed: 30,
    stats: { ...ZERO_STATS },
    saves: { str: false, dex: false, con: false, int: false, wis: false, cha: false },
    skills: {},
    conditions: [],
    exhaustion: 0,
    attacks: [],
    proficiencies: { armor: '', weapons: '', tools: '', languages: '' },
    equipment: [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    features: [],
    spellAbility: null,
    slots: Array.from({ length: 9 }, () => ({ max: 0, used: 0 })),
    spells: [],
    extra: {},
  }
}

function cleanExtra(raw: unknown): Record<string, DndExtra> {
  return Object.fromEntries(
    Object.entries(obj(raw)).flatMap(([key, v]): [string, DndExtra][] => {
      if (typeof v === 'number' && Number.isFinite(v)) return [[key, v]]
      const r = obj(v)
      if (typeof r.max !== 'number') return []
      const max = num(r.max, 0, 0)
      return [[key, { cur: num(r.cur, max, 0, max), max }]]
    })
  )
}

function num(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(obj) : []
}

function isStat(value: unknown): value is DndStat {
  return DND_STATS.includes(value as DndStat)
}

export function cleanDnd(raw: unknown): DndStats {
  const base = blankDnd()
  const d = obj(raw)
  const hp = obj(d.hp)
  const stats = obj(d.stats)
  const saves = obj(d.saves)
  const skills = obj(d.skills)
  const hitDice = obj(d.hitDice)
  const death = obj(d.deathSaves)
  const profs = obj(d.proficiencies)
  const coins = obj(d.coins)
  const slots = Array.isArray(d.slots) ? d.slots.map(obj) : []
  const max = Math.max(1, num(hp.max, base.hp.max))
  return {
    race: text(d.race),
    cls: text(d.cls),
    level: num(d.level, base.level, 1, 20),
    background: text(d.background),
    alignment: text(d.alignment),
    xp: num(d.xp, 0, 0),
    inspiration: d.inspiration === true,
    hp: { cur: Math.min(max, num(hp.cur, base.hp.cur)), max, temp: num(hp.temp, 0, 0) },
    hitDice: { total: text(hitDice.total), used: num(hitDice.used, 0, 0) },
    deathSaves: { ok: num(death.ok, 0, 0, 3), fail: num(death.fail, 0, 0, 3) },
    ac: num(d.ac, base.ac),
    speed: num(d.speed, base.speed),
    stats: Object.fromEntries(DND_STATS.map((k) => [k, num(stats[k], base.stats[k], 1, 30)])) as Record<DndStat, number>,
    saves: Object.fromEntries(DND_STATS.map((k) => [k, saves[k] === true])) as Record<DndStat, boolean>,
    skills: Object.fromEntries(DND_SKILLS.flatMap((s) => (skills[s.id] === 1 || skills[s.id] === 2 ? [[s.id, skills[s.id] as Proficiency]] : []))),
    conditions: (Array.isArray(d.conditions) ? d.conditions : []).map(text).filter(Boolean),
    exhaustion: num(d.exhaustion, 0, 0, 6),
    attacks: list(d.attacks).map((a) => ({ name: text(a.name), bonus: text(a.bonus), damage: text(a.damage), notes: text(a.notes) })),
    proficiencies: { armor: text(profs.armor), weapons: text(profs.weapons), tools: text(profs.tools), languages: text(profs.languages) },
    equipment: list(d.equipment).map((i) => ({ name: text(i.name), qty: num(i.qty, 1, 0), equipped: i.equipped === true, note: text(i.note) })),
    coins: Object.fromEntries(DND_COINS.map((c) => [c, num(coins[c], 0, 0)])) as Record<DndCoin, number>,
    features: list(d.features).map((f) => ({ name: text(f.name), text: text(f.text) })),
    spellAbility: isStat(d.spellAbility) ? d.spellAbility : null,
    slots: base.slots.map((_, i) => {
      const s = slots[i] ?? {}
      const most = num(s.max, 0, 0, 9)
      return { max: most, used: num(s.used, 0, 0, most) }
    }),
    spells: list(d.spells).map((s) => ({ name: text(s.name), level: num(s.level, 0, 0, 9), prepared: s.prepared === true, note: text(s.note) })),
    extra: cleanExtra(d.extra),
  }
}

export function passivePerception(d: DndStats): number {
  return 10 + skillBonus(d, 'perception')
}

export function ordinal(n: number): string {
  return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
}

export function takeDamage(d: DndStats, amount: number): Partial<DndStats> {
  const soak = Math.min(d.hp.temp, amount)
  return { hp: { ...d.hp, temp: d.hp.temp - soak, cur: Math.max(0, d.hp.cur - (amount - soak)) } }
}

export function heal(d: DndStats, amount: number): Partial<DndStats> {
  return { hp: { ...d.hp, cur: Math.min(d.hp.max, Math.max(0, d.hp.cur) + amount) }, deathSaves: { ok: 0, fail: 0 } }
}

export function giveTempHp(d: DndStats, amount: number): Partial<DndStats> {
  return { hp: { ...d.hp, temp: Math.max(d.hp.temp, amount) } }
}

export function hitDiceCount(d: DndStats): number {
  const m = /^\s*(\d+)/.exec(d.hitDice.total)
  return m ? Number(m[1]) : d.level
}

export function longRest(d: DndStats): Partial<DndStats> {
  return {
    hp: { ...d.hp, cur: d.hp.max, temp: 0 },
    deathSaves: { ok: 0, fail: 0 },
    hitDice: { ...d.hitDice, used: Math.max(0, d.hitDice.used - Math.max(1, Math.floor(hitDiceCount(d) / 2))) },
    slots: d.slots.map((s) => ({ ...s, used: 0 })),
    exhaustion: Math.max(0, d.exhaustion - 1)
  }
}

function factText(ref: CompendiumRef, key: string): string {
  const v = ref.facts[key]
  return v === undefined || v === false ? '' : String(v)
}

export function withRace(d: DndStats, ref: CompendiumRef): Partial<DndStats> {
  return { race: ref.name, speed: Number(ref.facts.speed) || d.speed }
}

export function withClass(d: DndStats, ref: CompendiumRef): Partial<DndStats> {
  const saves = factText(ref, 'saves').toLowerCase().split(/[^a-z]+/).filter((s): s is DndStat => (DND_STATS as readonly string[]).includes(s))
  const die = factText(ref, 'hit_die')
  return {
    cls: ref.name,
    hitDice: { ...d.hitDice, total: d.hitDice.total.trim() || (die ? `${d.level}${die.startsWith('d') ? die : `d${die}`}` : '') },
    saves: Object.values(d.saves).some(Boolean) || !saves.length ? d.saves : { ...d.saves, ...Object.fromEntries(saves.map((s) => [s, true])) }
  }
}

export function attackFrom(d: DndStats, ref: CompendiumRef): DndAttack {
  const properties = factText(ref, 'properties')
  const str = mod(d.stats.str)
  const dex = mod(d.stats.dex)
  const ability = /ranged/i.test(factText(ref, 'category')) ? dex : /finesse/i.test(properties) ? Math.max(str, dex) : str
  const damage = factText(ref, 'damage')
  return { name: ref.name, bonus: signed(ability + proficiencyBonus(d.level)), damage: ability ? damage.replace(/^(\d+d\d+)/, `$1${signed(ability)}`) : damage, notes: properties }
}

export function itemFrom(ref: CompendiumRef): DndItem {
  const ac = factText(ref, 'armor_class')
  return { name: ref.name, qty: 1, equipped: false, note: [factText(ref, 'damage'), ac && `AC ${ac}`, factText(ref, 'properties'), factText(ref, 'rarity')].filter(Boolean).join(', ') }
}

export function spellFrom(ref: CompendiumRef): DndSpell {
  const note = [factText(ref, 'casting_time'), factText(ref, 'range'), ref.facts.concentration ? 'concentration' : '', ref.facts.ritual ? 'ritual' : ''].filter(Boolean).join(', ')
  return { name: ref.name, level: Number(ref.facts.level) || 0, prepared: false, note }
}

export function withPersona(fields: string[]): string[] {
  return [...fields, ...DND_PERSONA_FIELDS.filter((f) => !fields.includes(f))]
}

export function mod(score: number): number {
  return Math.floor((score - 10) / 2)
}


export function modifier(score: number): string {
  return signed(mod(score))
}

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((Math.max(1, level) - 1) / 4)
}

export function saveBonus(d: DndStats, stat: DndStat): number {
  return mod(d.stats[stat]) + (d.saves[stat] ? proficiencyBonus(d.level) : 0)
}

export function skillBonus(d: DndStats, id: string): number {
  const skill = DND_SKILLS.find((s) => s.id === id)
  return skill ? mod(d.stats[skill.stat]) + (d.skills[id] ?? 0) * proficiencyBonus(d.level) : 0
}

export function spellDc(d: DndStats): number | null {
  return d.spellAbility ? 8 + proficiencyBonus(d.level) + mod(d.stats[d.spellAbility]) : null
}

export function spellAttack(d: DndStats): number | null {
  return d.spellAbility ? proficiencyBonus(d.level) + mod(d.stats[d.spellAbility]) : null
}

function who(d: DndStats): string {
  return [d.race, d.cls ? `${d.cls} ${d.level}` : `level ${d.level}`, d.background && `${d.background} background`, d.alignment].filter(Boolean).join(', ')
}

function lines(title: string, items: string[]): string {
  return items.length ? `${title}:\n${items.map((i) => `- ${i}`).join('\n')}` : ''
}

export function dndText(d: DndStats): string {
  const stats = DND_STATS.map((k) => `${k.toUpperCase()} ${d.stats[k]} (${modifier(d.stats[k])}, save ${signed(saveBonus(d, k))}${d.saves[k] ? '*' : ''})`).join(', ')
  const skills = DND_SKILLS.filter((s) => d.skills[s.id]).map((s) => `${s.name} ${signed(skillBonus(d, s.id))}${d.skills[s.id] === 2 ? ' (expertise)' : ''}`)
  const profs = Object.entries(d.proficiencies).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)
  const slots = d.slots.map((s, i) => (s.max ? `${i + 1}: ${s.max - s.used}/${s.max}` : '')).filter(Boolean)
  const parts = [
    `${who(d)}. Proficiency ${signed(proficiencyBonus(d.level))}, XP ${d.xp}${d.inspiration ? ', has inspiration' : ''}.`,
    `HP ${d.hp.cur}/${d.hp.max}${d.hp.temp ? ` +${d.hp.temp} temp` : ''}, AC ${d.ac}, speed ${d.speed}, initiative ${modifier(d.stats.dex)}, hit dice ${d.hitDice.total || 'not set'} (${d.hitDice.used} used).`,
    d.conditions.length || d.exhaustion ? `Conditions: ${[...d.conditions, d.exhaustion ? `exhaustion ${d.exhaustion}` : ''].filter(Boolean).join(', ')}.` : '',
    stats,
    skills.length ? `Skills: ${skills.join(', ')}. Passive Perception ${10 + skillBonus(d, 'perception')}.` : '',
    profs.length ? `Proficiencies: ${profs.join('; ')}.` : '',
    lines('Attacks', d.attacks.map((a) => [a.name, a.bonus && `${a.bonus} to hit`, a.damage, a.notes].filter(Boolean).join(', '))),
    lines('Features', d.features.map((f) => (f.text ? `${f.name}: ${f.text}` : f.name))),
    lines('Equipment', d.equipment.map((i) => `${i.name}${i.qty !== 1 ? ` x${i.qty}` : ''}${i.equipped ? ' (equipped)' : ''}${i.note ? `: ${i.note}` : ''}`)),
    DND_COINS.some((c) => d.coins[c]) ? `Coins: ${DND_COINS.filter((c) => d.coins[c]).map((c) => `${d.coins[c]} ${c}`).join(', ')}.` : '',
    d.spellAbility ? `Spellcasting ${d.spellAbility.toUpperCase()}, save DC ${spellDc(d)}, attack ${signed(spellAttack(d) ?? 0)}.${slots.length ? ` Slots left ${slots.join(', ')}.` : ''}` : '',
    lines('Spells', d.spells.map((s) => `${s.name} (${s.level ? `level ${s.level}` : 'cantrip'}${s.prepared ? ', prepared' : ''})${s.note ? `: ${s.note}` : ''}`))
  ]
  return parts.filter(Boolean).join('\n')
}

export function dndRoleplay(d: DndStats): string {
  return `${who(d)}.`
}

export function dndLine(d: DndStats): string {
  const who = [d.race, d.cls].filter(Boolean).join(' ')
  return [`${who || 'Level'} ${d.level}`.trim(), `HP ${d.hp.cur}/${d.hp.max}`, `AC ${d.ac}`, ...d.conditions.map((c) => c.toLowerCase())].join(', ')
}
