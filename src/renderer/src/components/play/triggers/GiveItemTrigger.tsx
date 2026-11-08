import { Markdown } from '../../chat/Markdown'
import { ItemReward } from '../ItemReward'
import { registerTriggerUi, type TriggerPanelProps } from './registry'

function GiveItemPanel({ trigger, ctx }: TriggerPanelProps) {
  const text = String(trigger.values.text ?? '')
  return (
    <div className="flex flex-col gap-3">
      {text && <Markdown text={text} />}
      <ItemReward sheet={ctx.sheet} item={String(trigger.values.item ?? '')} count={Number(trigger.values.count) || 1} gold={Number(trigger.values.gold) || 0} onTaken={ctx.close} />
    </div>
  )
}

registerTriggerUi('give_item', { Panel: GiveItemPanel })
