import { rolledMadeText, type RolledDecisionProps } from '@shared/rolledDecision'
import { engine } from '../../../lib/ipc'
import { failed } from '../../../lib/notify'
import { PlayedCard } from '../../decisions/PlayedCard'
import { RolledView } from '../../decisions/RolledView'
import { worldWhere } from '../playStore'
import { registerTriggerUi, type TriggerPanelProps } from './registry'

function RolledPanel({ trigger, ctx }: TriggerPanelProps) {
  const die = Number(trigger.values.die) || 0
  const options = (Array.isArray(trigger.values.options) ? trigger.values.options : []).map((o) => String(o).trim()).filter(Boolean)
  const p: RolledDecisionProps = { question: String(trigger.values.question ?? '').trim() || trigger.name, die, options, from: null }
  if (options.length !== die) return <span className="text-[13px] text-faint">{`A d${die} needs ${die} options; this has ${options.length}. Edit the trigger to write them.`}</span>
  const noted = async (answer: { roll: number; option: string }) => {
    const text = rolledMadeText(p, answer)
    await engine('worlds.addJourney', { id: ctx.world, sheet: ctx.sheet, kind: 'decision', text: `Rolled ${answer.roll} on a d${die} for "${p.question}": ${answer.option}` }).catch(failed('Could not note it in the journey'))
    return text
  }
  return <PlayedCard view={(done, onAnswer) => <RolledView p={p} done={done} open={!done} onAnswer={onAnswer} />} text={noted} where={worldWhere(trigger.name, [], ctx.world, ctx.sheet)} />
}

registerTriggerUi('rolled', { Panel: RolledPanel })
