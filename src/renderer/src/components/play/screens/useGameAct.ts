import { useState } from 'react'
import { GameEntity, type Catalog, type EntityRecord } from '@shared/game/core'
import { engine } from '../../../lib/ipc'
import { failed } from '../../../lib/notify'
import { toast } from '../../../store/toasts'
import type { GameAct } from './registry'

export function useGameAct(sheet: string, record: EntityRecord, catalog: Catalog): { shown: EntityRecord; act: GameAct } {
  const [mine, setMine] = useState<{ from: EntityRecord; to: EntityRecord } | null>(null)
  const shown = mine && mine.from === record ? mine.to : record
  const act: GameAct = (change) => {
    const entity = GameEntity.fromRecord(shown, catalog)
    entity.start()
    const done = change(entity)
    const next = entity.toRecord()
    entity.stop()
    if (done !== true) return void toast.error('Could not do that', done)
    setMine({ from: record, to: next })
    void engine('game.saveCharacter', { sheet, record: next }).catch(failed('Could not save the character'))
  }
  return { shown, act }
}
