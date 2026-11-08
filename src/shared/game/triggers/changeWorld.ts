import { registerTriggerType } from './trigger'

registerTriggerType({
  type: 'change_world',
  label: 'Go to another world',
  icon: 'globe',
  description: 'A way into another world: a portal, a ship, the edge of the map. The character leaves this save and joins one of that world’s saves.',
  fires: 'enter',
  params: {
    world: { label: 'World', kind: 'text', default: '', description: 'The world it leads to.' },
    map: { label: 'Map', kind: 'text', default: '', description: 'The map of that world to arrive on. None uses its first map.' },
    place: { label: 'Arrive at', kind: 'text', default: '', description: 'The place on that map to arrive at. None arrives in the middle.' }
  }
})
