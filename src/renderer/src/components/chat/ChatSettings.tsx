import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { agentSheets, type AgentProfile } from '@shared/types'
import { Popover, StatusBadge } from '../ui'
import { ReasoningStylePicker } from './ReasoningStylePicker'
import { ThinkingPicker } from './ThinkingPicker'
import { ToolChoicePicker } from './ToolChoicePicker'
import { PermissionModePicker } from './PermissionModePicker'
import { ToolsetPicker } from './ToolsetPicker'
import { CharacterPicker } from './CharacterPicker'
import { AgentAvatar } from '../agents/look'
import type { NearAlign, NearSide } from '../../lib/fitNear'

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
  if (!agent) return null
  const sheets = agentSheets(agent)
  const count = sheets.length

  return (
    <Popover
      title="Agent chat settings (thinking, reasoning style, permissions, toolset, character)"
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
      <ThinkingPicker />
      <ReasoningStylePicker />
      <ToolChoicePicker />
      <PermissionModePicker labelled />
      <ToolsetPicker agent={agent} />
      <CharacterPicker agent={agent} />
    </Popover>
  )
}
