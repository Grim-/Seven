export type CompendiumKind = 'spell' | 'class' | 'feature' | 'race' | 'equipment' | 'condition' | 'monster'

export type FactValue = string | number | boolean

export interface FactDef {
  key: string
  link?: CompendiumKind
  label: string
  type: 'text' | 'number' | 'check'
}

export interface CompendiumKindInfo {
  kind: CompendiumKind
  label: string
  plural: string
  icon: string
  description: string
  facts: FactDef[]
}

export type CompendiumRef = Omit<CompendiumEntry, 'text'>

export interface CompendiumEntry {
  id: string
  name: string
  source: string
  facts: Record<string, FactValue>
  text: string
}

const text = (key: string, label: string): FactDef => ({ key, label, type: 'text' })
const number = (key: string, label: string): FactDef => ({ key, label, type: 'number' })
const check = (key: string, label: string): FactDef => ({ key, label, type: 'check' })

export const COMPENDIUM: CompendiumKindInfo[] = [
  { kind: 'spell', label: 'Spell', plural: 'Spells', icon: 'sparkles', description: 'D&D spells: level, school, casting time, range, components, duration, and what they do', facts: [number('level', 'Level'), text('school', 'School'), text('casting_time', 'Casting time'), text('range', 'Range'), text('components', 'Components'), text('duration', 'Duration'), check('concentration', 'Concentration'), check('ritual', 'Ritual'), { ...text('classes', 'Classes'), link: 'class' }] },
  { kind: 'class', label: 'Class', plural: 'Classes', icon: 'shield', description: 'D&D classes: hit die, saves, proficiencies, subclasses and features by level', facts: [text('hit_die', 'Hit die'), text('saves', 'Saves'), text('proficiencies', 'Proficiencies'), text('spellcasting', 'Spellcasting'), text('subclasses', 'Subclasses')] },
  { kind: 'feature', label: 'Feature', plural: 'Features', icon: 'star', description: 'D&D class features, racial traits and feats, and what they do', facts: [text('from', 'From'), number('level', 'Level')] },
  { kind: 'race', label: 'Race', plural: 'Races', icon: 'users', description: 'D&D races and subraces: size, speed, ability bonuses, languages and traits', facts: [{ ...text('parent', 'Subrace of'), link: 'race' }, text('size', 'Size'), number('speed', 'Speed'), text('ability_bonuses', 'Ability bonuses'), text('languages', 'Languages'), { ...text('traits', 'Traits'), link: 'feature' }] },
  { kind: 'equipment', label: 'Equipment', plural: 'Equipment', icon: 'backpack', description: 'D&D weapons, armour, gear and magic items: cost, weight, damage or AC, properties, rarity', facts: [text('category', 'Category'), text('cost', 'Cost'), number('weight', 'Weight'), text('damage', 'Damage'), text('armor_class', 'Armour class'), text('properties', 'Properties'), text('rarity', 'Rarity')] },
  { kind: 'condition', label: 'Condition', plural: 'Conditions', icon: 'activity', description: 'D&D conditions and what they do', facts: [] },
  { kind: 'monster', label: 'Monster', plural: 'Monsters', icon: 'skull', description: 'D&D monsters: size, type, AC, HP, speed, challenge, scores, traits and actions', facts: [text('size', 'Size'), text('type', 'Type'), text('alignment', 'Alignment'), number('ac', 'AC'), text('hp', 'HP'), text('speed', 'Speed'), text('cr', 'Challenge'), number('xp', 'XP'), number('str', 'STR'), number('dex', 'DEX'), number('con', 'CON'), number('int', 'INT'), number('wis', 'WIS'), number('cha', 'CHA'), text('senses', 'Senses'), text('languages', 'Languages')] }
]

export function compendiumInfo(kind: string): CompendiumKindInfo | undefined {
  return COMPENDIUM.find((k) => k.kind === kind)
}

