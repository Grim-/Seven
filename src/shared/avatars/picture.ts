import type { Avatar } from './registry'
import { registerAvatarRenderer } from './registry'

export const PICTURE_RENDERER = 'picture'

registerAvatarRenderer({
  id: PICTURE_RENDERER,
  label: 'Picture',
  description: 'A picture, GIF or video that breathes, leans toward the pointer and shifts colour with the mood.',
  settings: [
    { name: 'picture', label: 'Picture', type: 'picture', group: 'look', default: '' },
    { name: 'frames', label: 'Frame sequence', type: 'frames', group: 'frames', default: [], hint: 'Optional per-frame media or text captions cycled by frame time.' },
    { name: 'speed', label: 'Frame time (ms)', type: 'range', group: 'frames', min: 40, max: 2000, step: 10, default: 400 },
    { name: 'motion', label: 'Motion', type: 'range', group: 'motion', min: 0, max: 2, step: 0.1, default: 1 },
    { name: 'lean', label: 'Lean toward pointer', type: 'range', group: 'motion', min: 0, max: 8, step: 0.5, default: 2 },
    { name: 'tint', label: 'Mood colour', type: 'range', group: 'look', min: 0, max: 1, step: 0.05, default: 0.4 },
    { name: 'scan', label: 'Scan line', type: 'range', group: 'look', min: 0, max: 1, step: 0.05, default: 0 }
  ],
  poseSettings: ['picture', 'frames', 'speed', 'motion', 'tint', 'scan'],
  stillAt: [],
  builtins: []
})

export function pictureAvatar(assetId: string): Avatar {
  return { id: `file:${assetId}`, name: 'Picture', description: '', renderer: PICTURE_RENDERER, settings: { picture: assetId, motion: 1, lean: 2, tint: 0.4, scan: 0 }, poses: { thinking: { scan: 0.45 }, tool: { scan: 0.45 } }, createdAt: 0, updatedAt: 0 }
}
