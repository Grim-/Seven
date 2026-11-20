import { registerDefType, type StarterDef } from './defs'
import { refillRule, REFILL_PARAMS } from '../components/refill'

const attribute = (id: string, name: string): StarterDef => ({ id, name, values: { domain: 'attribute', default: 10, min: 1, max: 30 } })
const resist = (id: string, name: string): StarterDef => ({ id: `${id}_resist`, name: `${name} resist`, notes: '0 takes it normally, 0.5 takes half, 1 takes none, -1 takes double.', values: { domain: 'resist', default: 0, min: -3, max: 1 } })

export const DAMAGE_STARTER: [string, string][] = [
  ['slashing', 'Slashing'],
  ['piercing', 'Piercing'],
  ['bludgeoning', 'Bludgeoning'],
  ['fire', 'Fire'],
  ['cold', 'Cold'],
  ['lightning', 'Lightning'],
  ['thunder', 'Thunder'],
  ['acid', 'Acid'],
  ['poison', 'Poison'],
  ['necrotic', 'Necrotic'],
  ['radiant', 'Radiant'],
  ['force', 'Force'],
  ['psychic', 'Psychic']
]

registerDefType({
  type: 'stat',
  label: 'Stat',
  plural: 'Stats',
  icon: 'bar-chart-3',
  description: 'game stats: attributes, the maximum of each resource (Health, Stamina, Mana), combat numbers and resists, with their default, limits and what refills them',
  params: {
    domain: { label: 'Group', kind: 'text', default: 'attribute', description: 'The group it belongs to (attribute, resource, combat, resist…). Buffs and equipment change stats by group and id.', section: 'Values' },
    default: { label: 'Default', kind: 'number', default: 10, description: 'The value when a sheet or creature sets none.', section: 'Values' },
    min: { label: 'Lowest', kind: 'number', default: 0, description: 'It never goes below this.', section: 'Values' },
    max: { label: 'Highest', kind: 'number', default: 9999, description: 'It never goes above this.', section: 'Values' },
    colour: { label: 'Bar colour', kind: 'choice', choices: ['none', 'accent', 'alert', 'ok', 'cyan', 'purple'], default: 'none', description: 'For a resource: the colour of its bar on tokens and in the HUD, from the theme.', section: 'Look' },
    ...REFILL_PARAMS
  },
  starter: [
    attribute('str', 'Strength'),
    attribute('dex', 'Dexterity'),
    attribute('con', 'Constitution'),
    attribute('int', 'Intelligence'),
    attribute('wis', 'Wisdom'),
    attribute('cha', 'Charisma'),
    { id: 'health', name: 'Health', notes: 'The most Health. At zero Health a creature dies. A long rest fills it.', values: { domain: 'resource', default: 10, min: 0, max: 9999, colour: 'alert', refillOn: ['OnLongRest'], refillFraction: 1 } },
    { id: 'stamina', name: 'Stamina', notes: 'The most Stamina. A short or long rest fills it.', values: { domain: 'resource', default: 20, min: 0, max: 9999, colour: 'ok', refillOn: ['OnShortRest', 'OnLongRest'], refillFraction: 1 } },
    { id: 'mana', name: 'Mana', notes: 'The most Mana. Spells cost it by default. A long rest fills it.', values: { domain: 'resource', default: 10, min: 0, max: 9999, colour: 'purple', refillOn: ['OnLongRest'], refillFraction: 1 } },
    { id: 'armour', name: 'Armour', notes: 'How hard it is to hit.', values: { domain: 'combat', default: 10, min: 0, max: 50 } },
    { id: 'speed', name: 'Speed', notes: 'Feet moved in a battle turn. 5 ft is one tile.', values: { domain: 'combat', default: 30, min: 0, max: 200 } },
    { id: 'belt', name: 'Belt slots', notes: 'How many quick slots the tool belt has.', values: { domain: 'combat', default: 4, min: 0, max: 12 } },
    { id: 'carry', name: 'Carry weight', notes: 'Pounds carried before being slowed.', values: { domain: 'combat', default: 90, min: 0, max: 2000 } },
    ...DAMAGE_STARTER.map(([id, name]) => resist(id, name))
  ],
  line: (def) => {
    const v = def.values
    const on = refillRule(v).on
    return `${String(v.domain)}: ${String(v.default)} (${String(v.min)} to ${String(v.max)})${on.length ? `, refills on ${on.join(', ')}` : ''}`
  },
  addTo: (data, def) => {
    const v = def.values
    data.stats.push({
      id: def.id,
      label: def.name,
      domain: String(v.domain),
      default: Number(v.default),
      min: Number(v.min),
      max: Number(v.max),
      refill: refillRule(v),
      colour: v.colour === 'none' ? null : String(v.colour)
    })
  }
})
