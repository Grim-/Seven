import { combatantFromVisitor } from '@shared/game/state/BattleStateMachine'
import { engine } from '../../../lib/ipc'
import { useGameState } from '../state/gameStateStore'
import { registerViewAct } from './registry'
import { spawnBeside } from './spawn'

registerViewAct('start_combat', async (data, { host, token }) => {
  if (!token) return
  const foe = await spawnBeside(host, token, data)
  if (!foe) return
  const [visitor] = await engine('places.tokens', { world: host.world, tokens: [foe.uid] })
  if (!visitor) return
  useGameState.getState().startBattle([combatantFromVisitor(token.visitor, token.at, true), combatantFromVisitor(visitor, foe.at, false, foe.uid)])
})
