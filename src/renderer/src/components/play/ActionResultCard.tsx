import { NEEDS_LABEL, type ActionResult } from '@shared/actions'
import { EntryCard } from '../entries/EntryCard'
import { SheetPortrait } from '../data/SheetPortrait'
import { Markdown } from '../chat/Markdown'
import { RollRow } from './RollRow'
import { CardSwapLine } from './CardSwapLine'

export function ActionResultCard({ result }: { result: ActionResult }) {
  return (
    <EntryCard title="Action" tag={NEEDS_LABEL[result.needs]}>
      <div className="text-[14px] font-semibold leading-snug text-white">{result.attempt}</div>
      {result.character && (
        <div className="flex items-center gap-2 font-mono text-[11px] text-dim">
          <SheetPortrait image={result.character.image} className="h-5 w-5" />
          {result.character.name}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        {result.rolls.map((r, i) => (
          <RollRow key={i} roll={r} />
        ))}
      </div>
      <ActionOutcome result={result} />
    </EntryCard>
  )
}

export function ActionOutcome({ result }: { result: ActionResult }) {
  return (
    <div className="border border-cyan/30 bg-cyan/[0.05] px-2.5 py-2">
      <div className="mb-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan">
        {result.passed ? 'Success' : 'Failure'}
        {result.deciding ? ` · ${result.deciding} ${result.passed ? 'pass' : 'fail'}` : ''}
      </div>
      <Markdown text={result.outcome} className="text-[13px] leading-relaxed text-white/90" />
      <CardSwapLine swap={result.cards} />
    </div>
  )
}
