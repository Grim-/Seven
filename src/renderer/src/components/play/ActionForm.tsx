import { useState } from 'react'
import { Dices, Plus, Save, X } from 'lucide-react'
import { NO_SWAP } from '@shared/cardDecks'
import { CHANCE, NEEDS_LABEL, actionText, chanceOf, findTarget, targetOf, type Action, type ActionCheck } from '@shared/actions'
import { signed } from '@shared/dnd'
import { Button, Eyebrow, Input, NumberField, Segmented, Select } from '../ui'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { AgentSelect } from '../agents/AgentSelect'
import { useAgents } from '../../store/agents'
import { rollAction } from './play'
import { useActionSheet, useCheckTargets } from './useCheckTargets'
import type { PlayWhere } from './playStore'
import { CardSwapField } from './CardSwapField'

const BLANK_CHECK: ActionCheck = { against: CHANCE, difficulty: 0.5, base: null, pass: null, fail: null, passCards: NO_SWAP, failCards: NO_SWAP }
export const BLANK_ACTION: Action = { attempt: '', needs: 'any', by: null, checks: [BLANK_CHECK], pass: '', fail: '', passCards: NO_SWAP, failCards: NO_SWAP }
const NEEDS = (['any', 'all'] as const).map((value) => ({ value, label: NEEDS_LABEL[value] }))
const WHO = [
  { value: 'you', label: 'You' },
  { value: 'agent', label: 'An agent' }
] as const

interface Props {
  initial: Action
  character: string | null
  where: PlayWhere
  onKeep?: (text: string) => void
  onChange?: (action: Action) => void
  keepLabel: string
}

export function ActionForm({ initial, character, where, onKeep, onChange, keepLabel }: Props) {
  const [a, setA] = useState<Action>(initial)
  const set = (next: Action) => {
    setA(next)
    onChange?.(next)
  }
  const [mine, setMine] = useState<string | null>(character)
  const agents = useAgents((s) => s.list)
  const who = a.by ? 'agent' : 'you'
  const targets = useCheckTargets(useActionSheet(a, mine))
  const options = [{ value: CHANCE, label: 'Chance' }, ...targets.map((t) => ({ value: t.id, label: `${t.label} ${signed(t.bonus)}` }))]
  const setCheck = (i: number, patch: Partial<ActionCheck>) => set({ ...a, checks: a.checks.map((c, j) => (j === i ? { ...c, ...patch } : c)) })
  const ready = Boolean(a.attempt.trim())

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <Input value={a.attempt} placeholder="What is attempted?" onChange={(e) => set({ ...a, attempt: e.target.value })} className="flex-1" />
        <Segmented value={a.needs} options={NEEDS} onChange={(needs) => set({ ...a, needs })} />
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">Rolled by</span>
        <Segmented value={who} options={[...WHO]} onChange={(v) => set({ ...a, by: v === 'agent' ? (agents[0]?.id ?? null) : null })} />
        {who === 'you' ? <SheetSelect value={mine} onChange={setMine} className="h-8 flex-1 text-[12px]" /> : <AgentSelect value={a.by} onChange={(by) => set({ ...a, by })} className="h-8 flex-1 text-[12px]" />}
      </div>
      <Eyebrow>Checks</Eyebrow>
      {a.checks.map((c, i) => {
        const bonus = findTarget(targets, c.against)?.bonus ?? 0
        const chance = chanceOf(bonus, targetOf(c))
        return (
          <div key={i} className="flex flex-col gap-1 border border-line/40 p-1.5">
            <div className="grid grid-cols-[minmax(0,1fr)_76px_70px_64px_20px] items-center gap-1.5">
              <Select value={c.against ?? CHANCE} options={options} onChange={(against) => setCheck(i, { against })} className="h-7 text-[12px]" />
              <NumberField value={c.difficulty ?? undefined} min={0} max={1} step={0.05} placeholder="diff 0.5" allowEmpty onChange={(v) => setCheck(i, { difficulty: v ?? null })} className="h-7 text-[12px]" />
              <NumberField value={c.base ?? undefined} step={1} placeholder="base 10" allowEmpty onChange={(v) => setCheck(i, { base: v ?? null })} className="h-7 text-[12px]" />
              <span className="text-right font-mono text-[11px] text-cyan" title="Chance to pass">
                {Math.round(chance * 100)}%
              </span>
              <button type="button" title="Remove this check" disabled={a.checks.length < 2} onClick={() => set({ ...a, checks: a.checks.filter((_, j) => j !== i) })} className="text-faint hover:text-alert disabled:opacity-30">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Input value={c.pass ?? ''} placeholder="If this decides it and passes…" onChange={(e) => setCheck(i, { pass: e.target.value || null })} className="h-7 text-[12px]" />
              <Input value={c.fail ?? ''} placeholder="If this decides it and fails…" onChange={(e) => setCheck(i, { fail: e.target.value || null })} className="h-7 text-[12px]" />
              <CardSwapField value={c.passCards} onChange={(passCards) => setCheck(i, { passCards })} />
              <CardSwapField value={c.failCards} onChange={(failCards) => setCheck(i, { failCards })} />
            </div>
          </div>
        )
      })}
      <div>
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => set({ ...a, checks: [...a.checks, BLANK_CHECK] })}>
          Check
        </Button>
      </div>
      <Eyebrow>Outcomes</Eyebrow>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)] gap-1.5">
        <Input value={a.pass} placeholder="Pass: what happens on success" onChange={(e) => set({ ...a, pass: e.target.value })} />
        <CardSwapField value={a.passCards} onChange={(passCards) => set({ ...a, passCards })} className="h-full" />
        <Input value={a.fail} placeholder="Fail: what happens on failure" onChange={(e) => set({ ...a, fail: e.target.value })} />
        <CardSwapField value={a.failCards} onChange={(failCards) => set({ ...a, failCards })} className="h-full" />
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" icon={<Dices />} disabled={!ready} onClick={() => rollAction(a, a.by ? null : mine, where)}>
          Roll
        </Button>
        {onKeep && (
          <Button size="sm" variant="ghost" icon={<Save />} disabled={!ready} onClick={() => onKeep(actionText(a))}>
            {keepLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
