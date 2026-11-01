import type { ReactNode } from 'react'
import { useAui, useAuiState } from '@assistant-ui/react'
import type { TextMessagePartProps } from '@assistant-ui/react'
import { X } from 'lucide-react'
import { referenceHref, referencePattern } from '@shared/text'
import { openSevenLink } from '../../lib/links'
import { useIncludeText } from '../../lib/useIncludeText'

export function Chip({ kind, refText, part = null, onRemove, onOpen }: { kind: string; refText: string; part?: string | null; onRemove?: () => void; onOpen?: () => void }) {
  const included = useIncludeText(kind, refText, onRemove ? null : part)
  const open = () => (onOpen ? onOpen() : openSevenLink(referenceHref(kind, refText)))
  if (included !== null)
    return (
      <span role="link" title={`From @${kind}:${refText.replace(/^"|"$/g, '')}#${part}`} onClick={open} className="seven-include">
        {included}
      </span>
    )
  return (
    <span className="seven-chip">
      <button type="button" title={`Open ${kind} ${refText}`} onClick={open} className="inline-flex min-w-0 items-stretch">
        <span className="seven-chip-kind">{kind}</span>
        <span className="truncate px-1.5">{refText.replace(/^"|"$/g, '')}</span>
        {part && <span className="shrink-0 pr-1.5 text-faint">#{part}</span>}
      </button>
      {onRemove && (
        <button type="button" title="Remove" onClick={onRemove} className="pr-1 text-dim hover:text-alert">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

export function withReferences(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(referencePattern())) {
    const start = (m.index ?? 0) + m[1].length
    if (start > last) out.push(text.slice(last, start))
    out.push(<Chip key={start} kind={m[2]} refText={m[3]} part={m[4] ?? null} />)
    last = (m.index ?? 0) + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function UserTextPart({ text }: TextMessagePartProps) {
  return <>{withReferences(text)}</>
}

export function ComposerReferences() {
  const text = useAuiState((s) => (s.composer.isEditing ? s.composer.text : ''))
  const aui = useAui()
  const found = [...text.matchAll(referencePattern())].filter((m) => (m.index ?? 0) + m[0].length < text.length)
  if (!found.length) return null
  const remove = (m: RegExpMatchArray) => {
    const start = (m.index ?? 0) + m[1].length
    aui.composer.setText((text.slice(0, start) + text.slice((m.index ?? 0) + m[0].length)).replace(/ {2,}/g, ' '))
  }
  return (
    <div className="flex flex-wrap gap-1.5 border-t border-line/60 bg-black/40 px-3 pt-2">
      {found.map((m) => (
        <Chip key={m.index} kind={m[2]} refText={m[3]} part={m[4] ?? null} onRemove={() => remove(m)} />
      ))}
    </div>
  )
}
