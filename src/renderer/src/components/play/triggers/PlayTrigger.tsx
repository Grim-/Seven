import { PlayList } from '../PlayList'
import type { PlayHolder } from '../playHolder'
import { worldWhere } from '../playStore'
import { ObjectPlayManager } from '../../maps/ObjectPlayManager'
import { registerTriggerUi, type TriggerPanelProps, type TriggerEditorProps } from './registry'

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

function PlayEditor({ trigger, world, onValues }: TriggerEditorProps) {
  const actionsText = String(trigger.values.actions ?? '')
  const decisionsText = String(trigger.values.decisions ?? '')
  return (
    <ObjectPlayManager
      actionsText={actionsText}
      decisionsText={decisionsText}
      onChangeActions={(next) => onValues({ ...trigger.values, actions: next })}
      onChangeDecisions={(next) => onValues({ ...trigger.values, decisions: next })}
      world={world}
    />
  )
}

registerTriggerUi('play', { Panel: PlayPanel, Editor: PlayEditor })
