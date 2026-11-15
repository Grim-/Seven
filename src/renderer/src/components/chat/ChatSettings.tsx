import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { agentSheets, type AgentProfile, type AvatarSize } from '@shared/types'
import { Field, Popover, Segmented, StatusBadge } from '../ui'
import { ReasoningStylePicker } from './ReasoningStylePicker'
import { ThinkingPicker } from './ThinkingPicker'
import { ToolChoicePicker } from './ToolChoicePicker'
import { PermissionModePicker } from './PermissionModePicker'
import { ToolsetPicker } from './ToolsetPicker'
import { CharacterPicker } from './CharacterPicker'
import { AgentAvatar } from '../agents/look'
import { useApp } from '../../store/app'
import type { NearAlign, NearSide } from '../../lib/fitNear'

const PORTRAIT_SIZE_OPTIONS: { value: AvatarSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Med' },
  { value: 'large', label: 'Large' },
  { value: 'xl', label: 'XL' }
]

export function ChatSettings({
  agent,
  trigger,
  side = 'bottom',
  align = 'end'
}: {
  agent: AgentProfile | null
  trigger?: ReactNode
  side?: NearSide
  align?: NearAlign
}) {
  const avatarSize = useApp((s) => s.settings?.avatarSize ?? 'medium')
  const updateSettings = useApp((s) => s.updateSettings)
  if (!agent) return null
  const sheets = agentSheets(agent)
  const count = sheets.length

  return (
    <Popover
      title="Agent chat settings (thinking, reasoning style, permissions, toolset, character, portrait size)"
      className="w-80 gap-3 p-3 font-mono"
      side={side}
      align={align}
      trigger={
        trigger ?? (
          <StatusBadge tone="idle">
            <span className="flex items-center gap-1">
              <SlidersHorizontal className="h-3 w-3" />
              <ChevronDown className="h-3 w-3" />
            </span>
          </StatusBadge>
        )
      }
    >
      <div className="flex items-center gap-2.5 border-b border-line/60 pb-2.5">
        <AgentAvatar agent={agent} size={30} showCharacterOverlay={false} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-bold uppercase tracking-wider text-white">
            {agent.name}
          </div>
          <div className="truncate text-[10px] text-dim">
            {count > 1 ? `Roster: ${count} characters` : count === 1 ? `In character: ${sheets[0]}` : 'Agent profile'}
          </div>
        </div>
      </div>
      <Field label="Portrait size">
        <Segmented value={avatarSize} options={PORTRAIT_SIZE_OPTIONS} onChange={(v) => void updateSettings({ avatarSize: v })} />
      </Field>
      <ThinkingPicker />
      <ReasoningStylePicker />
      <ToolChoicePicker />
      <PermissionModePicker labelled />
      <ToolsetPicker agent={agent} />
      <CharacterPicker agent={agent} />
    </Popover>
  )
}
