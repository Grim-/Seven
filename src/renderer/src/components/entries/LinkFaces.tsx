import { useMemo } from 'react'
import { showName } from '@shared/ids'
import { referenceHref, referencesIn } from '@shared/text'
import { cn } from '../../lib/cn'
import { EntryFace } from './EntryFace'
import { openSevenLink } from '../../lib/links'
import { useViewPlace } from '../../lib/viewPlace'

export function LinkFaceList({ text, className }: { text: string; className?: string }) {
  const refs = useMemo(() => referencesIn(text), [text])
  if (!refs.length) return null
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {refs.map((r) => (
        <button key={r.link} type="button" title={`Open ${showName(r.ref.replace(/^"|"$/g, ''))}`} onClick={() => openSevenLink(referenceHref(r.kind, r.ref))} className="w-40 text-left transition-transform hover:-translate-y-0.5">
          <EntryFace link={r.link} />
        </button>
      ))}
    </div>
  )
}

export function LinkFaces({ text }: { text: string }) {
  const refs = useMemo(() => referencesIn(text), [text])
  const [shown, setShown] = useViewPlace('chat.linkFaces', true)
  if (!refs.length) return null
  return (
    <div className="mt-1.5 flex flex-col items-end gap-1">
      {shown && <LinkFaceList text={text} className="justify-end" />}
      <button type="button" onClick={() => setShown(!shown)} className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint hover:text-accent">
        {shown ? 'Hide' : 'Show'} {refs.length} linked
      </button>
    </div>
  )
}
