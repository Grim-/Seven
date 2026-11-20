import { registerResetWhen } from '../spawnRules'

registerResetWhen({ id: 'on_map_enter', due: ({ entering }) => entering })
