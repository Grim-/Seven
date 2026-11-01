import { Brain } from 'lucide-react'
import { registerDraftPreview, type DraftPreviewProps } from '../../registries/drafts'

const str = (v: unknown) => (typeof v === 'string' ? v : '')

function ThoughtDraft({ fields }: DraftPreviewProps) {
  const question = str(fields.question).trim()
  const reasoning = str(fields.reasoning)
  const conclusion = str(fields.conclusion)
  const writing = conclusion ? 'conclusion' : 'reasoning'
  return (
    <div className="my-2 border border-purple/50 bg-black/50">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <Brain className="h-4 w-4 shrink-0 animate-pulse text-purple" />
        <span className="font-mono text-[12px] font-semibold text-purple">thinking</span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">writing its {writing}</span>
      </div>
      <div className="flex flex-col gap-2 border-t border-purple/30 px-2.5 py-2 text-[12.5px]">
        {question && (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Asked</span>
            <div className="whitespace-pre-wrap text-accent-soft">{question}</div>
          </div>
        )}
        {reasoning && (
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-l-2 border-l-purple/60 pl-2.5 font-mono text-[12px] leading-relaxed text-white/80">
            {reasoning}
            {!conclusion && <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-blink bg-purple" />}
          </pre>
        )}
        {conclusion && (
          <div className="text-white">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">Conclusion </span>
            {conclusion}
            <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-blink bg-accent" />
          </div>
        )}
        {!question && !reasoning && !conclusion && <span className="font-mono text-[11px] text-faint">Starting…</span>}
      </div>
    </div>
  )
}

registerDraftPreview('think', ThoughtDraft)
registerDraftPreview('reason', ThoughtDraft)
