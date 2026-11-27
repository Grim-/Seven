import { registerAvatarTreatment } from './registry'

registerAvatarTreatment({
  id: 'chromatic',
  label: 'Chromatic split',
  description: 'Red, green and blue drift apart around the shape.',
  settings: [
    { name: 'distance', label: 'Distance', type: 'range', min: 0, max: 10, step: 0.25, default: 2 },
    { name: 'drift', label: 'Drift speed', type: 'range', min: 0, max: 3, step: 0.05, default: 0.6 },
    { name: 'angle', label: 'Angle', type: 'range', min: 0, max: 360, step: 5, default: 0 }
  ],
  poseSettings: ['distance', 'drift', 'angle'],
  animates: true,
  bleed: 0.04
})
