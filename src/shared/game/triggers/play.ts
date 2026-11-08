import { registerTriggerType } from './trigger'

registerTriggerType({
  type: 'play',
  label: 'Actions and decisions',
  icon: 'dices',
  description: 'The actions to roll and decisions to make here, the same as on places and objects.',
  fires: 'interact',
  params: {
    actions: { label: 'Actions', kind: 'text', long: true, default: '', description: 'Actions, written the same way as on a place.' },
    decisions: { label: 'Decisions', kind: 'text', long: true, default: '', description: 'Decisions, written the same way as on a place.' }
  }
})
