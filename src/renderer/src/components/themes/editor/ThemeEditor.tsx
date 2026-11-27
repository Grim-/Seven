import { useEffect, useRef, useState } from 'react'
import { ListChecks } from 'lucide-react'
import { SEVEN_THEME, type ThemeDraft } from '@shared/theme'
import { EmptyState, SettingsBrowser, flashSetting } from '../../ui'
import { useViewPlace } from '../../../lib/viewPlace'
import { useResolvedLook } from '../../../lib/skins/useResolvedLook'
import { THEME_PAGES, changedCount } from './pages'
import { Specimen } from './Specimen'
import type { SectionProps } from './edit'

const CHANGED = 'changed'

export function ThemeEditor({ draft, set, readOnly }: { draft: ThemeDraft; set: (patch: Partial<ThemeDraft>) => void; readOnly: boolean }) {
  const defaults = useResolvedLook(SEVEN_THEME)
  const [page, setPage] = useViewPlace('themes.page', 'colours')
  const [query, setQuery] = useState('')
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const timer = setTimeout(() => flashSetting(body.current, query), 120)
    return () => clearTimeout(timer)
  }, [page, query])

  const props: SectionProps = { draft, set, defaults }
  const changed = changedCount(draft)
  const current = THEME_PAGES.find((p) => p.id === page)
  const searching = Boolean(query.trim())

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <SettingsBrowser
        sections={[
          { id: CHANGED, label: 'Changed', hint: 'What differs from Seven', icon: <ListChecks />, count: changed },
          ...THEME_PAGES.map((p) => ({ id: p.id, label: p.label, group: p.group, hint: p.hint, icon: p.icon, count: p.count(draft) }))
        ]}
        current={searching ? null : (current?.id ?? CHANGED)}
        onPick={(id) => {
          setQuery('')
          setPage(id)
        }}
        query={query}
        onQuery={setQuery}
        onSearchEnter={() => flashSetting(body.current, query)}
        placeholder="Search this theme"
        bodyRef={body}
      >
        <fieldset disabled={readOnly} className="contents">
          {searching ? (
            THEME_PAGES.map((p) => <p.Page key={p.id} {...props} />)
          ) : current ? (
            <current.Page {...props} />
          ) : changed ? (
            <div className="flex flex-col gap-3 [&_.setting-card:not(:has([data-changed=true]))]:hidden [&_[data-changed=false]]:hidden">
              {THEME_PAGES.map((p) => (
                <p.Page key={p.id} {...props} />
              ))}
            </div>
          ) : (
            <EmptyState title="Nothing changed">Every value is Seven's own. Pick a section on the left to change one.</EmptyState>
          )}
        </fieldset>
      </SettingsBrowser>
      <Specimen />
    </div>
  )
}
