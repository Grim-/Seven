import { useMemo } from 'react'
import { Select } from '../ui'
import { useAgents } from '../../store/agents'

export function AgentSelect({ value, onChange, className }: { value: string | null; onChange: (id: string) => void; className?: string }) {
  const agents = useAgents((s) => s.list)
  const options = useMemo(() => agents.map((a) => ({ value: a.id, label: a.name })), [agents])
  return <Select value={value ?? ''} options={options} onChange={onChange} className={className} />
}
