import { registerDefType } from './defs'
import { DAMAGE_STARTER } from './stat'

registerDefType({
  type: 'damage_type',
  label: 'Damage type',
  plural: 'Damage types',
  icon: 'flame',
  description: 'kinds of damage (fire, radiant, slashing…): the resist stat that reduces each and the stat that scales it',
  params: {
    resistedBy: { label: 'Reduced by', kind: 'template', templateKind: 'stat', default: '', description: 'The stat on the target that reduces this damage.' },
    scalesWith: { label: 'Scales with', kind: 'template', templateKind: 'stat', default: '', description: 'A stat on the attacker the damage formula can use as scalestat. Empty for none.' }
  },
  starter: DAMAGE_STARTER.map(([id, name]) => ({ id, name, values: { resistedBy: `${id}_resist`, scalesWith: '' } })),
  line: (def) => `reduced by ${String(def.values.resistedBy) || 'nothing'}${def.values.scalesWith ? `, scales with ${String(def.values.scalesWith)}` : ''}`,
  addTo: (data, def) => {
    data.damageTypes.push({ id: def.id, label: def.name, resistedBy: String(def.values.resistedBy), scalesWith: String(def.values.scalesWith) || null })
  }
})
