import { registerTokenSource } from '../../engine/worlds/tokenSources'
import { worlds } from '../../engine/worlds/store'

registerTokenSource({
  id: 'creature',
  owns: (token, save) => Boolean(save?.creatures.some((c) => c.uid === token)),
  resolve: (tokens, save, world) => {
    const rules = worlds.exists(world) ? worlds.meta(world).rules : ''
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
        gameRules: rules,
        faction: c.faction || null,
        agent: null,
        hp: null
      }))
  },
  removed: (token, save) => ({ ...save, creatures: save.creatures.filter((c) => c.uid !== token) })
})
