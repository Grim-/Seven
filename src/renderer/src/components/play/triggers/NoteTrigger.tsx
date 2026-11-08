import { Button } from '../../ui'
import { Markdown } from '../../chat/Markdown'
import { registerTriggerUi, type TriggerPanelProps } from './registry'

function NotePanel({ trigger, ctx }: TriggerPanelProps) {
  const text = String(trigger.values.text ?? '')
  return (
    <div className="flex flex-col gap-3">
      {text ? <Markdown text={text} /> : <span className="text-[13px] text-faint">There's nothing written here.</span>}
      <Button variant="primary" className="self-end" onClick={ctx.close}>
        OK
      </Button>
    </div>
  )
}

registerTriggerUi('note', { Panel: NotePanel })
