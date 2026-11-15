import { catalogFrom } from '@shared/game/defs'
import { GameEntity, type EntityRecord } from '@shared/game/core'
import { Health } from '@shared/game/components'
import { registerTokenSource } from '../../engine/worlds/tokenSources'
import { gameDefs } from './store'

function hpOf(record: EntityRecord, catalog: ReturnType<typeof catalogFrom>): { cur: number; max: number } | null {
  const entity = GameEntity.fromRecord(record, catalog)
  const health = entity.comp(Health)
  return health ? { cur: Math.round(health.get()), max: Math.round(health.max()) } : null
}

registerTokenSource({
  id: 'creature',
  module: 'game',
  label: 'Creatures',
  owns: (token, save) => Boolean(save?.creatures.some((c) => c.uid === token)),
  resolve: (tokens, save) => {
    const catalog = catalogFrom(gameDefs.catalog())
    return (save?.creatures ?? [])
      .filter((c) => tokens.includes(c.uid))
      .map((c) => ({
        token: c.uid,
        source: 'creature',
        sheet: '',
        name: c.name,
        image: null,
        line: c.template.id,
        dnd: null,
        game: c,
        faction: c.faction || null,
        agent: null,
        hp: hpOf(c, catalog)
      }))
  },
  removed: (token, save) => ({ ...save, creatures: save.creatures.filter((c) => c.uid !== token) })
})
