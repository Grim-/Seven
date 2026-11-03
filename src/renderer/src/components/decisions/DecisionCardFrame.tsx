import type { ReactNode } from 'react'

export function DecisionCardFrame({ tag, note, question, status, children }: { tag: string; note?: string; question: string; status?: ReactNode; children: ReactNode }) {
  return (
    <div className="my-2 flex flex-col border border-accent/60 bg-black/60">
      <div className="flex items-center gap-2 border-b border-line/60 px-3 py-2">
        <span className="bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-black">{tag}</span>
        {note && <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim">{note}</span>}
        <span className="flex-1" />
        {status && <span className="font-mono text-[10.5px]">{status}</span>}
      </div>
      <div className="px-3 pt-2.5 text-[15px] font-semibold leading-snug text-white">{question}</div>
      <div className="flex flex-col gap-2 p-3">{children}</div>
    </div>
  )
}
