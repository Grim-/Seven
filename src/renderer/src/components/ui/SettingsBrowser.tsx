import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { ListRow } from './ListRow'
import { cn } from '../../lib/cn'
import { isTypingTarget, matchesKeybind } from '../../store/keybinds'

export interface BrowserSection {
  id: string
  label: string
  group?: string
  hint?: string
  icon?: ReactNode
  count?: number
}

export function SettingsBrowser({
  sections,
  current,
  onPick,
  query,
  onQuery,
  onSearchEnter,
  placeholder = 'Search settings',
  empty,
  bodyRef,
  wide = false,
  children
}: {
  sections: BrowserSection[]
  current: string | null
  onPick: (id: string) => void
  query: string
  onQuery: (q: string) => void
  onSearchEnter?: () => void
  placeholder?: string
  empty?: ReactNode
  bodyRef?: RefObject<HTMLDivElement | null>
  wide?: boolean
  children: ReactNode
}) {
  const search = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!matchesKeybind('app.settingsSearch', e) || isTypingTarget(e)) return
      e.preventDefault()
      search.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const groups = [...new Set(sections.map((s) => s.group ?? ''))]
  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <nav className="flex w-64 shrink-0 flex-col gap-0.5 overflow-y-auto border border-line/60 bg-black/70 p-2">
        <div className="mb-1 flex items-center border border-line/50 focus-within:border-accent/60">
          <input
            ref={search}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onQuery('')
              if (e.key === 'Enter') onSearchEnter?.()
            }}
            placeholder={placeholder}
            spellCheck={false}
            className="h-8 min-w-0 flex-1 bg-transparent px-2.5 font-mono text-[11.5px] text-white outline-none placeholder:text-faint"
          />
          <kbd className="mr-2 border border-white/10 px-1 font-mono text-[9.5px] text-faint">/</kbd>
        </div>
        {groups.map((g) => (
          <div key={g || '_'} className="flex flex-col gap-0.5">
            {g && <div className="px-1.5 pb-1 pt-3 font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-faint">{g}</div>}
            {sections
              .filter((s) => (s.group ?? '') === g)
              .map((s) => (
                <ListRow key={s.id} active={current === s.id} onClick={() => onPick(s.id)} icon={s.icon} title={s.label} subtitle={s.hint} tone="tag" meta={s.count ? s.count : undefined} />
              ))}
          </div>
        ))}
        {!sections.length && empty}
      </nav>
      <div ref={bodyRef} className={cn('flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 [&>*]:shrink-0', !wide && 'max-w-4xl')}>
        {children}
      </div>
    </div>
  )
}
