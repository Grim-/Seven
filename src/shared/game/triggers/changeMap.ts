import { registerTriggerType } from './trigger'

registerTriggerType({
  type: 'change_map',
  label: 'Go to another map',
  icon: 'door-open',
  description: 'A way into another map of this world: a door, a stair, a road off the edge.',
  fires: 'enter',
  params: {
    map: { label: 'Map', kind: 'text', default: '', description: 'The map it leads to.' },
    place: { label: 'Arrive at', kind: 'text', default: '', description: 'The place on that map to arrive at. None arrives in the middle.' }
  }
})
