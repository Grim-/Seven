import { registerAvatarTreatment } from './registry'

registerAvatarTreatment({
  id: 'broadcast',
  label: 'Broadcast',
  description: 'A stuttering transmission: frames hold and repeat, bands jump sideways, lines interlace, a line field turns behind.',
  settings: [
    { name: 'stutter', label: 'Stutters per second', type: 'range', min: 0, max: 3, step: 0.05, default: 0.6 },
    { name: 'hold', label: 'Hold (ms)', type: 'range', min: 60, max: 600, step: 10, default: 180 },
    { name: 'bands', label: 'Band jumps per second', type: 'range', min: 0, max: 4, step: 0.05, default: 0.8 },
    { name: 'jump', label: 'Jump distance', type: 'range', min: 0, max: 20, step: 0.5, default: 6 },
    { name: 'interlace', label: 'Interlace', type: 'toggle', default: true },
    { name: 'field', label: 'Line field', type: 'toggle', default: false },
    { name: 'fieldColor', label: 'Field colour', type: 'color', themed: true, default: 'secondary' },
    { name: 'fieldSpeed', label: 'Field speed', type: 'range', min: 0, max: 2, step: 0.05, default: 0.4 }
  ],
  poseSettings: ['stutter', 'hold', 'bands', 'jump', 'interlace', 'field', 'fieldColor', 'fieldSpeed'],
  animates: true,
  bleed: 0
})
