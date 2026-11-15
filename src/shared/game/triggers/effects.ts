import { registerTriggerType } from './trigger'

registerTriggerType({
  type: 'effects',
  label: 'Effects',
  icon: 'sparkles',
  description: 'Casts effects on whoever sets it off: a trap, a healing spring, a way to another map.',
  fires: 'enter',
  params: {
    caster: { label: 'Cast by', kind: 'text', default: '', description: 'An object on this map that casts the effects, with its pieces. Empty: the trigger casts them.' },
    effects: { label: 'Effects', kind: 'components', host: 'effects', default: [], description: 'What happens to whoever sets it off.' }
  }
})
