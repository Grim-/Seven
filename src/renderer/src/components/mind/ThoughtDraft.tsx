import { Brain } from 'lucide-react'
import { registerDraftPreview, type DraftPreviewProps } from '../../registries/drafts'

const str = (v: unknown) => (typeof v === 'string' ? v : '')

function ThoughtDraft({ fields }: DraftPreviewProps) {
  const question = str(fields.question).trim()
  const reasoning = str(fields.reasoning)
  const conclusion = str(fields.conclusion)
  const writing = conclusion ? 'conclusion' : 'reasoning'
  return (
    <div className="my-2 border border-tint-purple/50 tone-panel-50">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <Brain className="h-4 w-4 shrink-0 animate-pulse text-tint-purple" />
        <span className="font-ui text-[12px] font-semibold text-tint-purple">thinking</span>
        <span className="font-label text-[10.5px] caps-14 text-faint">writing its {writing}</span>
      </div>
      <div className="flex flex-col gap-2 border-t border-tint-purple/30 px-2.5 py-2 text-[12.5px]">
        {question && (
          <div className="flex flex-col gap-0.5">
            <span className="font-label text-[10px] caps-14 text-faint">Asked</span>
            <div className="whitespace-pre-wrap text-accent-soft">{question}</div>
          </div>
        )}
        {reasoning && (
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-l-2 border-l-tint-purple/60 pl-2.5 font-ui text-[12px] leading-relaxed text-ink/80">
            {reasoning}
            {!conclusion && <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-blink bg-tint-purple" />}
          </pre>
        )}
        {conclusion && (
          <div className="text-ink">
            <span className="font-label text-[10.5px] caps-14 text-accent">Conclusion </span>
            {conclusion}
            <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-blink bg-accent" />
          </div>
        )}
        {!question && !reasoning && !conclusion && <span className="font-ui text-[11px] text-faint">Starting…</span>}
      </div>
    </div>
  )
}

registerDraftPreview('think', ThoughtDraft)
registerDraftPreview('reason', ThoughtDraft)
