import { registerDefType, type StarterDef } from './defs'

const STARTER: StarterDef[] = [
  { id: 'head', name: 'Head', values: { icon: 'hard-hat', countStat: '' } },
  { id: 'chest', name: 'Chest', values: { icon: 'shirt', countStat: '' } },
  { id: 'legs', name: 'Legs', values: { icon: 'footprints', countStat: '' } },
  { id: 'mainHand', name: 'Main hand', values: { icon: 'sword', countStat: '' } },
  { id: 'offHand', name: 'Off hand', values: { icon: 'shield', countStat: '' } },
  { id: 'bag', name: 'Bag', values: { icon: 'backpack', countStat: '' } },
  { id: 'belt', name: 'Belt', values: { icon: 'package', countStat: 'belt' } }
]

registerDefType({
  type: 'slot',
  label: 'Slot',
  plural: 'Slots',
  icon: 'shirt',
  description: 'equipment slots items are worn or wielded in, such as Head or Main hand; one slot, or as many as a stat says (belt slots)',
  params: {
    icon: { label: 'Icon', kind: 'text', default: 'circle', description: 'The icon shown in an empty slot: a Lucide icon name such as shirt, sword or shield.' },
    countStat: { label: 'How many from', kind: 'template', templateKind: 'stat', default: '', description: 'A stat giving how many of this slot a character has (belt 1, belt 2…). Empty for one.' }
  },
  starter: STARTER,
  line: (def) => (def.values.countStat ? `as many as ${String(def.values.countStat)}` : 'one'),
  addTo: (data, def) => {
    data.slots.push({ id: def.id, label: def.name, icon: String(def.values.icon), countStat: def.values.countStat ? String(def.values.countStat) : null })
  }
})
