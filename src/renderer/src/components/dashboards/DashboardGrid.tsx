import type { Dashboard } from '@shared/types'
import { BoardTabletop } from './BoardTabletop'

export function DashboardGrid({
  dashboard,
  compact = false
}: {
  dashboard: Dashboard
  editable?: boolean
  editing?: boolean
  compact?: boolean
}) {
  return <BoardTabletop dashboard={dashboard} layoutMode="grid" compact={compact} />
}
