import { useEffect, useState } from 'react'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { Markdown } from '../chat/Markdown'

export function TextPart({ entry }: { entry: string }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    engine('library.read', { entry })
      .then((t) => live && setText(t))
      .catch((err) => live && setText(errorText(err)))
    return () => {
      live = false
    }
  }, [entry])
  if (text === null) return <div className="font-mono text-[11px] text-dim">Loading…</div>
  return (
    <div className="border border-line/40 bg-black/40 p-3">
      <Markdown text={text} />
    </div>
  )
}
