import { registerAvatarTreatment } from './registry'

registerAvatarTreatment({
  id: 'vhs',
  label: 'VHS tracking',
  description: 'Worn tape: a rolling warped band, smeared edges, colour bleed and noise.',
  settings: [
    { name: 'band', label: 'Band height', type: 'range', min: 0.02, max: 0.4, step: 0.01, default: 0.12 },
    { name: 'roll', label: 'Roll speed', type: 'range', min: 0, max: 1, step: 0.05, default: 0.25 },
    { name: 'warp', label: 'Warp', type: 'range', min: 0, max: 12, step: 0.5, default: 4 },
    { name: 'smear', label: 'Smear', type: 'range', min: 0, max: 8, step: 0.5, default: 2.5 },
    { name: 'colourBleed', label: 'Colour bleed', type: 'range', min: 0, max: 4, step: 0.1, default: 1.2 },
    { name: 'noise', label: 'Noise', type: 'range', min: 0, max: 1, step: 0.05, default: 0.25 }
  ],
  poseSettings: ['band', 'roll', 'warp', 'smear', 'colourBleed', 'noise'],
  animates: true,
  bleed: 0
})
