import { actionResultText, picksCheck, type Action } from '@shared/actions'
import { decisionForAgent, type Decision } from '@shared/decisions'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { startChatWith } from '../../lib/conversation'
import { ActionRoll } from './ActionRoll'
import { CheckPicker } from './CheckPicker'
import { DecisionPrompt } from './DecisionPrompt'
import { playText, showPlay, type PlayWhere } from './playStore'

export function rollAction(action: Action, character: string | null, where: PlayWhere, pick: number | null = null): void {
  if (pick === null && picksCheck(action)) return showPlay('Action', <CheckPicker action={action} character={character} onPick={(i) => rollAction(action, character, where, i)} />)
  void engine('actions.roll', { action, character, pick, world: where.world ?? null, deck: where.deck ?? null })
    .then((result) => {
      where.onText?.(playText(where, actionResultText(result)))
      showPlay('Action', <ActionRoll result={result} where={where} onAgain={() => rollAction(action, character, where, pick)} />)
    })
    .catch(failed('Could not roll'))
}

export function decide(start: Decision, where: PlayWhere): void {
  void engine('decisions.roll', { decision: start })
    .then((decision) => {
      if (!decision.decider) return showPlay('Decision', <DecisionPrompt decision={decision} where={where} />)
      const text = playText(where, decisionForAgent(decision))
      if (where.onText) return where.onText(text)
      startChatWith(decision.decider, where.link ? `${where.link}\n\n${text}` : text)
    })
    .catch(failed('Could not put the decision'))
}
