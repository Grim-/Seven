import { useState } from 'react'
import { ExternalLink, FileText, Search, User, X } from 'lucide-react'
import { openEntry } from '../../lib/library'
import { EntryPicker } from '../library/EntryPicker'
import type { LibraryHit } from '@shared/types'
import { cn } from '../../lib/cn'

interface EntrySelectProps {
  value?: string | null
  onChange: (entry: string | null) => void
  placeholder?: string
  className?: string
}

export function EntrySelect({
  value,
  onChange,
  placeholder = 'Select linked library entry...',
  className
}: EntrySelectProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const parseKindAndId = (val: string | null | undefined) => {
    if (!val) return null
    const [kind, id] = val.split(':')
    return kind && id ? { kind, id } : null
  }

  const parsed = parseKindAndId(value)

  const handlePick = (hit: LibraryHit) => {
    onChange(`${hit.kind}:${hit.id}`)
    setPickerOpen(false)
  }

  return (
    <div className={cn('relative flex flex-col gap-1 font-ui', className)}>
      <div className="flex items-center gap-1.5 border border-line tone-well-50 px-2 py-1">
        {parsed ? (
          <div className="flex min-w-0 flex-1 items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 truncate">
              {parsed.kind === 'sheet' ? (
                <User className="h-3.5 w-3.5 text-accent shrink-0" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-tint-cyan shrink-0" />
              )}
              <span className="text-[11px] font-bold text-ink truncate">
                {parsed.kind}:{parsed.id}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => openEntry(parsed.kind, parsed.id)}
                title="Open entry"
                className="flex items-center gap-0.5 text-[9px] text-tint-cyan hover:text-ink transition-colors"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                <span>Open</span>
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                title="Remove linked entry"
                className="p-0.5 text-dim hover:text-alert transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex flex-1 items-center gap-1.5 text-[11px] text-faint hover:text-dim text-left"
          >
            <Search className="h-3 w-3 text-faint" />
            <span>{placeholder}</span>
          </button>
        )}

        {!parsed && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="border border-line/60 bg-line/20 px-2 py-0.5 text-[9.5px] font-bold text-tint-cyan hover:border-tint-cyan hover:text-ink transition-colors cursor-pointer"
          >
            Browse
          </button>
        )}
      </div>

      {pickerOpen && (
        <EntryPicker
          kind={null}
          title="Link Library Entry"
          onPick={handlePick}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
