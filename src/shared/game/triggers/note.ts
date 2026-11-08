import { registerTriggerType } from './trigger'

registerTriggerType({
  type: 'note',
  label: 'Note',
  icon: 'scroll-text',
  description: 'Shows a note: a sign, an inscription, something noticed.',
  fires: 'interact',
  params: { text: { label: 'Text', kind: 'text', long: true, default: '', description: 'What it says. Markdown.' } }
})
