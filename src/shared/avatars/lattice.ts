import type { SettingValues } from '../settingSpec'
import { registerAvatarRenderer } from './registry'

const pose = (speed: number, decay: number, noise: number, reach: number, flex: number, net: string, core: string, virus: string, label: string, cores: string[], extra: SettingValues = {}): SettingValues => ({ speed, decay, noise, reach, flex, net, core, virus, label, cores, ...extra })

const ANGRY = pose(70, 0.52, 0.3, 6, 2.2, '#7f1d1d', '#ff1e3c', '#ff8a00', 'blackwall breach', ['╳', '╬', '╪', '╳'], { tear: 0.75, tearSize: 14 })

registerAvatarRenderer({
  id: 'lattice',
  label: 'Lattice',
  description: 'A pulsing grid core with reaching arms, drifting glyph noise and glitch tearing.',
  settings: [
    { name: 'speed', label: 'Tick (ms)', type: 'range', min: 30, max: 1000, step: 5, default: 260 },
    { name: 'decay', label: 'Decay', type: 'range', min: 0, max: 1, step: 0.01, default: 0.18 },
    { name: 'noise', label: 'Noise', type: 'range', min: 0, max: 1, step: 0.005, default: 0.015 },
    { name: 'reach', label: 'Reach', type: 'range', min: 0, max: 8, step: 1, default: 2 },
    { name: 'flex', label: 'Flex', type: 'range', min: 0, max: 4, step: 0.1, default: 0.7 },
    { name: 'packets', label: 'Packets', type: 'toggle', default: true },
    { name: 'tear', label: 'Tear chance', type: 'range', min: 0, max: 1, step: 0.01, default: 0.18 },
    { name: 'tearSize', label: 'Tear size', type: 'range', min: 0, max: 30, step: 1, default: 5 },
    { name: 'net', label: 'Grid colour', type: 'color', themed: true, default: '#5b21b6' },
    { name: 'core', label: 'Core colour', type: 'color', themed: true, default: '#22d3ee' },
    { name: 'virus', label: 'Noise colour', type: 'color', themed: true, default: '#a855f7' },
    { name: 'cores', label: 'Core frames', type: 'frames', default: ['╬', '╫', '╬', '╪'] },
    { name: 'label', label: 'State label', type: 'text', default: 'dormant' },
    { name: 'tag', label: 'Name tag', type: 'text', default: 'daemon.7f' },
    { name: 'scanlines', label: 'Scanlines', type: 'toggle', default: true }
  ],
  poseSettings: ['speed', 'decay', 'noise', 'reach', 'flex', 'packets', 'tear', 'tearSize', 'net', 'core', 'virus', 'cores', 'label'],
  stillAt: ['dot'],
  builtins: [
    {
      id: 'glitch_skull',
      name: 'Glitch skull',
      description: 'A daemon core in a decaying grid that surges and tears with its mood.',
      settings: { packets: false },
      poses: {
        talking: pose(110, 0.32, 0.05, 4, 1.6, '#155e75', '#ff2fb3', '#22d3ee', 'streaming', ['╬', '╋', '╬', '╈'], { packets: true }),
        thinking: pose(170, 0.22, 0.03, 3, 1.2, '#1e3a8a', '#22d3ee', '#818cf8', 'processing', ['◐', '◓', '◑', '◒'], { packets: true }),
        tool: pose(170, 0.22, 0.03, 3, 1.2, '#1e3a8a', '#22d3ee', '#818cf8', 'processing', ['◐', '◓', '◑', '◒'], { packets: true }),
        laughing: pose(75, 0.28, 0.12, 5, 2.4, '#713f12', '#facc15', '#fb923c', 'overclock', ['✶', '✷', '✸', '✹'], { packets: true }),
        happy: pose(150, 0.15, 0.02, 4, 1, '#14532d', '#4ade80', '#22d3ee', 'stable', ['◆', '◇', '◆', '◈'], { packets: true }),
        sad: pose(420, 0.38, 0.01, 1, 0.4, '#1e293b', '#60a5fa', '#334155', 'degraded', ['·', '∙', '·', '•'], { packets: true }),
        angry: { ...ANGRY, packets: true },
        error: { ...ANGRY, packets: true }
      }
    }
  ]
})
