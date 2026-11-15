import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { CHOSEN_EVENT, decisionMade, optionEffects, type Decision, type DecisionOption } from '@shared/decisions'
import { NO_SWAP, hasSwap } from '@shared/cardDecks'
import { ActionBar, Button, Input } from '../ui'
import { playText, surfaceOf, type PlayWhere } from './playStore'
import { CardSwapLine } from './CardSwapLine'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { playOutItem } from './playOut'
import { effectLines, runCardEffects, targetLines } from './cardEffects'

export function DecisionPrompt({ decision, where }: { decision: Decision; where: PlayWhere }) {
  const [chosen, setChosen] = useState<DecisionOption | null>(null)
  const [effects, setEffects] = useState<string[]>([])
  const [own, setOwn] = useState('')
  const surface = surfaceOf(where)
  const choose = async (option: DecisionOption) => {
    const choice = option.text.trim()
    if (!choice) return
    const lines = effectLines(await runCardEffects(optionEffects(option), CHOSEN_EVENT, where))
    setEffects(lines)
    const text = decisionMade(decision, choice, option.cards, [...targetLines(where), ...lines])
    if (where.world && where.sheet) void engine('worlds.addJourney', { id: where.world, sheet: where.sheet, kind: 'decision', text: `Chose "${choice}" for "${decision.question}"` }).catch(failed('Could not note it in the journey'))
    if (where.deck && hasSwap(option.cards)) void engine('decks.swap', { ref: where.deck, swap: option.cards }).catch(failed('Could not change the cards'))

    if (where.onText) {
      where.onText(playText(where, text))
      surface.clear()
      return surface.settle({ tone: 'purple', label: 'Chosen', detail: choice, effects: lines })
    }
    setChosen(option.text === choice ? option : { ...option, text: choice })
  }
  const ownOption: DecisionOption = { text: own, cards: NO_SWAP, action: null, effects: [] }
  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[15px] font-semibold leading-snug text-white">{decision.question}</div>
      {chosen === null ? (
        <>
          {decision.options.map((o, i) => (
            <button key={i} type="button" onClick={() => void choose(o).catch(failed('Could not choose'))} className="flex items-center gap-2.5 border border-purple/40 bg-purple/[0.05] px-3 py-2 text-left text-[13px] text-white hover:bg-purple/[0.12]">
              <span className="w-4 font-mono text-[10.5px] font-bold text-purple">{i + 1}</span>
              <span className="flex-1">{o.text}</span>
              <CardSwapLine swap={o.cards} />
            </button>
          ))}
          {decision.own && (
            <div className="flex gap-1.5">
              <Input value={own} placeholder="Something else…" onChange={(e) => setOwn(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void choose(ownOption).catch(failed('Could not choose'))} className="flex-1" />
              <Button size="sm" icon={<Check />} disabled={!own.trim()} onClick={() => void choose(ownOption).catch(failed('Could not choose'))}>
                Choose
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="border border-purple/40 bg-purple/[0.06] px-2.5 py-2">
            <div className="mb-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-purple">You chose</div>
            <div className="text-[13px] text-white/90">{chosen.text}</div>
            <CardSwapLine swap={chosen.cards} />
          </div>
          <ActionBar items={[playOutItem(decisionMade(decision, chosen.text, chosen.cards, [...targetLines(where), ...effects]), where), { label: 'Close', icon: <X />, onSelect: surface.close }]} />
        </>
      )}
    </div>
  )
}
