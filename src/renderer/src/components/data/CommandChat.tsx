import { EmptyState } from '../ui'
import { engine } from '../../lib/ipc'
import { useLibraryData } from '../../lib/useLive'
import { EntryCard, Loading } from '../entries/EntryCard'
import type { EntrySurfaceProps } from '../../registries/kinds'

export function CommandChat({ id }: EntrySurfaceProps) {
  const list = useLibraryData(() => engine('commands.list', { sessionId: null, agentId: '' }), 'commands')
  if (!list) return <Loading />
  const command = list.find((c) => c.name === id)
  if (!command) return <EmptyState title="Removed">This command no longer exists.</EmptyState>
  return (
    <EntryCard title={`/${command.name}`} tag="command">
      <span className="font-mono text-[12.5px] text-accent">{command.usage.split('\n')[0].replace(/`/g, '')}</span>
      <span className="text-[12.5px] text-dim">{command.summary}</span>
    </EntryCard>
  )
}
