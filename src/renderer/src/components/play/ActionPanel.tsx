import { useState } from 'react'
import { Dices, MessageSquare, Plus, Save, X } from 'lucide-react'
import { BLANK_CHECK, CHANCE, MIDDLE, actionText, chanceOf, cleanAction, findTarget, targetOf, type Action, type ActionCheck, type ActionNeeds } from '@shared/actions'
import type { StoredAction } from '@shared/storedAction'
import { Button, Input, NumberField, Segmented, Textarea, askText } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { SkillSelect } from '../decisions/SkillSelect'
import { useCheckTargets } from './useCheckTargets'
import { CardSwapField } from './CardSwapField'
import { rollAction } from './play'
import { playText, type PlayWhere } from './playStore'
import { PanelBody, PanelLabel } from './PanelBody'

const NEEDS: { value: ActionNeeds; label: string }[] = [
  { value: 'any', label: 'They pick one' },
  { value: 'all', label: 'All must pass' }
]

export function ActionPanel({ start, character, where, onSaved }: { start: StoredAction | null; character: string | null; where: PlayWhere; onSaved: (id: string) => void }) {
  const [a, setA] = useState<Action>(start?.action ?? cleanAction({ checks: [BLANK_CHECK] }))
  const [sheet, setSheet] = useState(character)
  const targets = useCheckTargets(sheet)
  const setCheck = (i: number, patch: Partial<ActionCheck>) => setA({ ...a, checks: a.checks.map((c, j) => (j === i ? { ...c, ...patch } : c)) })
  const chance = (c: ActionCheck) => chanceOf(findTarget(targets, c.against)?.bonus ?? 0, targetOf(c))
  const best = a.checks.length ? Math.max(...a.checks.map(chance)) : null
  const ready = Boolean(a.attempt.trim())
  const store = (name: string, id: string | null) =>
    void engine('storyActions.save', { action: { ...(start ?? { tags: [] }), id: id ?? '', name, action: a }, previousId: id })
      .then((saved) => onSaved(saved.id))
      .catch(failed('Could not save the action'))
  const save = () => (start ? store(start.name, start.id) : askText('Save action', 'Name', a.attempt, (name) => store(name.trim() || a.attempt, null)))
  return (
    <PanelBody
      footer={
        <>
          {best !== null && (
            <span className="mr-auto text-[13px] text-dim">
              Best chance <b className="font-mono text-accent">{Math.round(best * 100)}%</b>
            </span>
          )}
          <Button size="sm" icon={<Save />} disabled={!ready} onClick={save}>
            {start ? 'Save' : 'Save…'}
          </Button>
          <Button size="sm" icon={<MessageSquare />} disabled={!ready || !where.onText} onClick={() => where.onText?.(playText(where, actionText(a)))}>
            Put in my message
          </Button>
          <Button size="sm" variant="primary" icon={<Dices />} disabled={!ready} onClick={() => rollAction(a, sheet, where)}>
            Roll it
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-[18rem] flex-1 flex-col gap-1.5">
          <PanelLabel>What is attempted</PanelLabel>
          <Input value={a.attempt} onChange={(e) => setA({ ...a, attempt: e.target.value })} placeholder="Force the iron door" className="h-11 text-[16px] font-semibold" />
        </label>
        <label className="flex w-52 flex-col gap-1.5">
          <PanelLabel>Who rolls</PanelLabel>
          <SheetSelect value={sheet} onChange={setSheet} />
        </label>
        {a.checks.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <PanelLabel>With several ways</PanelLabel>
            <Segmented value={a.needs} options={NEEDS} onChange={(needs) => setA({ ...a, needs })} />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <PanelLabel>Ways to try it</PanelLabel>
        {a.checks.map((c, i) => (
          <div key={i} className="grid grid-cols-[minmax(12rem,1.2fr)_6rem_4rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2 border border-line/50 bg-white/[0.02] p-2">
            <SkillSelect chance targets={targets} value={c.against ?? CHANCE} onChange={(against) => setCheck(i, { against })} />
            <NumberField value={targetOf(c)} onChange={(dc) => setCheck(i, { base: (dc ?? 0) - 1, difficulty: MIDDLE })} />
            <span className="text-center font-mono text-[16px] font-bold text-accent">{Math.round(chance(c) * 100)}%</span>
            <Input value={c.pass ?? ''} onChange={(e) => setCheck(i, { pass: e.target.value || null })} placeholder="If this decides it and passes…" />
            <Input value={c.fail ?? ''} onChange={(e) => setCheck(i, { fail: e.target.value || null })} placeholder="If this decides it and fails…" />
            <Button size="sm" variant="ghost" icon={<X />} title="Remove" onClick={() => setA({ ...a, checks: a.checks.filter((_, j) => j !== i) })} />
          </div>
        ))}
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => setA({ ...a, checks: [...a.checks, BLANK_CHECK] })} className="self-start">
          Another way
        </Button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] gap-3">
        <div className="flex flex-col gap-2 border border-ok/40 bg-ok/[0.06] p-3">
          <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-ok">On a pass</span>
          <Textarea value={a.pass} onChange={(e) => setA({ ...a, pass: e.target.value })} rows={2} placeholder="What happens on success" />
          <CardSwapField value={a.passCards} onChange={(passCards) => setA({ ...a, passCards })} />
        </div>
        <div className="flex flex-col gap-2 border border-alert/40 bg-alert/[0.06] p-3">
          <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-alert">On a fail</span>
          <Textarea value={a.fail} onChange={(e) => setA({ ...a, fail: e.target.value })} rows={2} placeholder="What happens on failure" />
          <CardSwapField value={a.failCards} onChange={(failCards) => setA({ ...a, failCards })} />
        </div>
      </div>
    </PanelBody>
  )
}
