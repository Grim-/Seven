import type { ReactNode } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { ActionBar, InlineEdit, type MenuItem } from '../ui'
import { TabbedBody } from './TabbedBody'

export interface InspectorTab {
  id: string
  label: string
  icon: ReactNode
  count?: number
  body: ReactNode
}

interface Props {
  icon: ReactNode
  title: string
  onRename?: (name: string) => void
  badge?: ReactNode
  place: string
  tabs: InspectorTab[]
  actions: MenuItem[]
  isExpanded?: boolean
  onToggleExpand?: () => void
  onClose: () => void
}

export function InspectorShell({ icon, title, onRename, badge, place, tabs, actions, isExpanded, onToggleExpand, onClose }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col font-ui text-[12px] tone-panel-95">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center [&_svg]:h-full [&_svg]:w-full">{icon}</span>
        <div className="min-w-0 flex-1">{onRename ? <InlineEdit value={title} required onSave={onRename} className="font-bold text-ink" /> : <span className="truncate font-bold text-ink">{title}</span>}</div>
        {badge}
        {onToggleExpand && (
          <button type="button" onClick={onToggleExpand} title={isExpanded ? 'Narrower' : 'Wider'} className="p-1 text-dim hover:text-ink">
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        )}
        <button type="button" onClick={onClose} title="Close" className="p-1 text-dim hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <TabbedBody place={place} tabs={tabs} />
      {actions.length > 0 && (
        <div className="border-t border-line/60 p-2">
          <ActionBar row items={actions} />
        </div>
      )}
    </div>
  )
}
