import { useMemo, useState, type ReactNode } from 'react'
import type { ModelConfig, ModelTraitSet, ParamSection } from '@shared/types'
import { SaveState, SettingCard, SettingsBrowser, type BrowserSection } from '../../ui'
import { useModels } from '../../../store/models'
import { useServerBuild } from '../../server/useServerBuild'
import { useViewPlace } from '../../../lib/viewPlace'
import { MODEL_SECTIONS } from './sections'
import { isChanged, type ParamContext } from './paramTree'
import type { ModelConfigState } from './useModelConfig'
import { usePacks } from './usePacks'
import { SectionPage } from './SectionPage'
import { ChangedPage, changedParams } from './ChangedPage'
import { SearchPage } from './SearchPage'
import { PacksPage } from './PacksPage'
import { PackRow } from './PackRow'

interface SettingsPage extends BrowserSection {
  body: () => ReactNode
}

export interface SectionLead {
  section: ParamSection
  node: ReactNode
}

export function ModelSettings({ modelId, state, traits, overview, leads = [] }: { modelId: string; state: ModelConfigState; traits: ModelTraitSet; overview: ReactNode; leads?: SectionLead[] }) {
  const params = useModels((s) => s.params)
  const build = useServerBuild()
  const { listing, setOn } = usePacks(modelId)
  const byKey = useMemo(() => new Map(params.map((p) => [p.key, p])), [params])
  const [page, setPage] = useViewPlace('models.settingsPage', 'overview')
  const [query, setQuery] = useState('')
  if (!state.config) return null
  const own = state.config
  const effective = listing?.effective ?? own
  const config: ModelConfig = Object.fromEntries(params.map((p) => [p.key, isChanged(p, own) ? own[p.key] : (effective[p.key] ?? own[p.key])]))
  const ctx: ParamContext = { config, own, packs: listing?.values ?? {}, traits, byKey, build }
  const on = listing?.packs.filter((p) => p.on).map((p) => p.id) ?? []
  const pages: SettingsPage[] = [
    { id: 'overview', label: 'Overview', group: 'Model', body: () => overview },
    { id: 'changed', label: 'Changed', group: 'Model', count: changedParams(params, ctx).length, body: () => <ChangedPage params={params} ctx={ctx} state={state} /> },
    { id: 'packs', label: 'Packs', group: 'Model', count: on.length, body: () => listing && <PacksPage listing={listing} setOn={setOn} /> },
    ...MODEL_SECTIONS.map((s) => {
      const defs = params.filter((p) => p.section === s.id)
      return { id: s.id, label: s.label, group: s.group, count: defs.filter((p) => isChanged(p, own)).length, body: () => <SectionPage label={s.label} defs={defs} ctx={ctx} state={state} lead={leads.find((l) => l.section === s.id)?.node} /> }
    })
  ]
  const current = pages.find((p) => p.id === page) ?? pages[0]
  const q = query.trim().toLowerCase()
  const packHits = q ? (listing?.packs ?? []).filter((p) => [p.title, p.for, p.why, ...p.sets.map((x) => x.label)].some((w) => w.toLowerCase().includes(q))) : []
  const pick = (id: string) => {
    setQuery('')
    setPage(id)
  }
  return (
    <SettingsBrowser sections={pages} current={q ? null : current.id} onPick={pick} query={query} onQuery={setQuery} placeholder="Search settings, flags or packs">
      <div className="flex justify-end">
        <SaveState status={state.status} error={state.error} />
      </div>
      {q ? (
        <>
          {packHits.length > 0 && (
            <SettingCard title="Packs" count={packHits.length}>
              {packHits.map((p) => (
                <PackRow key={p.id} pack={p} on={on} setOn={setOn} />
              ))}
            </SettingCard>
          )}
          <SearchPage params={params} query={query} ctx={ctx} state={state} />
        </>
      ) : (
        current.body()
      )}
    </SettingsBrowser>
  )
}