export function entryId(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : ''
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function names(v: unknown): string {
  return arr(v)
    .map((x) => str(obj(x).name) || str(x))
    .filter(Boolean)
    .join(', ')
}

function paragraphs(v: unknown): string {
  return (Array.isArray(v) ? v.map(str) : [str(v)]).filter(Boolean).join('\n\n')
}

export function cleanFacts(kind: CompendiumKind, raw: unknown): Record<string, FactValue> {
  const facts = obj(raw)
  const out: Record<string, FactValue> = {}
  for (const f of compendiumInfo(kind)?.facts ?? []) {
    const v = facts[f.key]
    if (f.type === 'check') {
      if (v === true) out[f.key] = true
    } else if (f.type === 'number') {
      const n = Number(v)
      if (v !== '' && v !== null && v !== undefined && Number.isFinite(n)) out[f.key] = n
    } else if (str(v)) out[f.key] = str(v)
  }
  return out
}

export function cleanEntry(kind: CompendiumKind, raw: unknown, source = 'Yours'): CompendiumEntry | null {
  const e = obj(raw)
  const name = str(e.name)
  if (!name) return null
  return { id: entryId(str(e.id) || name), name, source: str(e.source) || source, facts: cleanFacts(kind, e.facts), text: str(e.text) }
}

export function looksLikeSrd(raw: unknown): boolean {
  const e = obj(raw)
  return typeof e.index === 'string' && typeof e.url === 'string'
}

export interface SrdContext {
  featuresByClass?: Map<string, { level: number; name: string }[]>
  subclassesByClass?: Map<string, { name: string; text: string }[]>
}

function cost(v: unknown): string {
  const c = obj(v)
  return c.quantity !== undefined ? `${str(c.quantity)} ${str(c.unit)}` : ''
}

function bonuses(v: unknown): string {
  return arr(v)
    .map((b) => `${str(obj(obj(b).ability_score).name)} +${str(obj(b).bonus)}`)
    .filter((s) => !s.startsWith(' '))
    .join(', ')
}

function monsterText(m: Record<string, unknown>): string {
  const block = (title: string, list: unknown) => {
    const items = arr(list).map((a) => `**${str(obj(a).name)}.** ${paragraphs(obj(a).desc)}`)
    return items.length ? `## ${title}\n\n${items.join('\n\n')}` : ''
  }
  const line = (label: string, v: unknown) => (arr(v).length ? `**${label}:** ${arr(v).map((x) => str(obj(x).name) || str(x)).join(', ')}` : '')
  const profs = arr(m.proficiencies).map((p) => `${str(obj(obj(p).proficiency).name).replace(/^(Saving Throw|Skill): /, '')} +${str(obj(p).value)}`)
  return [
    profs.length ? `**Saves and skills:** ${profs.join(', ')}` : '',
    line('Vulnerable to', m.damage_vulnerabilities),
    line('Resists', m.damage_resistances),
    line('Immune to', m.damage_immunities),
    line('Condition immunities', m.condition_immunities),
    block('Traits', m.special_abilities),
    block('Actions', m.actions),
    block('Reactions', m.reactions),
    block('Legendary actions', m.legendary_actions)
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function fromSrd(kind: CompendiumKind, raw: unknown, source: string, ctx: SrdContext = {}): CompendiumEntry | null {
  const e = obj(raw)
  const name = str(e.name)
  if (!name) return null
  const id = str(e.index) || entryId(name)
  const make = (facts: Record<string, unknown>, body: string): CompendiumEntry => ({ id, name, source, facts: cleanFacts(kind, facts), text: body.trim() })
  switch (kind) {
    case 'spell': {
      const components = arr(e.components).map(str).join(', ')
      const higher = paragraphs(e.higher_level)
      return make(
        { level: e.level, school: obj(e.school).name, casting_time: e.casting_time, range: e.range, components: e.material ? `${components} (${str(e.material)})` : components, duration: e.duration, concentration: e.concentration === true, ritual: e.ritual === true, classes: names(e.classes) },
        `${paragraphs(e.desc)}${higher ? `\n\n**At higher levels.** ${higher}` : ''}`
      )
    }
    case 'class': {
      const features = ctx.featuresByClass?.get(id) ?? []
      const subclasses = ctx.subclassesByClass?.get(id) ?? []
      const byLevel = new Map<number, string[]>()
      for (const f of features) byLevel.set(f.level, [...(byLevel.get(f.level) ?? []), f.name])
      const choices = arr(e.proficiency_choices).map((c) => str(obj(c).desc)).filter(Boolean)
      const body = [
        choices.length ? `**Choices:** ${choices.join('; ')}` : '',
        byLevel.size ? `## Features by level\n\n${[...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([l, n]) => `- **${l}:** ${n.join(', ')}`).join('\n')}` : '',
        subclasses.length ? `## Subclasses\n\n${subclasses.map((s) => `### ${s.name}\n\n${s.text}`).join('\n\n')}` : ''
      ]
      return make({ hit_die: e.hit_die ? `d${str(e.hit_die)}` : '', saves: names(e.saving_throws), proficiencies: names(arr(e.proficiencies).filter((p) => !str(obj(p).name).startsWith('Saving Throw'))), spellcasting: str(obj(obj(e.spellcasting).spellcasting_ability).name), subclasses: names(e.subclasses) }, body.filter(Boolean).join('\n\n'))
    }
    case 'feature': {
      const from = str(obj(e.subclass).name) ? `${str(obj(e.subclass).name)} (${str(obj(e.class).name)})` : str(obj(e.class).name) || names(e.races) || names(e.subraces) || (Array.isArray(e.prerequisites) && !e.class ? 'Feat' : '')
      const prereq = arr(e.prerequisites)
        .map((p) => {
          const a = obj(p)
          return a.ability_score ? `${str(obj(a.ability_score).name)} ${str(a.minimum_score)}` : str(a.type)
        })
        .filter(Boolean)
      return make({ from, level: e.level }, `${prereq.length ? `**Needs:** ${prereq.join(', ')}\n\n` : ''}${paragraphs(e.desc)}`)
    }
    case 'race': {
      const body = [paragraphs(e.desc), str(e.alignment) && `**Alignment.** ${str(e.alignment)}`, str(e.age) && `**Age.** ${str(e.age)}`, str(e.size_description) && `**Size.** ${str(e.size_description)}`, str(e.language_desc) && `**Languages.** ${str(e.language_desc)}`]
      return make({ parent: str(obj(e.race).name), size: e.size, speed: e.speed, ability_bonuses: bonuses(e.ability_bonuses), languages: names(e.languages), traits: names(e.traits) || names(e.racial_traits) }, body.filter(Boolean).join('\n\n'))
    }
    case 'equipment': {
      const dmg = obj(e.damage)
      const two = obj(e.two_handed_damage)
      const ac = obj(e.armor_class)
      const damage = dmg.damage_dice ? `${str(dmg.damage_dice)} ${str(obj(dmg.damage_type).name).toLowerCase()}${two.damage_dice ? ` (${str(two.damage_dice)} two-handed)` : ''}` : ''
      const armor = ac.base !== undefined ? `${str(ac.base)}${ac.dex_bonus ? (ac.max_bonus !== undefined && ac.max_bonus !== null ? ` + Dex (max ${str(ac.max_bonus)})` : ' + Dex') : ''}` : ''
      const category = [str(obj(e.equipment_category).name), str(e.category_range) || str(e.armor_category) || str(obj(e.gear_category).name)].filter(Boolean).join(', ')
      const notes = [e.stealth_disadvantage === true ? 'Disadvantage on Stealth.' : '', Number(e.str_minimum) ? `Needs Strength ${str(e.str_minimum)}.` : '']
      return make({ category, cost: cost(e.cost), weight: e.weight, damage, armor_class: armor, properties: names(e.properties), rarity: str(obj(e.rarity).name) }, [paragraphs(e.desc), ...notes].filter(Boolean).join('\n\n'))
    }
    case 'condition':
      return make({}, paragraphs(e.desc))
    case 'monster': {
      const score = (k: string) => e[k]
      const speed = Object.entries(obj(e.speed))
        .map(([k, v]) => (k === 'walk' ? str(v) : `${k} ${str(v)}`))
        .join(', ')
      const senses = Object.entries(obj(e.senses))
        .map(([k, v]) => `${k.replace(/_/g, ' ')} ${str(v)}`)
        .join(', ')
      return make(
        { size: e.size, type: e.type, alignment: e.alignment, ac: obj(arr(e.armor_class)[0]).value ?? e.armor_class, hp: e.hit_points ? `${str(e.hit_points)}${e.hit_points_roll ? ` (${str(e.hit_points_roll)})` : ''}` : '', speed, cr: e.challenge_rating, xp: e.xp, str: score('strength'), dex: score('dexterity'), con: score('constitution'), int: score('intelligence'), wis: score('wisdom'), cha: score('charisma'), senses, languages: e.languages },
        monsterText(e)
      )
    }
  }
}

export function importEntries(kind: CompendiumKind, raw: unknown): CompendiumEntry[] {
  const list = Array.isArray(raw) ? raw : obj(raw)[kind] ?? obj(raw).entries ?? [raw]
  return arr(list)
    .map((item) => (looksLikeSrd(item) ? fromSrd(kind, item, 'Imported') : cleanEntry(kind, item, 'Imported')))
    .filter((e): e is CompendiumEntry => e !== null)
}

function factText(def: FactDef, v: FactValue): string {
  return def.type === 'check' ? 'yes' : String(v)
}

export function entryMarkdown(kind: CompendiumKind, e: CompendiumEntry): string {
  const info = compendiumInfo(kind)
  const facts = (info?.facts ?? []).filter((f) => e.facts[f.key] !== undefined).map((f) => `**${f.label}:** ${factText(f, e.facts[f.key])}`)
  return [`# ${e.name}`, `_${info?.label ?? kind}, ${e.source}_`, facts.join(' · '), e.text].filter(Boolean).join('\n\n')
}

export function entrySummary(kind: CompendiumKind, e: CompendiumEntry): string {
  const f = e.facts
  switch (kind) {
    case 'spell':
      return `${f.level ? `Level ${f.level}` : 'Cantrip'}${f.school ? ` ${String(f.school).toLowerCase()}` : ''}${f.concentration ? ', concentration' : ''}`
    case 'class':
      return [f.hit_die && `Hit die ${f.hit_die}`, f.saves && `saves ${f.saves}`].filter(Boolean).join(', ')
    case 'feature':
      return [f.from, f.level !== undefined && `level ${f.level}`].filter(Boolean).join(', ')
    case 'race':
      return [f.parent && `Subrace of ${f.parent}`, f.size, f.speed !== undefined && `${f.speed} ft`, f.ability_bonuses].filter(Boolean).join(', ')
    case 'equipment':
      return [f.category, f.damage, f.armor_class && `AC ${f.armor_class}`, f.rarity, f.cost].filter(Boolean).join(', ')
    case 'monster':
      return [f.size, f.type, f.cr !== undefined && `CR ${f.cr}`].filter(Boolean).join(', ')
    default:
      return e.text.split('\n')[0]?.replace(/^[-*]\s*/, '').slice(0, 100) ?? ''
  }
}

export interface EntryBlock {
  title: string | null
  body: string
}

export interface EntryGroup {
  heading: string | null
  level: number
  blocks: EntryBlock[]
}

const LEAD = /^\*{2,3}([^*\n]+?)\*{2,3}\s*([\s\S]*)$/

export function entrySections(text: string): EntryGroup[] {
  const groups: EntryGroup[] = [{ heading: null, level: 0, blocks: [] }]
  let para: string[] = []
  const flush = () => {
    const raw = para.join('\n').trim()
    para = []
    if (!raw) return
    const group = groups[groups.length - 1]
    const lead = LEAD.exec(raw)
    if (lead) {
      group.blocks.push({ title: lead[1].trim().replace(/[.:]$/, '').trim(), body: lead[2].trim() })
      return
    }
    const last = group.blocks[group.blocks.length - 1]
    if (last?.title && !raw.startsWith('- ')) last.body = last.body ? `${last.body}\n\n${raw}` : raw
    else group.blocks.push({ title: null, body: raw })
  }
  for (const line of text.split('\n')) {
    const heading = /^(#{1,4})\s+(.+)$/.exec(line)
    if (heading) {
      flush()
      groups.push({ heading: heading[2].trim(), level: heading[1].length, blocks: [] })
    } else if (!line.trim()) flush()
    else para.push(line)
  }
  flush()
  return groups.filter((g) => g.heading || g.blocks.length)
}

export function blockRuns(blocks: EntryBlock[]): { titled: boolean; blocks: EntryBlock[] }[] {
  const runs: { titled: boolean; blocks: EntryBlock[] }[] = []
  for (const b of blocks) {
    const titled = b.title !== null
    const last = runs[runs.length - 1]
    if (last && last.titled === titled) last.blocks.push(b)
    else runs.push({ titled, blocks: [b] })
  }
  return runs
}

export function levelRows(body: string): { level: number; items: string[] }[] | null {
  const lines = body.split('\n').filter((l) => l.trim())
  const rows = lines.map((l) => /^\s*[-*]\s+\*\*(\d+):?\*\*:?\s*(.*)$/.exec(l))
  if (!rows.length || rows.some((m) => !m)) return null
  return rows.map((m) => ({ level: Number(m![1]), items: m![2].split(/,\s*(?![^(]*\))/).map((s) => s.trim()).filter(Boolean) }))
}
