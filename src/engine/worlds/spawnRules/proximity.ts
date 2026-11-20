import { registerSpawnWhen } from '../spawnRules'

registerSpawnWhen({
  id: 'proximity',
  due: ({ spawner, party }) => {
    const radius = spawner.triggerRadius ?? 0
    return party.some((at) => Math.hypot(at.x - spawner.at.x, at.y - spawner.at.y) <= radius)
  }
})
