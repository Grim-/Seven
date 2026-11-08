import { registerDefType, type StarterDef } from './defs'

const ATTRIBUTES: [string, string][] = [
  ['str', 'Strength'],
  ['dex', 'Dexterity'],
  ['con', 'Constitution'],
  ['int', 'Intelligence'],
  ['wis', 'Wisdom'],
  ['cha', 'Charisma']
]

const SKILLS: [string, string, string][] = [
  ['acrobatics', 'Acrobatics', 'dex'],
  ['animal_handling', 'Animal Handling', 'wis'],
  ['arcana', 'Arcana', 'int'],
  ['athletics', 'Athletics', 'str'],
  ['deception', 'Deception', 'cha'],
  ['history', 'History', 'int'],
  ['insight', 'Insight', 'wis'],
  ['intimidation', 'Intimidation', 'cha'],
  ['investigation', 'Investigation', 'int'],
  ['medicine', 'Medicine', 'wis'],
  ['nature', 'Nature', 'int'],
  ['perception', 'Perception', 'wis'],
  ['performance', 'Performance', 'cha'],
  ['persuasion', 'Persuasion', 'cha'],
  ['religion', 'Religion', 'int'],
  ['sleight_of_hand', 'Sleight of Hand', 'dex'],
  ['stealth', 'Stealth', 'dex'],
  ['survival', 'Survival', 'wis']
]

const modifier = (stat: string) => `floor((user.${stat} - 10) / 2)`

const STARTER: StarterDef[] = [
  ...ATTRIBUTES.map(([stat, name]) => ({ id: stat, name, values: { group: 'attribute', dice: '1d20', bonus: modifier(stat) } })),
  ...SKILLS.map(([id, name, stat]) => ({ id, name, values: { group: 'skill', dice: '1d20', bonus: modifier(stat) } }))
]

registerDefType({
  type: 'check',
  label: 'Check',
  plural: 'Checks',
  icon: 'dices',
  description: 'rolls the game asks a character for, such as Perception or a Strength check: the dice and the bonus from the roller’s stats',
  params: {
    group: { label: 'Group', kind: 'text', default: 'skill', description: 'Where it is listed, such as attribute or skill.' },
    dice: { label: 'Dice', kind: 'formula', default: '1d20', description: 'The roll. Dice like 1d20; max(1d20, 1d20) keeps the higher of two.' },
    bonus: { label: 'Bonus', kind: 'formula', default: '0', description: 'Added to the roll. Reads the roller’s stats as user.<stat id>, such as floor((user.wis - 10) / 2).' }
  },
  starter: STARTER,
  line: (def) => `${String(def.values.dice)} + ${String(def.values.bonus)}`,
  addTo: (data, def) => {
    data.checks.push({ id: def.id, label: def.name, group: String(def.values.group), dice: String(def.values.dice), bonus: String(def.values.bonus) })
  }
})
