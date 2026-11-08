import { useEffect, useMemo, useState } from 'react'
import { Star, Trash2 } from 'lucide-react'
import type { ModelStats, StatsSummary } from '@shared/types'
import { Button, GridRow, GridTable, Modal, TraitChips, ViewHeader, type GridColumn } from '../components/ui'
import { modelTraits } from '../components/models/ModelTraits'
import { engine } from '../lib/ipc'
import { failed } from '../lib/notify'
import { formatRelative } from '../lib/format'
import { modelBytes, useModels } from '../store/models'
import { useApp } from '../store/app'
import { setViewPlace } from '../lib/viewPlace'
import { cn } from '../lib/cn'

type SortKey = 'genPerSecond' | 'promptPerSecond' | 'ttftMs' | 'turns'

const SORTS: { key: SortKey; label: string; low: boolean }[] = [
  { key: 'genPerSecond', label: 'Writing', low: false },
  { key: 'promptPerSecond', label: 'Reading', low: false },
  { key: 'ttftMs', label: 'First token', low: true },
  { key: 'turns', label: 'Replies', low: false }
]

const rate = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)} tok/s`)
const secs = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`)
const count = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : String(v))

export function SpeedView() {
  const list = useModels((s) => s.list)
  const setFavourite = useModels((s) => s.setFavourite)
  const setView = useApp((s) => s.setView)
  const [summary, setSummary] = useState<StatsSummary | null>(null)
  const [clearing, setClearing] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'genPerSecond', desc: true })

  const load = () => void engine('stats.summary').then(setSummary).catch(failed('Could not read the speed stats'))
  useEffect(load, [])

  const clear = () =>
    void engine('stats.clear')
      .then(() => {
        setClearing(false)
        load()
      })
      .catch(failed('Could not clear the speed stats'))

  const open = (id: string) => {
    setViewPlace('models.hub', null)
    setViewPlace('models.selected', id)
    setView('models')
  }

  const rows = useMemo(() => {
    const value = (m: ModelStats) => m[sort.key]
    return [...(summary?.models ?? [])].sort((a, b) => {
      const x = value(a)
      const y = value(b)
      if (x === null && y === null) return 0
      if (x === null) return 1
      if (y === null) return -1
      return sort.desc ? y - x : x - y
    })
  }, [summary, sort])

  const pick = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: !SORTS.find((o) => o.key === key)?.low }))
  const header = (key: SortKey, width: string): GridColumn => ({ label: SORTS.find((o) => o.key === key)!.label, width, right: true, sorted: sort.key === key ? (sort.desc ? 'desc' : 'asc') : null, onSort: () => pick(key) })
  const columns: GridColumn[] = [
    { label: '#', width: '2.5rem', right: true },
    { label: '', width: '1.5rem' },
    { label: 'Model', width: 'minmax(12rem, 1fr)' },
    { label: 'Size', width: 'minmax(9rem, 14rem)' },
    { label: 'Context', width: '5rem', right: true },
    { label: 'GPU layers', width: '6rem', right: true },
    header('genPerSecond', '7.5rem'),
    header('promptPerSecond', '7.5rem'),
    header('ttftMs', '6.5rem'),
    header('turns', '5rem'),
    { label: 'Last used', width: '7rem', right: true }
  ]

  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <ViewHeader
        title="Model speed"
        subtitle="Every model you've chatted with locally, ranked from Seven's speed stats. Each model, context size and GPU layer count is its own row."
        actions={
          <Button variant="ghost" icon={<Trash2 />} disabled={!summary?.models.length} onClick={() => setClearing(true)}>
            Clear stats
          </Button>
        }
      />
      <Modal
        open={clearing}
        title="Clear all speed stats"
        onClose={() => setClearing(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setClearing(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={clear}>
              Clear stats
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-white/85">Every recorded reply speed for every model is deleted. This can't be undone.</p>
      </Modal>
      <div className="min-h-0 flex-1 overflow-y-auto border border-line/40 bg-bg">
        <GridTable columns={columns} empty={summary && !rows.length ? 'No speed stats yet. Chat with a local model and its replies are counted here.' : false}>
          {rows.map((m, i) => {
            const entry = list.find((e) => e.id === m.modelId)
            const sizes = entry ? modelTraits(entry.info, modelBytes(entry)).filter((t) => t.key === 'params' || t.key === 'bytes' || t.key === 'shape') : []
            return (
              <GridRow key={`${m.modelId}/${m.contextSize}/${m.gpuLayers ?? ''}`} onClick={entry ? () => open(m.modelId) : undefined}>
                <span className="text-right font-mono text-[12px] text-faint">{i + 1}</span>
                {entry ? (
                  <span
                    role="button"
                    tabIndex={0}
                    title={entry.favourite ? 'Unfavourite' : 'Favourite'}
                    onClick={(e) => {
                      e.stopPropagation()
                      void setFavourite(entry.id, !entry.favourite).catch(failed('Could not change the favourite'))
                    }}
                    className="flex items-center justify-center"
                  >
                    <Star className={cn('h-3.5 w-3.5', entry.favourite ? 'fill-accent text-accent' : 'text-faint hover:text-white')} />
                  </span>
                ) : (
                  <span />
                )}
                <span className="truncate text-[13px] text-white" title={entry ? m.modelName : `${m.modelName} is no longer in Models`}>
                  {m.modelName}
                </span>
                <TraitChips traits={sizes} />
                <span className="text-right font-mono text-[12px] text-white/85">{count(m.contextSize)}</span>
                <span className="text-right font-mono text-[12px] text-white/85">{m.gpuLayers ?? '—'}</span>
                <span className="text-right font-mono text-[12.5px] text-accent">{rate(m.genPerSecond)}</span>
                <span className="text-right font-mono text-[12px] text-white/85">{rate(m.promptPerSecond)}</span>
                <span className="text-right font-mono text-[12px] text-white/85">{secs(m.ttftMs)}</span>
                <span className="text-right font-mono text-[12px] text-white/85">{m.turns}</span>
                <span className="text-right font-mono text-[11px] text-faint">{formatRelative(m.lastAt)}</span>
              </GridRow>
            )
          })}
        </GridTable>
      </div>
    </div>
  )
}
