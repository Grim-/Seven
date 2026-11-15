import { registerAvatarRenderer } from './registry'

const SKULL = (eyes: string, mouth: string) => `  .---.  \n / ${eyes} \\ \n |( )  | \n \\ ${mouth} / \n  '-'    `

registerAvatarRenderer({
  id: 'glyph',
  label: 'Glyph',
  description: 'Text-art faces that change frame by frame, with glow, shake, bob and pulse.',
  settings: [
    { name: 'frames', label: 'Frames', type: 'frames', group: 'look', default: ['( • _ • )'] },
    { name: 'speed', label: 'Frame time (ms)', type: 'range', group: 'look', min: 40, max: 2000, step: 10, default: 400 },
    { name: 'color', label: 'Colour', type: 'color', group: 'look', themed: true, default: 'accent' },
    { name: 'glow', label: 'Glow', type: 'range', group: 'look', min: 0, max: 30, step: 1, default: 8 },
    { name: 'blinks', label: 'Idle glances', type: 'frames', group: 'glances', default: ['( - _ - )'] },
    { name: 'blinkEvery', label: 'Glance every (s)', type: 'range', group: 'glances', min: 0, max: 20, step: 0.5, default: 4 },
    { name: 'blinkFor', label: 'Glance length (ms)', type: 'range', group: 'glances', min: 80, max: 3000, step: 20, default: 900 },
    { name: 'breathe', label: 'Breathe', type: 'range', group: 'motion', min: 0, max: 0.08, step: 0.005, default: 0 },
    { name: 'bob', label: 'Bob', type: 'range', group: 'motion', min: 0, max: 8, step: 0.5, default: 0 },
    { name: 'droop', label: 'Droop', type: 'range', group: 'motion', min: 0, max: 8, step: 0.5, default: 0 },
    { name: 'shake', label: 'Shake', type: 'range', group: 'motion', min: 0, max: 8, step: 0.5, default: 0 },
    { name: 'pulse', label: 'Pulse', type: 'range', group: 'motion', min: 0, max: 6, step: 0.1, default: 0 },
    { name: 'flicker', label: 'Flicker', type: 'range', group: 'motion', min: 0, max: 1, step: 0.05, default: 0 }
  ],
  poseSettings: ['frames', 'speed', 'color', 'glow', 'breathe', 'bob', 'droop', 'shake', 'pulse', 'flicker'],
  stillAt: ['dot'],
  builtins: [
    {
      id: 'ascii_face',
      name: 'ASCII face',
      description: 'A small text face that glances around, talks and emotes.',
      settings: {
        frames: ['( • _ • )'],
        blinks: ['( - _ - )', '( - _ - )', '(•_•  )', '(  •_•)', '( • ‿ • )', '( • _ • )?', '( ¬ _ ¬ )', '( • _ • ) ♪', '( ᵕ o ᵕ ) zz'],
        breathe: 0.02
      },
      poses: {
        thinking: { frames: ['( ¬ _ ¬ )', '( ¬ _ ¬ ) .', '( ¬ _ ¬ ) ..', '( ¬ _ ¬ ) ...'], speed: 420 },
        tool: { frames: ['(> ⌐■-■)> HM', '(> ⌐■-■)> HM.', '(> ⌐■-■)> HM..', '(> ⌐■-■)> HM...'], speed: 380 },
        talking: { frames: ['( • o • )', '( • _ • )', '( • O • )', '( • ‿ • )'], speed: 150 },
        laughing: { frames: ['( ≧▽≦) HA HA', '(≧▽≦ ) HA HA', '( ≧▽≦)HA HA '], speed: 170, shake: 2 },
        happy: { frames: ['( ^ ‿ ^ )', '( ^ ▽ ^ )'], speed: 650, bob: 3 },
        sad: { frames: ['( ╥ _ ╥ )', '( ╥ ﹏ ╥ )'], speed: 900, color: '#7aa2ff', droop: 3 },
        error: { frames: ['( x_x ) ERR', '( x_x )    '], speed: 320, color: '#ff3b3b', flicker: 0.35 },
        angry: { frames: ['( ╬ Ò ﹏ Ó )', '( ╬ Ò 益 Ó )'], speed: 140, color: '#ff1e3c', shake: 2.5 }
      }
    },
    {
      id: 'ascii_hd',
      name: 'ASCII skull',
      description: 'A larger text skull that blinks, talks and glows with its mood.',
      settings: {
        frames: [...Array(9).fill(SKULL('_ _', ' = ')), SKULL('- -', ' = ')],
        speed: 250,
        blinkEvery: 0,
        glow: 10
      },
      poses: {
        thinking: { frames: [SKULL('° °', '.  '), SKULL('° °', '.. '), SKULL('° °', '...')], speed: 333, pulse: 1.5 },
        tool: { frames: [SKULL('° °', '.  '), SKULL('° °', '.. '), SKULL('° °', '...')], speed: 333, pulse: 1.5 },
        talking: { frames: [SKULL('_ _', ' O '), SKULL('_ _', '===')], speed: 100 },
        laughing: { frames: [SKULL('^ ^', '\\▽/'), SKULL('> <', '\\▽/')], speed: 125, color: '#facc15', shake: 3 },
        happy: { frames: [SKULL('^ ^', ' ‿ '), SKULL('^ ^', ' ▽ ')], speed: 500, color: '#4ade80', glow: 12 },
        sad: { frames: [SKULL('╥ ╥', ' ~ '), SKULL('╥ ╥', ' _ ')], speed: 1000, color: '#7aa2ff', pulse: 0.6 },
        angry: { frames: [SKULL('> <', '===')], speed: 66, color: '#ff0000', shake: 4 },
        error: { frames: [SKULL('> <', '===')], speed: 66, color: '#ff0000', shake: 4 }
      }
    }
  ]
})
