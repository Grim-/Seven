import { registerDefType } from './defs'

registerDefType({
  type: 'formula',
  label: 'Formula',
  plural: 'Formulas',
  icon: 'sigma',
  description: 'the game rules written as formulas, such as how much damage gets through; the game looks each up by its id',
  params: {
    formula: { label: 'Formula', kind: 'formula', default: '0', description: 'Numbers, + - * / % ^, min max floor ceil round abs clamp, dice like 2d6, and the names the rule gives.' }
  },
  starter: [
    {
      id: 'damage',
      name: 'Damage',
      notes: 'How much damage gets through. power is the damage rolled, resist is the target’s resist for the damage type, scalestat is the attacker’s scaling stat (0 if the type has none), floor is 1 for a direct hit and 0 for damage over time. The first part keeps a direct hit at 1 or more unless the target is immune.',
      values: { formula: 'max(floor * ceil(clamp(1 - resist, 0, 1)), round(power * (1 - resist)))' }
    }
  ],
  line: (def) => String(def.values.formula),
  addTo: (data, def) => {
    data.formulas[def.id] = String(def.values.formula)
  }
})
