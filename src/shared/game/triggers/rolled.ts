import { registerTriggerType } from './trigger'

registerTriggerType({
  type: 'rolled',
  label: 'Rolled decision',
  icon: 'hexagon',
  description: 'A die picks what happens: one option per face, rolled the same way as rolled decisions in chat.',
  fires: 'interact',
  params: {
    question: { label: 'What the die decides', kind: 'text', default: '', description: 'Shown at the top. Empty uses the trigger name.' },
    die: { label: 'Die', kind: 'number', default: 6, min: 2, description: 'Faces on the die. It needs one option per face.' },
    options: { label: 'Options', kind: 'list', default: [], of: { kind: 'text', default: '', description: 'What happens on this face.' }, description: 'One per face, in order: the first is a 1.' }
  }
})
