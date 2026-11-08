import { ITEM_TEMPLATES } from '../defs/templates'
import { registerTriggerType } from './trigger'

registerTriggerType({
  type: 'shop',
  label: 'Shop',
  icon: 'store',
  description: 'A shop: buy its stock and sell from the bag, with gold at the items\' value.',
  fires: 'interact',
  params: {
    stock: { label: 'Stock', kind: 'list', default: [], of: { kind: 'template', templateKind: ITEM_TEMPLATES, default: '', description: 'An item it sells.' }, description: 'The items it sells, as many as are wanted.' },
    buyRate: { label: 'Buy price', kind: 'number', default: 1, min: 0, description: 'Times the item\'s value paid to buy one.' },
    sellRate: { label: 'Sell price', kind: 'number', default: 0.5, min: 0, description: 'Times the item\'s value paid for one sold here. 0 buys nothing.' },
    text: { label: 'Text', kind: 'text', long: true, default: '', description: 'What the shopkeeper says.' }
  }
})
