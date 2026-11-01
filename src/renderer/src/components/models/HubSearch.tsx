import { useEffect, useMemo } from 'react'
import { ArrowDownWideNarrow, Boxes, Clock, Heart } from 'lucide-react'
import type { HubModel } from '@shared/types'
import { AlertBox, FacetBar, KindShell, SearchBox, type ShellItem, type ShellSort } from '../ui'
import { useHub } from '../../store/hub'
import { formatCount } from '../../lib/format'
import { applyFacets, facetActive, useFacetValues } from '../../lib/facets'
import { useViewPlace } from '../../lib/viewPlace'
import { hubFacets } from './hubFacets'
import { modelTraits } from './ModelTraits'

export function hubSubtitle(m: HubModel): string {
  return [m.params ? `${formatCount(m.params)} params` : null, m.architecture, m.contextLength ? `${formatCount(m.contextLength)} context` : null].filter(Boolean).join(' · ')
}

export function HubSearch({ onOpen }: { onOpen: (model: HubModel) => void }) {
  const { query, results, searching, error, search, facts, resolveFacts } = useHub()
  const [text, setText] = useViewPlace('models.hub.query', '')
  const [values, setValue] = useFacetValues('models.hub')
  useEffect(() => {
    if (results === null && !searching) void search(text.trim())
  }, [])
  useEffect(() => {
    if (text.trim() === query.trim()) return
    const timer = setTimeout(() => void search(text.trim()), 400)
    return () => clearTimeout(timer)
  }, [text])
  const factOf = (m: HubModel) => {
    const f = facts[m.id]
    return f ? f.value : undefined
  }
  const facets = useMemo(() => hubFacets(factOf), [facts])
  const { shown, pending } = useMemo(() => applyFacets(results ?? [], facets, values), [results, facets, values])
  const needsFacts = facets.some((f) => (f.id === 'shape' || f.id === 'mtp') && facetActive(f, values))
  useEffect(() => {
    if (pending.length && needsFacts) resolveFacts(pending)
  }, [pending, needsFacts])
  const byId = useMemo(() => new Map((results ?? []).map((m) => [m.id, m])), [results])
  const sorts = useMemo((): ShellSort[] => {
    const by = (pick: (m: HubModel) => number) => (a: ShellItem, b: ShellItem) => pick(byId.get(b.key)!) - pick(byId.get(a.key)!)
    return [
      { id: 'downloads', title: 'Most downloaded', icon: <ArrowDownWideNarrow className="h-3.5 w-3.5" />, compare: by((m) => m.downloads) },
      { id: 'likes', title: 'Most liked', icon: <Heart className="h-3.5 w-3.5" />, compare: by((m) => m.likes) },
      { id: 'updated', title: 'Recently updated', icon: <Clock className="h-3.5 w-3.5" />, compare: by((m) => m.updatedAt ?? 0) }
    ]
  }, [byId])
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {error && <AlertBox>{error}</AlertBox>}
      <FacetBar facets={facets} values={values} onChange={setValue}>
        {results && `${shown.length} of ${results.length} shown${pending.length ? ` · checking ${pending.length} file headers` : ''}`}
      </FacetBar>
      <KindShell
        id="models.hub"
        layouts={['list', 'cards']}
        filter={false}
        sorts={sorts}
        asideLabel="Downloads"
        header={<SearchBox value={text} onChange={setText} placeholder="Search Hugging Face GGUF models" className="w-80" />}
        items={shown.map((m) => ({
          key: m.id,
          title: m.id,
          subtitle: hubSubtitle(m),
          excerpt: `${formatCount(m.likes)} likes`,
          icon: <Boxes className="h-4 w-4" />,
          tag: m.gated ? 'GATED' : 'GGUF',
          traits: modelTraits(factOf(m)).filter((t) => t.key !== 'quant'),
          aside: formatCount(m.downloads),
          updatedAt: m.updatedAt ?? undefined
        }))}
        onOpen={(item) => {
          const model = byId.get(item.key)
          if (model) onOpen(model)
        }}
        empty={searching ? 'Searching…' : results?.length ? 'Nothing matches these filters.' : 'No GGUF models match.'}
      />
    </div>
  )
}
