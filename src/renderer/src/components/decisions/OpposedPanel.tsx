import { useState } from 'react'
import { opposedText, type OpposedProps } from '@shared/opposedCheck'
import { Input } from '../ui'
import type { PlayWhere } from '../play/playStore'
import { PanelLabel } from '../play/PanelBody'
import { PlayedCard } from './PlayedCard'
import { OpposedView } from './OpposedView'

const BLANK: Omit<OpposedProps, 'question'> = {
  a: { name: '', sheet: null, does: '', against: '', bonus: 0 },
  b: { name: '', sheet: null, does: '', against: '', bonus: 0 },
  dc: null
}

export function OpposedPanel({ where }: { where: PlayWhere }) {
  const [question, setQuestion] = useState('')
  const [round, setRound] = useState(0)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
      <label className="flex flex-col gap-1.5">
        <PanelLabel>The question</PanelLabel>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Does the gate guard spot Mara’s lie?" className="h-11 text-[16px] font-semibold" />
      </label>
      <PlayedCard
        key={round}
        view={(done, onAnswer) => <OpposedView p={{ ...BLANK, question: question.trim() || 'Opposed check' }} done={done} open={!done} editable onAnswer={onAnswer} />}
        text={async (r) => {
          setRound((n) => n + 1)
          return opposedText(r)
        }}
        where={where}
      />
    </div>
  )
}
