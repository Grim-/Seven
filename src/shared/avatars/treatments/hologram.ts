import { registerAvatarTreatment } from './registry'

registerAvatarTreatment({
  id: 'hologram',
  label: 'Hologram',
  description: 'A projected image: tinted scan lines, drifting slices, colour fringe, a light cone and rolling dropouts.',
  settings: [
    { name: 'tint', label: 'Tint', type: 'color', themed: true, default: 'secondary' },
    { name: 'tintAmount', label: 'Tint amount', type: 'range', min: 0, max: 1, step: 0.05, default: 0.35 },
    { name: 'lines', label: 'Line gap', type: 'range', min: 2, max: 8, step: 1, default: 3 },
    { name: 'lineDark', label: 'Line depth', type: 'range', min: 0, max: 1, step: 0.05, default: 0.35 },
    { name: 'jitter', label: 'Slice drift', type: 'range', min: 0, max: 6, step: 0.25, default: 1 },
    { name: 'fringe', label: 'Fringe', type: 'range', min: 0, max: 6, step: 0.25, default: 1.5 },
    { name: 'cone', label: 'Light cone', type: 'range', min: 0, max: 1, step: 0.05, default: 0.25 },
    { name: 'dropout', label: 'Dropouts', type: 'range', min: 0, max: 1, step: 0.05, default: 0.2 },
    { name: 'flicker', label: 'Flicker', type: 'range', min: 0, max: 1, step: 0.05, default: 0.15 }
  ],
  poseSettings: ['tint', 'tintAmount', 'lines', 'lineDark', 'jitter', 'fringe', 'cone', 'dropout', 'flicker'],
  animates: true,
  bleed: 0.12
})
