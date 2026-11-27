import { useMemo } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useDrafts } from '../../store/drafts'
import { parsePartialObject } from '../../lib/partialJson'
import { Presentation, isPresentation } from '../../registries/presentations'
import { presentationTypeOf } from '@shared/toolnames'
import { draftPreviewFor } from '../../registries/drafts'

export function DraftPart({ messageId }: { messageId: string }) {
  const draft = useDrafts((s) => s.drafts[messageId])
  const Preview = draft ? draftPreviewFor(draft.name) : null
  const fields = useMemo(() => (draft && (Preview || isPresentation(draft.name)) ? parsePartialObject(draft.text) : null), [draft, Preview])
  if (!draft) return null
  if (fields && Preview) return <Preview fields={fields} />
  if (fields) {
    return (
      <div className="my-2">
        <Presentation data={{ type: presentationTypeOf(draft.name) ?? draft.name, fields, where: 'inline', key: null }} draft />
      </div>
    )
  }
  return (
    <div className="my-2 flex items-center gap-2 font-label text-[11px] caps-14 text-secondary-ink/80">
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      Writing {draft.name} call
      <span className="text-faint normal-case tracking-normal">{draft.text.length.toLocaleString()} chars</span>
    </div>
  )
}
