import { registerResetWhen, registerSpawnWhen } from '../spawnRules'

registerSpawnWhen({ id: 'on_flag', due: ({ spawner, save }) => Boolean(spawner.spawnFlag && save.flags[spawner.spawnFlag]) })
registerResetWhen({ id: 'on_flag', due: ({ spawner, save }) => Boolean(spawner.resetFlag && save.flags[spawner.resetFlag]) })
