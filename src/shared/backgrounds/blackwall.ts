import { registerBackgroundInfo } from './registry'

registerBackgroundInfo({
  id: 'blackwall',
  name: 'Blackwall',
  description: 'A wall of dark panels with red bleeding through it and slow breaches.',
  reactions: [
    { name: 'breach', description: 'Something breaks through the wall' },
    { name: 'face', description: 'A face shows through the wall for a moment' }
  ],
  settings: []
})
