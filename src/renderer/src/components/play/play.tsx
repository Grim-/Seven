import { actionResultText, picksCheck, type Action } from '@shared/actions'
import { effectLines, runCardEffects, targetLines } from './cardEffects'
import { decisionForAgent, type Decision } from '@shared/decisions'
import { LOSE_EVENT, WIN_EVENT, opposedText, sideEffects, type OpposedAnswer, type OpposedProps, type OpposedWinner } from '@shared/opposedCheck'
import { OpposedView } from '../decisions/OpposedView'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { focusedConversation, startChatWith } from '../../lib/conversation'
import { useSessions } from '../../store/sessions'
import { ActionRoll } from './ActionRoll'
import { CheckPicker } from './CheckPicker'
import { DecisionPrompt } from './DecisionPrompt'
import { effectLogElement } from './EffectLogElement'
import { PLAYED, playText, surfaceOf, type PlayOutcome, type PlayWhere } from './playStore'

function attachLogIfDirect(where: PlayWhere, element: ReturnType<typeof effectLogElement>): void {
  if (where.surface) return
  const conv = focusedConversation()
  if (conv) useSessions.getState().attachElements(conv.key, [element])
}

export function rollAction(action: Action, character: string | null, where: PlayWhere, pick: number | null = null): void {
  if (pick === null && picksCheck(action)) return surfaceOf(where).show('Action', <CheckPicker action={action} character={character} onPick={(i) => rollAction(action, character, where, i)} />)
  void engine('actions.roll', { action, character, pick, world: where.world ?? null, deck: where.deck ?? null })
    .then(async (result) => {
      const effects = effectLines(await runCardEffects(result.effects, result.event, where))
      const detail = result.rolls.length === 1 ? `${result.rolls[0].total} vs ${result.rolls[0].target}` : `${result.rolls.filter((r) => r.passed).length} of ${result.rolls.length} checks`
      const outcome: PlayOutcome = { tone: result.passed ? 'ok' : 'alert', label: result.passed ? 'Success' : 'Failure', detail, effects }
      if (where.onText) {
        attachLogIfDirect(
          where,
          effectLogElement({
            title: 'ACTION CHECK',
            attempt: result.attempt,
            actor: character,
            target: where.target?.link ?? where.target?.name ?? null,
            outcome,
            lines: [result.outcome, ...effects].filter(Boolean)
          })
        )
        where.onText(playText(where, actionResultText(result, [...targetLines(where), ...effects])))
      }
      surfaceOf(where).show('Action', <ActionRoll result={result} effects={effects} where={where} onAgain={() => rollAction(action, character, where, pick)} />)
    })
    .catch(failed('Could not roll'))
}

export function decide(start: Decision, where: PlayWhere): void {
  void engine('decisions.roll', { decision: start })
    .then((decision) => {
      if (!decision.decider) return surfaceOf(where).show('Decision', <DecisionPrompt decision={decision} where={where} />)
      const text = playText(where, decisionForAgent(decision))
      if (where.onText) {
        where.onText(text)
        return surfaceOf(where).settle(PLAYED)
      }
      startChatWith(decision.decider, where.link ? `${where.link}\n\n${text}` : text)
    })
    .catch(failed('Could not put the decision'))
}

function opposedOutcome(r: OpposedAnswer) {
  const won = r.winner === 'a'
  const against = r.bRoll ? r.bRoll.total : r.dc
  const detail = r.aRoll && against !== null ? `${r.aRoll.total} vs ${against}` : r.forced ? 'your call' : ''
  return { tone: won ? ('ok' as const) : ('alert' as const), label: won ? 'Success' : 'Failure', detail }
}

const sideEvent = (r: OpposedAnswer, side: OpposedWinner) => (r.winner === side ? WIN_EVENT : LOSE_EVENT)

async function opposedEffects(r: OpposedAnswer, where: PlayWhere): Promise<string[]> {
  const a = sideEvent(r, 'a')
  const b = sideEvent(r, 'b')
  const caster = await runCardEffects(sideEffects(r.a).filter((d) => d.on === a), a, where)
  const target = await runCardEffects(sideEffects(r.b).filter((d) => d.on === b), b, where, true)
  return [...effectLines(caster), ...effectLines(target)]
}

export function oppose(start: OpposedProps, where: PlayWhere): void {
  const t = where.target
  const p: OpposedProps = {
    ...start,
    a: { ...start.a, sheet: where.sheet ?? null, name: where.sheet ? `@sheet:${where.sheet}` : 'The user' },
    b: t ? { ...start.b, sheet: t.ref?.sheet ?? null, name: t.link ?? t.name } : start.b
  }
  const surface = surfaceOf(where)
  const answer = async (r: OpposedAnswer) => {
    if (r.aRoll) surface.roll(r.aRoll.roll)
    const effects = await opposedEffects(r, where)
    const outcome = opposedOutcome(r)
    const text = playText(where, opposedText(r, effects))
    if (where.onText) {
      attachLogIfDirect(
        where,
        effectLogElement({
          title: 'OPPOSED CHECK',
          attempt: `${r.a.name} (${r.a.does}) vs ${r.b.name} (${r.b.does})`,
          actor: where.sheet ?? null,
          target: where.target?.link ?? where.target?.name ?? null,
          outcome: { ...outcome, effects },
          lines: effects
        })
      )
      where.onText(text)
    }
    surface.show('Opposed check', <OpposedView p={p} done={r} open={false} onAnswer={answer} />)
    surface.settle(outcome)
  }
  surface.show('Opposed check', <OpposedView p={p} done={null} open onAnswer={answer} onClose={surface.close} />)
}
