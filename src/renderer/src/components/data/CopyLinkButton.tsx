import { Copy } from 'lucide-react'
import { entryLink } from '../../store/data'
import { copyText } from '../../lib/notify'

export function CopyLinkButton({ kind, id }: { kind: string; id: string }) {
  return (
    <button
      title="Copy a link to this"
      onClick={() => {
        const link = entryLink(kind, id)
        void copyText(link, 'Link copied', link)
      }}
      className="ml-1.5 flex h-5 w-5 shrink-0 items-center justify-center text-dim hover:text-accent"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  )
}
