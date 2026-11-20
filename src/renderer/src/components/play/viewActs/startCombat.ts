import { useGameState } from '../state/gameStateStore'
import { registerViewAct } from './registry'
import { spawnBeside } from './spawn'

registerViewAct('start_combat', async (data, { host, token }) => {
  if (!token || !token.visitor.sheet) return
  const foe = await spawnBeside(host, token, data)
  if (!foe) return
  await useGameState.getState().startBattle(token.visitor.sheet, [foe.uid])
})
