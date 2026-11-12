import { TOOL_CHOICE_OVERRIDE, useChatOverride } from '../../lib/chatOverride'
import { ToolChoiceSelect, toolChoiceLabel } from './ToolChoiceSelect'

export function ToolChoicePicker() {
  const { agent, value, ready, set } = useChatOverride(TOOL_CHOICE_OVERRIDE)
  if (!agent || !ready) return null
  return (
    <ToolChoiceSelect
      value={value}
      fallback={agent.toolChoice ? toolChoiceLabel(agent.toolChoice) : 'Auto (Model decides)'}
      onChange={set}
    />
  )
}
