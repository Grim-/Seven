import { NoteView } from '../NoteView'
import { registerTriggerUi, type TriggerPanelProps } from './registry'

function NotePanel({ trigger, ctx }: TriggerPanelProps) {
  return <NoteView text={String(trigger.values.text ?? '')} empty="There's nothing written here." onClose={ctx.close} />
}

registerTriggerUi('note', { Panel: NotePanel })
