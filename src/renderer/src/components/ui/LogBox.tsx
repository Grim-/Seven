import { useEffect, useRef } from 'react'

export function LogBox({ lines, empty = 'Nothing yet.' }: { lines: string[]; empty?: string }) {
  const box = useRef<HTMLPreElement>(null)
  useEffect(() => {
    const el = box.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines.length, lines[lines.length - 1]])
  return (
    <pre ref={box} className="max-h-72 min-h-16 overflow-auto whitespace-pre-wrap break-all border border-line/40 tone-well-50 p-2 font-mono text-[11px] leading-relaxed text-ink/80">
      {lines.length ? lines.join('\n') : <span className="text-faint">{empty}</span>}
    </pre>
  )
}
