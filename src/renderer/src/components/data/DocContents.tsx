import { useMemo, type RefObject } from 'react'
import { cn } from '../../lib/cn'

const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/

function headingsOf(text: string): { level: number; title: string }[] {
  const out: { level: number; title: string }[] = []
  let fenced = false
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
    const m = fenced ? null : HEADING.exec(line)
    if (m) out.push({ level: m[1].length, title: m[2].replace(/[*_`~]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') })
  }
  return out
}

export function DocContents({ text, doc }: { text: string; doc: RefObject<HTMLElement | null> }) {
  const headings = useMemo(() => headingsOf(text), [text])
  if (headings.length < 2) return null
  const go = (i: number) => doc.current?.querySelectorAll('h1, h2, h3')[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <nav className="sticky top-0 w-44 shrink-0 self-start border-l border-line/50 pl-3 font-mono text-[11px]">
      <div className="mb-2 text-[9.5px] font-bold uppercase tracking-[0.16em] text-faint">Contents</div>
      {headings.map((h, i) => (
        <button
          key={i}
          type="button"
          onClick={() => go(i)}
          className={cn('block w-full truncate border-l border-transparent py-0.5 text-left text-dim hover:border-accent hover:text-accent-soft', h.level === 1 ? 'pl-2' : h.level === 2 ? 'pl-4' : 'pl-6')}
        >
          {h.title}
        </button>
      ))}
    </nav>
  )
}
