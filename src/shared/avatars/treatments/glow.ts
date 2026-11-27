import { registerAvatarTreatment } from './registry'

registerAvatarTreatment({
  id: 'glow',
  label: 'Glow',
  description: 'Soft light suffusing out from the shape, breathing with a slow pulse.',
  settings: [
    { name: 'color', label: 'Colour', type: 'color', themed: true, default: 'accent' },
    { name: 'mood', label: 'Follow mood', type: 'toggle', default: false },
    { name: 'spread', label: 'Spread', type: 'range', min: 0.02, max: 0.35, step: 0.01, default: 0.14 },
    { name: 'softness', label: 'Softness', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    { name: 'strength', label: 'Strength', type: 'range', min: 0, max: 2, step: 0.05, default: 1 },
    { name: 'pulse', label: 'Pulse speed', type: 'range', min: 0, max: 2, step: 0.05, default: 0.35 },
    { name: 'depth', label: 'Pulse depth', type: 'range', min: 0, max: 1, step: 0.05, default: 0.4 }
  ],
  poseSettings: ['color', 'mood', 'spread', 'softness', 'strength', 'pulse', 'depth'],
  animates: true,
  bleed: 0.35,
  from: 'portrait'
})
