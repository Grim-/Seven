import type { Dashboard, Widget } from '@shared/types'
import { widgetUi } from '../../registries/widgets'

export function WidgetBody({ dashboard, widget, compact = false }: { dashboard: Dashboard; widget: Widget; compact?: boolean }) {
  const { Body } = widgetUi(widget.source)
  return <Body dashboard={dashboard} widget={widget} compact={compact} />
}
