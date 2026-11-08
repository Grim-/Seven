import { PlayList } from '../PlayList'
import type { PlayHolder } from '../playHolder'
import { worldWhere } from '../playStore'
import { registerTriggerUi, type TriggerPanelProps } from './registry'

function PlayPanel({ trigger, ctx }: TriggerPanelProps) {
  const text = (key: string) => String(trigger.values[key] ?? '')
  const holder: PlayHolder = {
    texts: { action: text('actions'), decision: text('decisions') },
    save: (kind, value) => ctx.update({ ...trigger.values, [kind === 'action' ? 'actions' : 'decisions']: value }),
    keepLabel: `Keep on ${trigger.name}`,
    character: ctx.sheet,
    where: worldWhere(trigger.name, [], ctx.world, ctx.sheet)
  }
  return (
    <div className="flex flex-col gap-3">
      <PlayList play={holder} />
    </div>
  )
}

registerTriggerUi('play', { Panel: PlayPanel })
