import { useState } from 'react'
import { MessageSquare, Save, Signpost } from 'lucide-react'
import { pickMadeText, type PickDecisionProps, type PickOption } from '@shared/pickDecision'
import { blankDecision, type StoredDecision } from '@shared/storedDecision'
import { Button, Input, NumberField, Toggle, askText } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useCheckTargets } from '../play/useCheckTargets'
import { playText, showPlay, type PlayWhere } from '../play/playStore'
import { PanelBody, PanelLabel } from '../play/PanelBody'
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

export function storeDecision(start: StoredDecision | null, next: Partial<StoredDecision>, onSaved: (id: string) => void): void {
  const write = (name: string, id: string | null) =>
    void engine('decisions.save', { decision: { ...(start ?? blankDecision()), ...next, id: id ?? '', name }, previousId: id })
      .then((saved) => onSaved(saved.id))
      .catch(failed('Could not save the decision'))
  if (start) return write(start.name, start.id)
  askText('Save decision', 'Name', next.name ?? '', (name) => write(name.trim() || (next.name ?? 'Decision'), null))
}

export function DecisionPanel({ start, character, where, onSaved }: { start: StoredDecision | null; character: string | null; where: PlayWhere; onSaved: (id: string) => void }) {
  const [question, setQuestion] = useState(start?.name ?? '')
  const [options, setOptions] = useState<PickOption[]>(start?.options ?? [])
  const [count, setCount] = useState(start?.count ?? blankDecision().count)
  const [own, setOwn] = useState(true)
  const [sheet, setSheet] = useState(character)
  const targets = useCheckTargets(sheet)
  const filled = options.filter((o) => o.text.trim())
  const ready = Boolean(question.trim())
  const ask = () => where.onText?.(playText(where, start ? `Use decide with from @story_decision:${start.id}` : `Use decide for this, writing ${count} options: ${question.trim()}`))
  const show = () => {
    const p: PickDecisionProps = { question: question.trim(), options: filled, own, character: sheet, from: start ? `@story_decision:${start.id}` : null }
    showPlay('Decision', <PlayedCard view={(done, onAnswer) => <DecideView p={p} done={done} open={!done} onAnswer={onAnswer} />} text={async (a) => pickMadeText(p, a, await sheetTitle(a.character))} where={where} />)
  }
  return (
    <PanelBody
      footer={
        <>
          <label className="mr-auto flex items-center gap-2 text-[13px] text-dim">
            <Toggle checked={own} onChange={setOwn} /> Allow my own answer
          </label>
          <Button size="sm" icon={<Save />} disabled={!ready} onClick={() => storeDecision(start, { name: question.trim(), mode: 'pick', options: filled, count }, onSaved)}>
            {start ? 'Save' : 'Save…'}
          </Button>
          {filled.length ? (
            <Button size="sm" variant="primary" icon={<Signpost />} disabled={!ready} onClick={show}>
              Show the choice
            </Button>
          ) : (
            <Button size="sm" variant="primary" icon={<MessageSquare />} disabled={!ready || !where.onText} onClick={ask}>
              Ask the agent for {count} options
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-[18rem] flex-1 flex-col gap-1.5">
          <PanelLabel>Question</PanelLabel>
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="How do you get into the old dungeon?" className="h-11 text-[16px] font-semibold" />
        </label>
        <label className="flex w-52 flex-col gap-1.5">
          <PanelLabel>Who rolls</PanelLabel>
          <SheetSelect value={sheet} onChange={setSheet} />
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto">
            <PanelLabel>Options</PanelLabel>
          </span>
          {!filled.length && (
            <>
              <span className="text-[12px] text-dim">none written: the agent writes</span>
              <NumberField value={count} min={1} onChange={(v) => setCount(v ?? 1)} className="w-20" />
            </>
          )}
        </div>
        <PickOptionsEditor options={options} onChange={setOptions} rolls targets={targets} />
      </div>
    </PanelBody>
  )
}
