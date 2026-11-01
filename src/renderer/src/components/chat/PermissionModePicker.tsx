import type { PermissionMode } from '@shared/types'
import { PERMISSION_MODES } from '@shared/types'
import { Field, Select, Tooltip } from '../ui'
import { useSessions } from '../../store/sessions'
import { useAgents } from '../../store/agents'
import { agentGroups, useToolsets } from '../../store/toolsets'
import { useTools } from '../../store/tools'
import { cn } from '../../lib/cn'
import { failed } from '../../lib/notify'
import { useConversation } from '../../lib/conversation'

export function PermissionModePicker({ compact = false, labelled = false }: { compact?: boolean; labelled?: boolean }) {
  const { sessionId: activeId } = useConversation()
  const meta = useSessions((s) => s.list.find((x) => x.id === activeId))
  const setMode = useSessions((s) => s.setMode)
  const agent = useAgents((s) => s.list.find((a) => a.id === meta?.agentId))
  const modules = useTools((s) => s.list)
  const toolsetList = useToolsets((s) => s.list)
  if (!activeId || !meta || !agent) return null
  const groups = agentGroups(agent, toolsetList, modules)
  const uses = modules.filter((m) => groups.includes(m.id) && m.state === 'on')
  if (!uses.some((m) => m.needsWorkspace || m.tools.some((t) => t.permission === 'ask'))) return null
  const mode: PermissionMode = meta.permissionMode ?? agent.permissionMode
  const info = PERMISSION_MODES.find((m) => m.id === mode)
  const select = (
    <Select
      value={mode}
      options={PERMISSION_MODES.map((m) => ({ value: m.id, label: m.label }))}
      onChange={(v) => setMode(activeId, v as PermissionMode).catch(failed('Could not change mode'))}
      className={cn(labelled ? 'h-8 text-[12px]' : 'h-7 font-mono text-[11px] uppercase tracking-wider', mode === 'trusted' && 'border-alert/70 text-alert')}
    />
  )
  if (labelled)
    return (
      <Field label="Permissions" hint={info?.description}>
        {select}
      </Field>
    )
  return (
    <Tooltip title="Permissions for this chat" body={info?.description} side="bottom">
      <div className={compact ? 'w-28' : 'w-32'}>{select}</div>
    </Tooltip>
  )
}
