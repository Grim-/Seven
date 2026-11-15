import { engine } from '../../../lib/ipc'
import { healthWriters } from '../../chat/status/characterStatus'

healthWriters.add({
  id: 'game',
  module: 'game',
  name: 'Game health',
  order: 20,
  change: (sheet, delta) => (sheet.game ? engine('game.changeHealth', { sheet: sheet.id, delta }) : null)
})
