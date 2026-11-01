import type { PresentData } from '@shared/types'
import { Presentation } from '../../registries/presentations'
import { registerWidgetUi, type WidgetBodyProps } from '../../registries/widgets'

function PresentWidgetBody({ widget }: WidgetBodyProps) {
  return (
    <div className="h-full overflow-y-auto p-1">
      <Presentation data={{ ...(widget.source.data as PresentData), where: 'board' }} />
    </div>
  )
}

registerWidgetUi('present', { Body: PresentWidgetBody })
