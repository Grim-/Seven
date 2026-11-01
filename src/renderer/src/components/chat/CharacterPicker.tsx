import type { AgentProfile } from '@shared/types'
import { Field } from '../ui'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { changeAgent } from './changeAgent'

export function CharacterPicker({ agent }: { agent: AgentProfile }) {
  return (
    <Field label="Character" hint="The character sheet this agent plays. Changing it reloads this chat's context.">
      <SheetSelect value={agent.sheet ?? null} onChange={(sheet) => void changeAgent(agent, { sheet }, 'character')} className="h-8 text-[12px]" />
    </Field>
  )
}
