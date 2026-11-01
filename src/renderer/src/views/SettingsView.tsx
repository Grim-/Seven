import { useEffect, useMemo, useRef, useState } from 'react'
import { ListRow, ViewHeader } from '../components/ui'
import { SETTINGS_GROUPS, settingsMatch, settingsSections } from '../registries/settings'
import { registerCoreSettings } from './settings/sections'
import { useViewPlace } from '../lib/viewPlace'

registerCoreSettings()

function flashSetting(root: HTMLElement | null, query: string): void {
  const q = query.trim().toLowerCase()
  if (!root || !q) return
  const row = [...root.querySelectorAll<HTMLElement>('[data-setting]')].find((el) => el.dataset.setting?.toLowerCase().includes(q))
  if (!row) return
  row.scrollIntoView({ block: 'center', behavior: 'smooth' })
  row.dataset.flash = 'true'
  setTimeout(() => (row.dataset.flash = 'false'), 900)
}

export function SettingsView() {
  const sections = settingsSections()
  const [section, setSection] = useViewPlace('settings.section', 'appearance')
  const [query, setQuery] = useState('')
  const search = useRef<HTMLInputElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const shown = useMemo(() => sections.filter((s) => settingsMatch(s, query)), [sections, query])
  const current = sections.find((s) => s.id === section) ?? sections[0]
  const pick = (id: string) => setSection(id)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || (e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable="true"]')) return
      e.preventDefault()
      search.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (query.trim() && shown.length && !shown.some((s) => s.id === section)) pick(shown[0].id)
  }, [query])

  useEffect(() => {
    const timer = setTimeout(() => flashSetting(body.current, query), 120)
    return () => clearTimeout(timer)
  }, [section, query])

  const groups = [...new Set([...SETTINGS_GROUPS, ...shown.map((s) => s.group)])].filter((g) => shown.some((s) => s.group === g))
  const Page = current.Page
  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <ViewHeader title="Settings" subtitle="How Seven looks, where it keeps things and what agents may do." />
      <div className="flex min-h-0 flex-1 gap-3">
        <nav className="flex w-64 shrink-0 flex-col gap-0.5 overflow-y-auto border border-line/60 bg-black/70 p-2">
          <div className="mb-1 flex items-center border border-line/50 focus-within:border-accent/60">
            <input
              ref={search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setQuery('')
                if (e.key === 'Enter') flashSetting(body.current, query)
              }}
              placeholder="Search settings"
              spellCheck={false}
              className="h-8 min-w-0 flex-1 bg-transparent px-2.5 font-mono text-[11.5px] text-white outline-none placeholder:text-faint"
            />
            <kbd className="mr-2 border border-white/10 px-1 font-mono text-[9.5px] text-faint">/</kbd>
          </div>
          {groups.map((g) => (
            <div key={g} className="flex flex-col gap-0.5">
              <div className="px-1.5 pb-1 pt-3 font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-faint">{g}</div>
              {shown
                .filter((s) => s.group === g)
                .map((s) => (
                  <ListRow key={s.id} active={current.id === s.id} onClick={() => pick(s.id)} icon={s.icon} title={s.label} subtitle={s.hint} tone="tag" />
                ))}
            </div>
          ))}
          {!shown.length && <div className="px-2 py-3 text-[12px] text-faint">No setting matches "{query.trim()}".</div>}
        </nav>
        <div ref={body} className="flex min-h-0 max-w-4xl flex-1 flex-col gap-3 overflow-y-auto pr-1 [&>*]:shrink-0">
          <Page />
        </div>
      </div>
    </div>
  )
}
