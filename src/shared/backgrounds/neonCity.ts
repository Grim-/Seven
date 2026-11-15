import { registerBackgroundInfo } from './registry'

registerBackgroundInfo({
  id: 'neon-city',
  name: 'Neon cityscape',
  description: 'A skyline drifting under a rising and setting moon, with light trails along the horizon.',
  reactions: [
    { name: 'light_trail', description: 'A bright light trail races along the horizon' },
    { name: 'moonrise', description: 'The moon rises and the sky glows, then settles' }
  ],
  settings: [
    { name: 'moonRadius', label: 'Moon size', type: 'range', min: 20, max: 300, step: 1, default: 100 },
    { name: 'starCount', label: 'Stars', type: 'range', min: 0, max: 600, step: 10, default: 150 },
    { name: 'moonColor', label: 'Moon colour', type: 'color', default: '#1ccaed' },
    { name: 'speed', label: 'Speed', type: 'range', min: 0, max: 3, step: 0.1, default: 1 }
  ]
})
