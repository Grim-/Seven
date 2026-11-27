import { Trash2, Zap } from 'lucide-react'
import { triggerType, type TriggerDef } from '@shared/game/triggers'
import { confirmDelete, type MenuItem } from '../ui'
import { InspectorShell, type InspectorTab } from './InspectorShell'
import { triggerTabs } from './triggerTabs'

interface Props {
  trigger: TriggerDef
  world?: string
  isExpanded?: boolean
  onToggleExpand?: () => void
  onChange: (next: TriggerDef) => void
  onDelete: () => void
  onClose: () => void
  extraTabs?: InspectorTab[]
}

export function WorldTriggerInspector({ trigger, world = '', isExpanded, onToggleExpand, onChange, onDelete, onClose, extraTabs = [] }: Props) {
  const type = triggerType(trigger.type)
  const actions: MenuItem[] = [{ label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => confirmDelete(`Delete ${trigger.name}?`, 'This removes it from this map.', async () => onDelete()) }]
  return (
    <InspectorShell
      icon={<Zap className="text-accent" />}
      title={trigger.name}
      onRename={(name) => onChange({ ...trigger, name })}
      badge={<span className="shrink-0 border border-accent/40 px-1 text-[9px] font-bold caps text-accent">{type?.label ?? trigger.type}</span>}
      place="worldTrigger"
      tabs={[...triggerTabs(trigger, world, onChange), ...extraTabs]}
      actions={actions}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onClose={onClose}
    />
  )
}
