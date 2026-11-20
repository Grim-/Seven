import { registerAgentPreset } from '../../engine/agents/presets'
import dmPrompt from './dmPrompt.md?raw'

registerAgentPreset({
  id: 'game_master',
  moduleId: 'game',
  role: 'gameplay',
  name: 'Game Master',
  description: 'Lean default Game Master tuned for living-world play with only world, game, dice, decision, and recall tools.',
  systemPrompt: dmPrompt.trim(),
  modules: ['world', 'game', 'dice', 'decisions', 'mind'],
  roleplay: true,
  permissionMode: 'ask'
})
