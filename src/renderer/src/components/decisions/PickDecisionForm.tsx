import { useState } from 'react'
import { MessageSquare, Signpost } from 'lucide-react'
import { pickMadeText, type PickDecisionProps, type PickOption } from '@shared/pickDecision'
import { DICE } from '@shared/rolledDecision'
import { Button, Field, Input, NumberField } from '../ui'
import { engine } from '../../lib/ipc'
import { useCheckTargets } from '../play/useCheckTargets'
import { playText, showPlay, type PlayWhere } from '../play/playStore'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { PickOptionsEditor } from './PickOptionsEditor'
import { PlayedCard } from './PlayedCard'
import { DecideView } from './DecideView'

async function sheetTitle(id: string | null): Promise<string | null> {
  if (!id) return null
  try {
    return (await engine('sheets.get', { id })).title
  } catch {
    return null
  }
}

export function PickDecisionForm({ character, where }: { character: string | null; where: PlayWhere }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<PickOption[]>([])
  const [count, setCount] = useState(DICE[0])
  const [sheet, setSheet] = useState(character)
  const targets = useCheckTargets(sheet)
  const filled = options.filter((o) => o.text.trim())
  const ask = () => where.onText?.(playText(where, `Use decide for this, writing ${count} options: ${question.trim()}`))
  const show = () => {
    const p: PickDecisionProps = { question: question.trim(), options: filled, own: true, character: sheet, from: null }
    showPlay('Decision', <PlayedCard view={(done, onAnswer) => <DecideView p={p} done={done} open={!done} onAnswer={onAnswer} />} text={async (a) => pickMadeText(p, a, await sheetTitle(a.character))} where={where} />)
  }
  return (
    <div className="flex flex-col gap-3">
      <Field label="Question">
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What is being decided?" />
      </Field>
      <Field label="Who rolls">
        <SheetSelect value={sheet} onChange={setSheet} />
      </Field>
      <Field label="Options (leave empty for the agent to write them)" group>
        <PickOptionsEditor options={options} onChange={setOptions} rolls targets={targets} />
      </Field>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {filled.length ? (
          <Button size="sm" variant="primary" icon={<Signpost />} disabled={!question.trim()} onClick={show}>
            Show
          </Button>
        ) : (
          <>
            <span className="font-mono text-[11px] text-dim">options to write</span>
            <NumberField value={count} min={1} onChange={(v) => setCount(v ?? 1)} className="w-20" />
            <Button size="sm" variant="primary" icon={<MessageSquare />} disabled={!question.trim() || !where.onText} onClick={ask}>
              Ask the agent
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
