import { useEffect, useMemo } from 'react'
import { ArrowDownWideNarrow, Boxes, Clock, Heart } from 'lucide-react'
import type { HubFamily, HubModel } from '@shared/types'
import { AlertBox, FilterBar, KindShell, SearchBox, Segmented, type ShellItem, type ShellSort } from '../ui'
import { useHub } from '../../store/hub'
import { formatCount } from '../../lib/format'
import { applyFilters, filterActive, useFilterValues } from '../../lib/propertyFilters'
import { useViewPlace } from '../../lib/viewPlace'
import { hubFilters } from './hubFilters'
import { ImagePacksView } from './ImagePacksView'
import { modelTraits } from './ModelTraits'

const FAMILIES: { value: HubFamily; label: string }[] = [
  { value: 'image-packs', label: 'sd-server Packs' },
  { value: 'gguf', label: 'GGUF Chat' },
  { value: 'image-gguf', label: 'Image GGUF' },
  { value: 'diffusion', label: 'Diffusion Repos' },
  { value: 'image-companions', label: 'VAE / Encoders' }
]

const FAMILY_META: Record<HubFamily, { placeholder: string; tag: string; empty: string }> = {
  'image-packs': { placeholder: 'Filter curated sd-server image packs (Z-Image, Flux, Qwen, SDXL…)', tag: 'PACK', empty: 'No curated packs match.' },
  gguf: { placeholder: 'Search Hugging Face GGUF chat models', tag: 'GGUF', empty: 'No GGUF models match.' },
  'image-gguf': { placeholder: 'Search GGUF image models (Flux, Qwen, Z-Image…)', tag: 'IMG GGUF', empty: 'No GGUF image models match.' },
  diffusion: { placeholder: 'Search Hugging Face diffusion checkpoints & repos', tag: 'IMAGE', empty: 'No diffusion models match.' },
  'image-companions': { placeholder: 'Search VAE, CLIP-L, T5XXL, and LLM encoders', tag: 'COMPANION', empty: 'No VAE or encoder repos match.' }
}

export function hubSubtitle(m: HubModel): string {
  return [m.params ? `${formatCount(m.params)} params` : null, m.architecture, m.contextLength ? `${formatCount(m.contextLength)} context` : null].filter(Boolean).join(' · ')
}

export function HubSearch({ onOpen }: { onOpen: (model: HubModel) => void }) {
  const { query, family, results, searching, error, search, facts, resolveFacts } = useHub()
  const [text, setText] = useViewPlace('models.hub.query', '')
  const [pickedFamily, setPickedFamily] = useViewPlace<HubFamily>('models.hub.family', family)
  const [values, setValue] = useFilterValues('models.hub')
  const isPacks = pickedFamily === 'image-packs'

  useEffect(() => {
    if (!isPacks && results === null && !searching) void search(text.trim(), pickedFamily)
  }, [])
  useEffect(() => {
    if (!isPacks && pickedFamily !== family) void search(text.trim(), pickedFamily)
  }, [pickedFamily, isPacks])
  useEffect(() => {
    if (isPacks || text.trim() === query.trim()) return
    const timer = setTimeout(() => void search(text.trim(), pickedFamily), 400)
    return () => clearTimeout(timer)
  }, [text, isPacks])

  const factOf = (m: HubModel) => {
    const f = facts[m.id]
    return f ? f.value : undefined
  }
  const filters = useMemo(() => hubFilters(factOf, pickedFamily), [facts, pickedFamily])
  const { shown, pending } = useMemo(() => applyFilters(results ?? [], filters, values), [results, filters, values])
  const needsFacts = pickedFamily === 'gguf' && filters.some((f) => (f.id === 'shape' || f.id === 'mtp') && filterActive(f, values))
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
  const meta = FAMILY_META[pickedFamily]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {isPacks ? (
        <>
          <div className="flex flex-wrap items-center gap-2 border border-line bg-panel px-3 py-2">
            <SearchBox value={text} onChange={setText} placeholder={meta.placeholder} className="w-72" />
            <Segmented value={pickedFamily} options={FAMILIES} onChange={(v) => setPickedFamily(v)} />
          </div>
          <ImagePacksView filterText={text} />
        </>
      ) : (
        <>
          {error && <AlertBox>{error}</AlertBox>}
          <FilterBar filters={filters} values={values} onChange={setValue}>
            {results && `${shown.length} of ${results.length} shown${pending.length ? ` · checking ${pending.length} file headers` : ''}`}
          </FilterBar>
          <KindShell
            id="models.hub"
            layouts={['list', 'cards']}
            filter={false}
            sorts={sorts}
            asideLabel="Downloads"
            header={
              <div className="flex flex-wrap items-center gap-2">
                <SearchBox value={text} onChange={setText} placeholder={meta.placeholder} className="w-72" />
                <Segmented value={pickedFamily} options={FAMILIES} onChange={(v) => setPickedFamily(v)} />
              </div>
            }
            items={shown.map((m) => ({
              key: m.id,
              title: m.id,
              subtitle: hubSubtitle(m),
              excerpt: `${formatCount(m.likes)} likes`,
              icon: <Boxes className="h-4 w-4" />,
              tag: m.gated ? 'GATED' : meta.tag,
              traits: modelTraits(factOf(m)).filter((t) => t.key !== 'quant'),
              aside: formatCount(m.downloads),
              updatedAt: m.updatedAt ?? undefined
            }))}
            onOpen={(item) => {
              const model = byId.get(item.key)
              if (model) onOpen(model)
            }}
            empty={searching ? 'Searching…' : results?.length ? 'Nothing matches these filters.' : meta.empty}
          />
        </>
      )}
    </div>
  )
}
