import { useMemo } from 'react'
import { Paperclip } from 'lucide-react'
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
    <div className={cn('flex flex-wrap gap-2.5', className)}>
      {refs.map((r) => (
        <button
          key={r.link}
          type="button"
          title={`Open ${showName(r.ref.replace(/^"|"$/g, ''))}`}
          onClick={() => openSevenLink(referenceHref(r.kind, r.ref))}
          className="w-48 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
        >
          <EntryFace link={r.link} compact />
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
    <div className="mt-2.5 flex flex-col items-end gap-1.5 w-full">
      <div className="flex items-center justify-between w-full border-t border-line/40 pt-1.5 font-label text-[10px] caps-5 text-dim">
        <span className="flex items-center gap-1.5 text-accent font-semibold">
          <Paperclip className="h-3 w-3" />
          ATTACHED CONTEXT ({refs.length})
        </span>
        <button
          type="button"
          onClick={() => setShown(!shown)}
          className="text-faint hover:text-ink transition-colors cursor-pointer"
        >
          {shown ? '[-] COLLAPSE' : '[+] EXPAND'}
        </button>
      </div>
      {shown && <LinkFaceList text={text} className="justify-end w-full" />}
    </div>
  )
}
