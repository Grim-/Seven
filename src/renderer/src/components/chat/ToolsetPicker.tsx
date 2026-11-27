import { Check } from 'lucide-react'
import type { AgentProfile } from '@shared/types'
import { Field } from '../ui'
import { useToolsets } from '../../store/toolsets'
import { cn } from '../../lib/cn'
import { changeAgent } from './changeAgent'

export function ToolsetPicker({ agent }: { agent: AgentProfile }) {
  const list = useToolsets((s) => s.list)
  if (!list.length) return null
  const current = agent.toolsets ?? []
  return (
    <Field group label="Toolset">
      <div className="flex max-h-48 flex-col overflow-y-auto border border-line/60">
        {[{ id: '', name: 'No toolset', description: 'Only the tools turned on for this agent' }, ...list].map((t) => {
          const on = t.id ? current.length === 1 && current[0] === t.id : !current.length
          return (
            <button key={t.id || '_none'} onClick={() => void changeAgent(agent, { toolsets: t.id ? [t.id] : [] }, 'toolset')} className={cn('flex items-start gap-2 px-3 py-1.5 text-left hover:bg-accent/10', on && 'bg-accent/5')}>
              <Check className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', on ? 'text-accent' : 'invisible')} />
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] text-ink/90">{t.name}</span>
                {t.description && <span className="block truncate text-[11px] text-faint">{t.description}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </Field>
  )
}
