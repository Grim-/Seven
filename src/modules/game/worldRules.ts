import { ToolError } from '../../engine/tools/types'
import { worlds } from '../../engine/worlds/store'
import { gameDefs } from './store'

export function worldRuleSet(world: string): string {
  return gameDefs.resolve(worlds.meta(world).rules)
}

export function removeRuleSet(id: string): boolean {
  const users = worlds.list().filter((w) => w.rules === id)
  if (users.length) throw new ToolError(`${users.map((w) => w.name).join(', ')} ${users.length === 1 ? 'plays' : 'play'} by this rule set. Pick another rule set for ${users.length === 1 ? 'it' : 'them'} first.`)
  return gameDefs.removeRuleSet(id)
}
