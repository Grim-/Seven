import { registerResetWhen } from '../spawnRules'

registerResetWhen({ id: 'on_rest', due: ({ save, spawnedAt }) => save.longRestAt !== undefined && spawnedAt !== null && save.longRestAt > spawnedAt })
