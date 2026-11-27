import type { ComponentType, ReactNode } from 'react'
import type { Dashboard, Widget, WidgetProviderInfo, WidgetSource } from '@shared/types'
import { surfaceDefaults } from './surfaceDefaults'
import { EmptyState } from '../components/ui'
import type { EntrySurfaceProps } from './kinds'

export interface WidgetBodyProps {
  dashboard: Dashboard
  widget: Widget
  compact: boolean
}

export interface WidgetEditorProps {
  source: WidgetSource
  info: WidgetProviderInfo
  onChange: (source: WidgetSource) => void
}

export interface WidgetUi {
  Body: ComponentType<WidgetBodyProps>
  Editor?: ComponentType<WidgetEditorProps>
  blank?: (info: WidgetProviderInfo) => WidgetSource
  createIcon?: ReactNode
  choices?: { heading: string; meta: string; icon: ReactNode; source: (id: string) => WidgetSource }
  entry?: (source: WidgetSource) => string | null
  switchViews?: (widget: Widget) => readonly string[]
  fieldsPage?: (source: WidgetSource) => string | null
  flush?: boolean
}

const uis = new Map<string, WidgetUi>()

function Unknown({ widget }: WidgetBodyProps) {
  return <EmptyState title="Can't show this">Seven has nothing that shows a {widget.source.kind} widget.</EmptyState>
}

const UNKNOWN: WidgetUi = { Body: Unknown }

export function setDefaultEntryWidgetUi(ui: WidgetUi): void {
  surfaceDefaults.widget = ui
}

export function registerWidgetUi(kind: string, ui: WidgetUi): void {
  uis.set(kind, ui)
}

export function widgetUiOf(kind: string): WidgetUi | undefined {
  return uis.get(kind)
}

export function widgetUi(source: WidgetSource): WidgetUi {
  const found = uis.get(source.kind)
  if (found) return found
  if (surfaceDefaults.widget && typeof source.id === 'string') return surfaceDefaults.widget
  return UNKNOWN
}

export function MissingWidget({ what }: { what: string }) {
  return <EmptyState title="Missing">The {what} this widget showed no longer exists.</EmptyState>
}

export function entryWidget(Surface: ComponentType<EntrySurfaceProps>): WidgetUi {
  return {
    Body: ({ widget }) => (
      <div className="h-full overflow-y-auto">
        <Surface kind={widget.source.kind} id={String(widget.source.id ?? '')} part={typeof widget.source.part === 'string' ? widget.source.part : ''} />
      </div>
    ),
    entry: (source) => `${source.kind}/${String(source.id ?? '')}`
  }
}
