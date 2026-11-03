import { useState } from 'react'
import { Swords } from 'lucide-react'
import { opposedText, type OpposedProps, type OpposedSide } from '@shared/opposedCheck'
import { Button, Field, Input } from '../ui'
import { showPlay, type PlayWhere } from '../play/playStore'
import { PlayedCard } from './PlayedCard'
import { OpposedView } from './OpposedView'

const side = (name: string, does: string): OpposedSide => ({ name: name.trim(), sheet: null, does: does.trim() || 'wins', against: '', bonus: 0 })

export function OpposedForm({ where }: { where: PlayWhere }) {
  const [question, setQuestion] = useState('')
  const [a, setA] = useState({ name: '', does: '' })
  const [b, setB] = useState({ name: '', does: '' })
  const ready = Boolean(question.trim() && a.name.trim() && b.name.trim())
  const show = () => {
    const p: OpposedProps = { question: question.trim(), a: side(a.name, a.does), b: side(b.name, b.does), dc: null }
    showPlay('Opposed check', <PlayedCard view={(done, onAnswer) => <OpposedView p={p} done={done} open={!done} onAnswer={onAnswer} />} text={async (r) => opposedText(r)} where={where} />)
  }
  return (
    <div className="flex flex-col gap-3">
      <Field label="Question">
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Does the guard spot the lie?" />
      </Field>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-3">
        <Field label="Tries">
          <div className="flex flex-col gap-1.5">
            <Input value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="Who" />
            <Input value={a.does} onChange={(e) => setA({ ...a, does: e.target.value })} placeholder="Winning means… (spots the lie)" />
          </div>
        </Field>
        <Field label="Resists">
          <div className="flex flex-col gap-1.5">
            <Input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} placeholder="Who" />
            <Input value={b.does} onChange={(e) => setB({ ...b, does: e.target.value })} placeholder="Winning means… (keeps the lie)" />
          </div>
        </Field>
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="primary" icon={<Swords />} disabled={!ready} onClick={show}>
          Set up the check
        </Button>
      </div>
    </div>
  )
}
