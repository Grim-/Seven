import { useState } from 'react'
import { Dices, MessageSquare } from 'lucide-react'
import type { PickOption } from '@shared/pickDecision'
import { DICE, rolledMadeText, type RolledDecisionProps } from '@shared/rolledDecision'
import { Button, Field, Input, Select } from '../ui'
import { playText, showPlay, type PlayWhere } from '../play/playStore'
import { PickOptionsEditor } from './PickOptionsEditor'
import { PlayedCard } from './PlayedCard'
import { RolledView } from './RolledView'

export function RolledDecisionForm({ where }: { where: PlayWhere }) {
  const [question, setQuestion] = useState('')
  const [die, setDie] = useState(DICE[0])
  const [options, setOptions] = useState<PickOption[]>([])
  const filled = options.map((o) => o.text.trim()).filter(Boolean)
  const ask = () => where.onText?.(playText(where, `Use roll_decision with a d${die}: ${question.trim()}`))
  const show = () => {
    const p: RolledDecisionProps = { question: question.trim(), die, options: filled, from: null }
    showPlay('Rolled decision', <PlayedCard view={(done, onAnswer) => <RolledView p={p} done={done} open={!done} onAnswer={onAnswer} />} text={async (a) => rolledMadeText(p, a)} where={where} />)
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Question" className="min-w-[16rem] flex-1">
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What does the die decide?" />
        </Field>
        <Field label="Die">
          <Select value={String(die)} options={DICE.map((d) => ({ value: String(d), label: `d${d}` }))} onChange={(v) => setDie(Number(v))} className="w-24" />
        </Field>
      </div>
      <Field label={`Options (leave empty for the agent to write ${die})`} group>
        <PickOptionsEditor options={options} onChange={setOptions} rolls={false} />
      </Field>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {filled.length > 0 && filled.length !== die && <span className="font-ui text-[11px] text-alert">{filled.length} written; a d{die} needs {die}.</span>}
        {filled.length ? (
          <Button size="sm" variant="primary" icon={<Dices />} disabled={!question.trim() || filled.length !== die} onClick={show}>
            Show
          </Button>
        ) : (
          <Button size="sm" variant="primary" icon={<MessageSquare />} disabled={!question.trim() || !where.onText} onClick={ask}>
            Ask the agent
          </Button>
        )}
      </div>
    </div>
  )
}
