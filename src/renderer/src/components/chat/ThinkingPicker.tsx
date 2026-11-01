import { THINKING_OVERRIDE, useChatOverride } from '../../lib/chatOverride'
import { thinkingLabel } from '../../lib/thinking'
import { ThinkingSelect } from './ThinkingSelect'

export function ThinkingPicker() {
  const { agent, value, ready, set } = useChatOverride(THINKING_OVERRIDE)
  if (!agent || !ready) return null
  return <ThinkingSelect value={value} fallback={agent.thinking ? thinkingLabel(agent.thinking) : "the model's setting"} hint="How much the model thinks before replying in this chat. Token limits for each level are set per model in Models." onChange={set} />
}
