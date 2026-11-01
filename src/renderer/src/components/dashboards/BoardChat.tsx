import { EmptyState } from '../ui'
import { useDashboards } from '../../store/dashboards'
import { DashboardGrid } from './DashboardGrid'
import { cn } from '../../lib/cn'
import type { EntrySurfaceProps } from '../../registries/kinds'

function Board({ id, tall }: { id: string; tall: boolean }) {
  const board = useDashboards((s) => s.list.find((d) => d.id === id))
  if (!board) return <EmptyState title="Removed">This board no longer exists.</EmptyState>
  return (
    <div className={cn('overflow-auto', tall ? 'h-[75vh]' : 'h-[420px]')}>
      <DashboardGrid dashboard={board} editable={false} compact />
    </div>
  )
}

export function BoardChat({ id }: EntrySurfaceProps) {
  return <Board id={id} tall={false} />
}

export function BoardStage({ id }: EntrySurfaceProps) {
  return <Board id={id} tall />
}
