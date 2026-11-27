import { useEffect, useMemo, useRef, useState } from 'react'
import { SettingsBrowser, ViewHeader, flashSetting } from '../components/ui'
import { SETTINGS_GROUPS, settingsMatch, settingsSections } from '../registries/settings'
import { registerCoreSettings } from './settings/sections'
import { useViewPlace } from '../lib/viewPlace'

registerCoreSettings()

export function SettingsView() {
  const sections = settingsSections()
  const [section, setSection] = useViewPlace('settings.section', 'appearance')
  const [query, setQuery] = useState('')
  const body = useRef<HTMLDivElement>(null)
  const shown = useMemo(() => sections.filter((s) => settingsMatch(s, query)), [sections, query])
  const current = sections.find((s) => s.id === section) ?? sections[0]

  useEffect(() => {
    if (query.trim() && shown.length && !shown.some((s) => s.id === section)) setSection(shown[0].id)
  }, [query])

  useEffect(() => {
    const timer = setTimeout(() => flashSetting(body.current, query), 120)
    return () => clearTimeout(timer)
  }, [section, query])

  const order = [...new Set([...SETTINGS_GROUPS, ...shown.map((s) => s.group)])]
  const ordered = order.flatMap((g) => shown.filter((s) => s.group === g))
  const Page = current.Page
  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <ViewHeader title="Settings" subtitle="How Seven looks, where it keeps things and what agents may do." />
      <SettingsBrowser
        sections={ordered.map((s) => ({ id: s.id, label: s.label, group: s.group, hint: s.hint, icon: s.icon }))}
        current={current.id}
        onPick={setSection}
        query={query}
        onQuery={setQuery}
        onSearchEnter={() => flashSetting(body.current, query)}
        empty={<div className="px-2 py-3 text-[12px] text-faint">No setting matches "{query.trim()}".</div>}
        bodyRef={body}
      >
        <Page />
      </SettingsBrowser>
    </div>
  )
}
