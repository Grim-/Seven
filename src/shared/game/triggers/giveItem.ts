import { ITEM_TEMPLATES } from '../defs/templates'
import { registerTriggerType } from './trigger'

registerTriggerType({
  type: 'give_item',
  label: 'Give an item',
  icon: 'gift',
  description: 'Gives items and gold to the character who finds it.',
  fires: 'interact',
  params: {
    item: { label: 'Item', kind: 'template', templateKind: ITEM_TEMPLATES, default: '', description: 'The item to give. None gives only gold.' },
    count: { label: 'How many', kind: 'number', default: 1, min: 1, max: 999, description: 'How many of the item.' },
    gold: { label: 'Gold', kind: 'number', default: 0, min: 0, description: 'Gold to give as well.' },
    text: { label: 'Text', kind: 'text', long: true, default: '', description: 'What is found, shown with the items.' }
  }
})
