import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AgentProfile } from '@shared/types'
import { Popover, StatusBadge } from '../ui'
import { ReasoningStylePicker } from './ReasoningStylePicker'
import { ThinkingPicker } from './ThinkingPicker'
import { PermissionModePicker } from './PermissionModePicker'
import { ToolsetPicker } from './ToolsetPicker'
import { CharacterPicker } from './CharacterPicker'

export function ChatSettings({ agent, trigger }: { agent: AgentProfile | null; trigger?: ReactNode }) {
  if (!agent) return null
  return (
    <Popover
      title="Thinking, reasoning style, permissions, toolset and character"
      className="w-80 gap-4 p-3"
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
      <ThinkingPicker />
      <ReasoningStylePicker />
      <PermissionModePicker labelled />
      <ToolsetPicker agent={agent} />
      <CharacterPicker agent={agent} />
    </Popover>
  )
}
