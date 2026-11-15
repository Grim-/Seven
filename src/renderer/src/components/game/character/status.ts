import { showName } from '@shared/ids'
import { Buff, Buffs } from '@shared/game/components'
import type { ComponentRecord } from '@shared/game/core/Component'
import { statusSources } from '../../chat/status/characterStatus'

const buffsIn = (comps: ComponentRecord[]): string[] =>
  comps
    .filter((c) => c.type === Buffs.type)
    .flatMap((b) => b.comps.filter((c) => c.type === Buff.type))
    .map((b) => showName(String(b.params.id ?? b.type)))

statusSources.add({
  id: 'game',
  module: 'game',
  name: 'Buffs',
  order: 20,
  read: (sheet) => (sheet.game ? { effects: buffsIn(sheet.game.comps) } : {})
})
