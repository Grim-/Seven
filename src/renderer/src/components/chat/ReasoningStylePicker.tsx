import { Field, Select } from '../ui'
import { agentGroups, useToolsets } from '../../store/toolsets'
import { useTools } from '../../store/tools'
import { useStyles } from '../mind/Styles'
import { STYLE_OVERRIDE, useChatOverride } from '../../lib/chatOverride'

export function ReasoningStylePicker() {
  const { agent, value, ready, set } = useChatOverride(STYLE_OVERRIDE)
  const modules = useTools((s) => s.list)
  const toolsetList = useToolsets((s) => s.list)
  const styles = useStyles()
  if (!agent || !styles.length || !ready) return null
  if (!agentGroups(agent, toolsetList, modules).includes('mind') || agent.offTools?.includes('reason')) return null
  const fallback = agent.reasoningStyle ?? styles[0]?.name ?? 'none'
  const options = [{ value: '', label: `Style: ${fallback}` }, ...styles.map((s) => ({ value: s.name, label: s.name }))]
  return (
    <Field label="Reasoning style">
      <Select value={value ?? ''} options={options} onChange={(v) => set(v || null)} className="h-8 text-[12px]" />
    </Field>
  )
}
