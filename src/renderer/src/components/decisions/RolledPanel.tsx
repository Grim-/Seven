import { useState } from 'react'
import { Dices, MessageSquare, Save } from 'lucide-react'
import type { PickOption } from '@shared/pickDecision'
import { DICE, rolledMadeText, type RolledDecisionProps } from '@shared/rolledDecision'
import type { StoredDecision } from '@shared/storedDecision'
import { Button, Input } from '../ui'
import { cn } from '../../lib/cn'
import { playText, showPlay, type PlayWhere } from '../play/playStore'
import { PanelBody, PanelLabel } from '../play/PanelBody'
import { PickOptionsEditor } from './PickOptionsEditor'
import { PlayedCard } from './PlayedCard'
import { RolledView } from './RolledView'
import { storeDecision } from './DecisionPanel'

export function RolledPanel({ start, where, onSaved }: { start: StoredDecision | null; where: PlayWhere; onSaved: (id: string) => void }) {
  const [question, setQuestion] = useState(start?.name ?? '')
  const [die, setDie] = useState(start?.die ?? DICE[0])
  const [options, setOptions] = useState<PickOption[]>(start?.options ?? [])
  const filled = options.map((o) => o.text.trim()).filter(Boolean)
  const ready = Boolean(question.trim())
  const ask = () => where.onText?.(playText(where, start ? `Use roll_decision with from @story_decision:${start.id}` : `Use roll_decision with a d${die}: ${question.trim()}`))
  const show = () => {
    const p: RolledDecisionProps = { question: question.trim(), die, options: filled, from: start ? `@story_decision:${start.id}` : null }
    showPlay('Rolled decision', <PlayedCard view={(done, onAnswer) => <RolledView p={p} done={done} open={!done} onAnswer={onAnswer} />} text={async (a) => rolledMadeText(p, a)} where={where} />)
  }
  return (
    <PanelBody
      footer={
        <>
          <span className={cn('mr-auto text-[13px]', filled.length && filled.length !== die ? 'text-alert' : 'text-dim')}>
            {filled.length} of {die} written
          </span>
          <Button size="sm" icon={<Save />} disabled={!ready} onClick={() => storeDecision(start, { name: question.trim(), mode: 'roll', die, options: options.filter((o) => o.text.trim()) }, onSaved)}>
            {start ? 'Save' : 'Save…'}
          </Button>
          {filled.length ? (
            <Button size="sm" variant="primary" icon={<Dices />} disabled={!ready || filled.length !== die} onClick={show}>
              Roll d{die}
            </Button>
          ) : (
            <Button size="sm" variant="primary" icon={<MessageSquare />} disabled={!ready || !where.onText} onClick={ask}>
              Ask the agent for {die} options
            </Button>
          )}
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <PanelLabel>What does the die decide</PanelLabel>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What’s waiting in the next room?" className="h-11 text-[16px] font-semibold" />
      </label>
      <div className="flex flex-col gap-1.5">
        <PanelLabel>Die</PanelLabel>
        <div className="flex flex-wrap gap-2">
          {DICE.map((d) => (
            <button key={d} type="button" onClick={() => setDie(d)} className={cn('h-12 w-16 border font-mono text-[16px] font-bold', d === die ? 'border-accent bg-accent text-black' : 'border-line/60 bg-white/[0.02] text-white hover:border-accent/60')}>
              d{d}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <PanelLabel>Options, one per face (none written: the agent writes {die})</PanelLabel>
        <PickOptionsEditor options={options} onChange={setOptions} rolls={false} />
      </div>
    </PanelBody>
  )
}
