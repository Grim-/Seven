import { useState } from 'react'
import { Plus, Save, Signpost, X } from 'lucide-react'
import { decisionText, type Decision, type DecisionOption } from '@shared/decisions'
import { NO_SWAP } from '@shared/cardDecks'
import { Button, Eyebrow, Input, Segmented, Toggle } from '../ui'
import { AgentSelect } from '../agents/AgentSelect'
import { useAgents } from '../../store/agents'
import { decide } from './play'
import type { PlayWhere } from './playStore'
import { CardSwapField } from './CardSwapField'
import { TriggerActionSelect } from '../game/TriggerActionSelect'

const BLANK_OPTION: DecisionOption = { text: '', cards: NO_SWAP, action: null }
export const BLANK_DECISION: Decision = { question: '', options: [BLANK_OPTION, BLANK_OPTION], own: true, decider: null }
const WHO = [
  { value: 'you', label: 'You' },
  { value: 'agent', label: 'An agent' }
] as const

interface Props {
  initial: Decision
  where: PlayWhere
  onKeep?: (text: string, decision?: Decision) => void
  onChange?: (decision: Decision) => void
  keepLabel: string
}

export function DecisionForm({ initial, where, onKeep, onChange, keepLabel }: Props) {
  const [d, setD] = useState<Decision>(initial)
  const set = (next: Decision) => {
    setD(next)
    onChange?.(next)
  }
  const agents = useAgents((s) => s.list)
  const who = d.decider ? 'agent' : 'you'
  const clean = { ...d, options: d.options.map((o) => ({ ...o, text: o.text.trim() })).filter((o) => o.text) }
  const setOption = (i: number, patch: Partial<DecisionOption>) => set({ ...d, options: d.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) })
  const deciderName = agents.find((a) => a.id === d.decider)?.name ?? 'the agent'

  const getReadyDecision = (): Decision => ({
    ...clean,
    question: clean.question.trim() || 'Choice',
    options: clean.options.length ? clean.options : [{ text: 'Continue', cards: NO_SWAP, action: null }]
  })

  const handleDecide = () => {
    const readyDecision = getReadyDecision()
    if (!d.question.trim()) set(readyDecision)
    decide(readyDecision, where)
  }

  const handleKeep = () => {
    const readyDecision = getReadyDecision()
    if (!d.question.trim()) set(readyDecision)
    onKeep?.(decisionText(readyDecision), readyDecision)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Input value={d.question} placeholder="What is to be decided?" onChange={(e) => set({ ...d, question: e.target.value })} />
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">Decided by</span>
        <Segmented value={who} options={[...WHO]} onChange={(v) => set({ ...d, decider: v === 'agent' ? (agents[0]?.id ?? null) : null })} />
        {who === 'agent' && <AgentSelect value={d.decider} onChange={(decider) => set({ ...d, decider })} className="h-8 flex-1 text-[12px]" />}
      </div>
      <Eyebrow>Options</Eyebrow>
      {d.options.map((o, i) => (
        <div key={i} className="flex flex-col gap-1.5 border border-line/40 bg-black/20 p-2">
          <div className="flex items-center gap-1.5">
            <Input
              value={o.text}
              placeholder={`Option ${i + 1}`}
              onChange={(e) => setOption(i, { text: e.target.value })}
              className="h-8 flex-1 text-[12.5px]"
            />
            <CardSwapField value={o.cards} onChange={(cards) => setOption(i, { cards })} className="h-8 w-56" />
            <button
              type="button"
              title="Remove this option"
              disabled={d.options.length < 2}
              onClick={() => set({ ...d, options: d.options.filter((_, j) => j !== i) })}
              className="text-faint hover:text-alert disabled:opacity-30"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <TriggerActionSelect
            value={o.action}
            onChange={(action) => setOption(i, { action })}
            placeholder="No in-game trigger action for this option"
            className="h-7 text-[11px]"
          />
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => set({ ...d, options: [...d.options, BLANK_OPTION] })}>
          Option
        </Button>
        <Toggle checked={d.own} onChange={(own) => set({ ...d, own })} label="They can answer something else" />
      </div>
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          icon={<Signpost className="h-3.5 w-3.5 text-accent" />}
          onClick={handleDecide}
          title="Decide right now"
        >
          {d.decider ? `Ask ${deciderName}` : 'Decide now'}
        </Button>
        {onKeep && (
          <Button
            size="sm"
            variant="primary"
            icon={<Save className="h-3.5 w-3.5" />}
            onClick={handleKeep}
            title={keepLabel}
          >
            {keepLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
