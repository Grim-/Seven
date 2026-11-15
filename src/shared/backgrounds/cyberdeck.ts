import { registerBackgroundInfo } from './registry'

registerBackgroundInfo({
  id: 'cyberdeck',
  name: 'Cyberdeck',
  description: 'Optic framing, corner readouts, a slow scanline and drifting data, in the theme colours.',
  reactions: [
    { name: 'warning', description: 'Goes red alert for a few seconds' },
    { name: 'glitch', description: 'A burst of scanline glitches' }
  ],
  settings: []
})
