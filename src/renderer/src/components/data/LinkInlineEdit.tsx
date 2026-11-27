import type { ComponentProps } from 'react'
import { InlineEdit } from '../ui'
import { withReferences } from '../chat/References'
import { LinkTextarea } from './LinkTextarea'

export function LinkInlineEdit(props: Omit<ComponentProps<typeof InlineEdit>, 'edit' | 'numeric'>) {
  return (
    <InlineEdit
      {...props}
      shown={
        props.shown ??
        (props.value ? <span className="inline-flex items-center gap-1">{withReferences(props.value)}</span> : undefined)
      }
      edit={({ draft, setDraft, commit, cancel }) => (
        <LinkTextarea
          autoFocus
          rolls={false}
          rows={1}
          value={draft}
          onValue={setDraft}
          placeholder={props.placeholder}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              commit(draft)
            }
            if (e.key === 'Escape') cancel()
          }}
          className="min-h-0 h-22.5 resize-none"
        />
      )}
    />
  )
}
