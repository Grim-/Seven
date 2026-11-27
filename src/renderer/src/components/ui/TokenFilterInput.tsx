import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface FilterOption {
  id: string
  count: number
}

export interface ParsedTokenFilter {
  text: string
  types: string[]
  tags: string[]
}

export function parseTokenFilter(raw: string): ParsedTokenFilter {
  const types: string[] = []
  const tags: string[] = []
  const cleaned = raw
    .replace(/\btype:([^\s]+)/gi, (_, t: string) => {
      const low = t.toLowerCase()
      if (low) types.push(low)
      return ''
    })
    .replace(/(?:^|\s)(?:#|tag:)([^\s]+)/gi, (_, t: string) => {
      const low = t.toLowerCase()
      if (low) tags.push(low)
      return ''
    })
  return { text: cleaned.trim().toLowerCase(), types, tags }
}

export function TokenFilterInput({
  value,
  onChange,
  types,
  onTypesChange,
  tags,
  onTagsChange,
  typeOptions = [],
  tagOptions = [],
  placeholder = 'Filter…',
  compact = false,
  className
}: {
  value: string
  onChange: (next: string) => void
  types: string[]
  onTypesChange: (next: string[]) => void
  tags: string[]
  onTagsChange: (next: string[]) => void
  typeOptions?: FilterOption[]
  tagOptions?: FilterOption[]
  placeholder?: string
  compact?: boolean
  className?: string
}) {
  const [focused, setFocused] = useState(false)
  const parsed = useMemo(() => parseTokenFilter(value), [value])
  const activeTypes = useMemo(() => [...new Set([...types, ...parsed.types])], [types, parsed.types])
  const activeTags = useMemo(() => [...new Set([...tags, ...parsed.tags])], [tags, parsed.tags])
  const hasAny = activeTypes.length > 0 || activeTags.length > 0

  const removeType = (id: string) => {
    onTypesChange(types.filter((x) => x !== id))
    onChange(value.replace(new RegExp(`\\btype:${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '').trim())
  }

  const removeTag = (id: string) => {
    onTagsChange(tags.filter((x) => x !== id))
    onChange(value.replace(new RegExp(`(?:^|\\s)(?:#|tag:)${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '').trim())
  }

  const typeSuggestions = useMemo(() => {
    if (/(?:^|\s)(?:#|tag:)([^\s]*)$/i.test(value)) return []
    const m = /(?:^|\s)type:([^\s]*)$/i.exec(value)
    const needle = m ? m[1].toLowerCase() : ''
    return typeOptions.filter((t) => !activeTypes.includes(t.id.toLowerCase()) && (!needle || t.id.toLowerCase().includes(needle)))
  }, [typeOptions, activeTypes, value])

  const tagSuggestions = useMemo(() => {
    if (/(?:^|\s)type:([^\s]*)$/i.test(value)) return []
    const m = /(?:^|\s)(?:#|tag:)([^\s]*)$/i.exec(value)
    const needle = m ? m[1].toLowerCase() : ''
    return tagOptions.filter((t) => !activeTags.includes(t.id.toLowerCase()) && (!needle || t.id.toLowerCase().includes(needle)))
  }, [tagOptions, activeTags, value])

  const showSuggestions = (focused || /(?:^|\s)(?:type:|#|tag:)/i.test(value)) && (typeSuggestions.length > 0 || tagSuggestions.length > 0)

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'flex flex-wrap items-center gap-1 border border-line/40 bg-transparent px-1.5 focus-within:border-accent/50',
          compact ? 'min-h-6 py-0.5' : 'py-1'
        )}
      >
        {activeTypes.map((t) => (
          <button
            key={`type:${t}`}
            type="button"
            onClick={() => removeType(t)}
            title={`Remove type:${t} filter`}
            className="inline-flex items-center gap-1 border border-secondary-ink/60 bg-secondary-ink/15 px-1.5 py-0.5 font-ui text-[10px] leading-none text-secondary-ink hover:border-alert hover:bg-alert/15 hover:text-alert cursor-pointer"
          >
            <span>type:{t}</span>
            <X className="h-2.5 w-2.5" />
          </button>
        ))}
        {activeTags.map((t) => (
          <button
            key={`tag:${t}`}
            type="button"
            onClick={() => removeTag(t)}
            title={`Remove #${t} filter`}
            className="inline-flex items-center gap-1 border border-accent/60 bg-accent/15 px-1.5 py-0.5 font-ui text-[10px] leading-none text-accent hover:border-alert hover:bg-alert/15 hover:text-alert cursor-pointer"
          >
            <span>#{t}</span>
            <X className="h-2.5 w-2.5" />
          </button>
        ))}
        <input
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onChange('')
              onTypesChange([])
              onTagsChange([])
            } else if (e.key === 'Backspace' && !value) {
              if (tags.length > 0) onTagsChange(tags.slice(0, -1))
              else if (types.length > 0) onTypesChange(types.slice(0, -1))
            } else if (e.key === 'Enter' && (parsed.types.length > 0 || parsed.tags.length > 0)) {
              e.preventDefault()
              if (parsed.types.length) onTypesChange([...new Set([...types, ...parsed.types])])
              if (parsed.tags.length) onTagsChange([...new Set([...tags, ...parsed.tags])])
              onChange(parsed.text)
            }
          }}
          placeholder={hasAny ? 'Filter…' : placeholder}
          spellCheck={false}
          className={cn(
            'min-w-[4.5rem] flex-1 bg-transparent px-1 text-ink outline-none placeholder:text-faint',
            compact ? 'h-4.5 text-[12px]' : 'h-5 text-[12.5px]'
          )}
        />
      </div>
      {showSuggestions && (
        <div
          className={cn(
            'flex flex-wrap gap-1 border border-line/50 tone-panel-95 p-1.5 shadow-lg',
            compact ? 'absolute right-0 top-full z-40 mt-1 w-72 max-w-[80vw]' : 'mt-1'
          )}
        >
          {typeSuggestions.map((t) => (
            <button
              key={`sug-type:${t.id}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                const low = t.id.toLowerCase()
                if (!types.includes(low)) onTypesChange([...types, low])
                onChange(value.replace(/(?:^|\s)type:[^\s]*$/i, '').trim())
              }}
              className="border border-line/50 tone-well-50 px-1.5 py-0.5 font-ui text-[10px] text-dim hover:border-secondary-ink/60 hover:text-secondary-ink cursor-pointer"
            >
              type:{t.id} <span className="text-faint">{t.count}</span>
            </button>
          ))}
          {tagSuggestions.map((t) => (
            <button
              key={`sug-tag:${t.id}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                const low = t.id.toLowerCase()
                if (!tags.includes(low)) onTagsChange([...tags, low])
                onChange(value.replace(/(?:^|\s)(?:#|tag:)[^\s]*$/i, '').trim())
              }}
              className="border border-line/50 tone-well-50 px-1.5 py-0.5 font-ui text-[10px] text-dim hover:border-accent/60 hover:text-accent cursor-pointer"
            >
              #{t.id} <span className="text-faint">{t.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
