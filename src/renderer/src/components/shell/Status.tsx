import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Cpu, Cloud, Image as ImageIcon, SlidersHorizontal, Star, ChevronDown, Search, X } from 'lucide-react'
import { FilterBar, METER_TEXT, Meter, SegmentBar, StatusDot, meterTone, type Tone, Popover } from '../ui'
import { cn } from '../../lib/cn'
import { useApp } from '../../store/app'
import { gigabytes, useSystemStats } from '../../lib/systemStats'
import { isRunnable, modelBytes, modelName, sortModels, useModels } from '../../store/models'
import { entryFamily, modelFilters } from '../models/modelFilters'
import { applyFilters, filterActive, useFilterValues } from '../../lib/propertyFilters'
import { isImageModel, presetForSpec, remoteHostLabel } from '@shared/remoteModels'
import { engine as ask } from '../../lib/ipc'
import type { ModelEntry, ModelFacts } from '@shared/types'
import { toast } from '../../store/toasts'
import { failed } from '../../lib/notify'
import { formatBytes } from '../../lib/format'
import { noteFailure } from '../../store/problems'

type QuickScope = 'all' | 'favourites' | 'chat' | 'image' | 'remote'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-line/40 px-3 py-2.5 first:border-t-0 font-ui">
      <div className="text-[10px] font-semibold caps-16 text-accent-soft">{title}</div>
      {children}
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="flex items-baseline gap-3 text-[12px] font-ui">
      <span className="w-20 shrink-0 text-[10.5px] caps-5 text-faint">{label}</span>
      <span className={cn('min-w-0 break-words', tone === 'warn' ? 'text-accent' : 'text-ink/85')}>{value}</span>
    </div>
  )
}

function matchesQuery(m: ModelEntry, q: string): boolean {
  if (!q) return true
  const fam = entryFamily(m)?.toLowerCase() ?? ''
  const preset = m.remote ? presetForSpec(m.remote.api, m.remote.baseUrl).label.toLowerCase() : ''
  const host = m.remote ? remoteHostLabel(m.remote.api, m.remote.baseUrl).toLowerCase() : ''
  return (
    m.name.toLowerCase().includes(q) ||
    fam.includes(q) ||
    Boolean(m.quant?.toLowerCase().includes(q)) ||
    Boolean(m.info?.architecture?.toLowerCase().includes(q)) ||
    Boolean(m.info?.kind?.toLowerCase().includes(q)) ||
    Boolean(m.remote?.model.toLowerCase().includes(q)) ||
    preset.includes(q) ||
    host.includes(q)
  )
}

export function StatusControl() {
  const setView = useApp((s) => s.setView)
  const engine = useApp((s) => s.engine)
  const host = useModels((s) => s.host)
  const list = useModels((s) => s.list)
  const load = useModels((s) => s.load)
  const unload = useModels((s) => s.unload)
  const setFavourite = useModels((s) => s.setFavourite)
  const setFocus = useModels((s) => s.setFocus)
  const stats = useSystemStats()
  const [tab, setTab] = useState<'models' | 'system'>('models')
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<QuickScope>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [filterValues, setFilterValues] = useFilterValues('statusModels')
  const [facts, setFacts] = useState<ModelFacts | null>(null)

  const modelTone: Tone = host.status === 'ready' ? 'ok' : host.status === 'loading' ? 'busy' : host.status === 'error' ? 'error' : 'idle'
  const engineTone: Tone = engine.state === 'ready' ? 'ok' : engine.state === 'starting' ? 'busy' : 'error'
  const ram = stats ? stats.ramUsed / stats.ramTotal : null
  const vram = stats?.vramTotal ? (stats.vramUsed ?? 0) / stats.vramTotal : null
  const cpu = stats?.cpu === null || stats?.cpu === undefined ? null : stats.cpu / 100
  const tones = [meterTone(ram), meterTone(vram), meterTone(cpu)]
  const worst = tones.includes('hot') ? 'hot' : tones.includes('warm') ? 'warm' : null

  const loadedId = host.status === 'ready' ? host.modelId : null
  const label = host.status === 'loading'
    ? `Loading ${Math.round(host.progress * 100)}%`
    : host.status === 'error'
    ? 'Model error'
    : host.status === 'ready'
    ? modelName(list, host.modelId)
    : 'No model'

  useEffect(() => {
    if (host.status !== 'ready') {
      setFacts(null)
      return
    }
    const read = () => void ask('models.facts').then(setFacts).catch(noteFailure('model', 'Could not read the model facts', () => setFacts(null)))
    read()
    const timer = setInterval(read, 2000)
    return () => clearInterval(timer)
  }, [host.status, host.modelId])

  const info = list.find((m) => m.id === host.modelId)?.info ?? null
  const shape = info ? (info.experts ? `MoE, ${info.experts.used ?? '?'} of ${info.experts.count} experts active` : 'Dense') : null
  const server = facts?.server ?? null
  const last = server?.last ?? null
  const acceptance = last?.drafted ? Math.round(((last.accepted ?? 0) / last.drafted) * 100) : null

  const runnable = useMemo(() => list.filter(isRunnable), [list])
  const filters = useMemo(() => modelFilters(runnable, modelBytes), [runnable])
  const activeFilterCount = useMemo(
    () => filters.filter((f) => filterActive(f, filterValues)).length,
    [filters, filterValues]
  )

  const scopeCounts = useMemo(() => {
    let fav = 0
    let chat = 0
    let image = 0
    let remote = 0
    for (const m of runnable) {
      if (m.favourite) fav++
      if (m.remote) remote++
      if (isImageModel(m)) image++
      else if (m.remote || m.info?.kind === 'chat') chat++
    }
    return { all: runnable.length, favourites: fav, chat, image, remote }
  }, [runnable])

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase()
    const scoped = runnable.filter((m) => {
      if (scope === 'favourites' && !m.favourite) return false
      if (scope === 'remote' && !m.remote) return false
      if (scope === 'image' && !isImageModel(m)) return false
      if (scope === 'chat' && (isImageModel(m) || (!m.remote && m.info?.kind && m.info.kind !== 'chat'))) return false
      return matchesQuery(m, q)
    })
    const faceted = applyFilters(scoped, filters, filterValues).shown
    return sortModels(faceted, loadedId)
  }, [runnable, scope, query, filters, filterValues, loadedId])

  const openModelDetail = (id: string, close: () => void) => {
    setFocus(id)
    close()
    setView('models')
  }

  const toggleFav = (e: React.MouseEvent, m: ModelEntry) => {
    e.stopPropagation()
    void setFavourite(m.id, !m.favourite).catch(failed('Could not update favourite'))
  }

  const handlePickModel = (id: string, close: () => void) => {
    if (id === loadedId) return
    const target = list.find((m) => m.id === id)
    if (target?.remote) {
      toast.info('Remote models aren’t loaded', 'Give an agent this model in Agents, or open its details to configure it.')
      return
    }
    if (target && isImageModel(target)) {
      close()
      setView('image')
      return
    }
    load(id).catch(failed('Model load failed'))
  }

  return (
    <Popover
      side="top"
      align="end"
      className="w-[27rem] max-w-[calc(100vw-1rem)] gap-0 p-0 font-ui shadow-[0_0_30px_color-mix(in_srgb,var(--color-shade)_85%,transparent)] border border-line tone-bg-95 backdrop-blur-[calc(var(--panel-blur)*1.5)] select-none"
      trigger={
        <div
          className={cn(
            'flex h-7 items-center gap-2 border px-2 font-label text-[10.5px] caps-5 transition-colors cursor-pointer select-none phone:gap-1 phone:px-1.5',
            host.status === 'ready'
              ? 'border-accent/40 bg-accent/5 hover:border-accent text-ink'
              : host.status === 'loading'
              ? 'border-secondary-ink/40 bg-secondary-ink/5 hover:border-secondary-ink text-secondary-ink'
              : 'border-line/30 hover:border-line text-ink/80'
          )}
          aria-label="Model and engine status"
          title={`Model: ${host.status === 'ready' ? modelName(list, host.modelId) : label} · Engine: ${engine.state} · Click to manage models & telemetry`}
        >
          <Cpu className={cn('h-3.5 w-3.5 shrink-0', worst ? METER_TEXT[worst] : 'text-dim')} />
          <StatusDot tone={modelTone} />
          <StatusDot tone={engineTone} />
          <span className={cn('truncate max-w-44 tablet:max-w-20 phone:hidden', modelTone === 'error' || engineTone === 'error' ? 'text-alert' : modelTone === 'idle' ? 'text-faint' : 'text-ink/85')}>
            {engineTone === 'error' ? 'Engine down' : label}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 text-faint phone:hidden" />
        </div>
      }
    >
      {(close) => (
        <div className="flex flex-col">
          {/* Active Model Header */}
          <div className="flex flex-col gap-1.5 p-3 border-b border-line/60 tone-panel-40">
            <div className="flex items-start gap-2">
              <StatusDot tone={modelTone} className="mt-1.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="truncate text-[12.5px] font-bold text-ink caps-5 ">
                    {host.status === 'unloaded' ? 'No model loaded' : modelName(list, host.modelId)}
                  </div>
                  {host.modelId && (
                    <button
                      type="button"
                      title="Open this model's detail screen"
                      onClick={() => openModelDetail(host.modelId!, close)}
                      className="shrink-0 p-0.5 text-dim hover:text-accent cursor-pointer"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className={cn('text-[11px] truncate', host.error ? 'text-alert' : 'text-dim')}>
                  {host.error ?? (host.status === 'loading' ? `Loading ${Math.round(host.progress * 100)}%…` : host.contextSize ? `Context ${host.contextSize.toLocaleString()} tok${last ? ` · ${last.genTps?.toFixed(1) ?? '?'} tok/s` : ''}` : 'Select a runnable model below to load.')}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {loadedId && (
                  <button
                    type="button"
                    onClick={() => {
                      unload().catch(failed('Unload failed'))
                    }}
                    className="notch-sm border border-alert/50 bg-alert/10 px-2 py-0.5 text-[10px] font-label font-semibold caps-5 text-alert hover:bg-alert/20 cursor-pointer"
                  >
                    Unload
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    close()
                    setView('models')
                  }}
                  className="notch-sm border border-line/60 bg-ink/5 px-2 py-0.5 text-[10px] font-label font-semibold caps-5 text-dim hover:border-accent hover:text-ink cursor-pointer"
                >
                  Models
                </button>
              </div>
            </div>
            {host.status === 'loading' && <SegmentBar value={null} />}
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center border-b border-line/60 tone-panel-60 font-label text-[10.5px] font-bold caps-5 ">
            <button
              type="button"
              onClick={() => setTab('models')}
              className={cn(
                'flex-1 py-1.5 text-center transition-colors border-r border-line/40 cursor-pointer',
                tab === 'models' ? 'bg-accent/10 text-accent border-b-2 border-b-accent' : 'text-dim hover:text-ink hover:bg-ink/5'
              )}
            >
              Models ({runnable.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('system')}
              className={cn(
                'flex-1 py-1.5 text-center transition-colors cursor-pointer',
                tab === 'system' ? 'bg-accent/10 text-accent border-b-2 border-b-accent' : 'text-dim hover:text-ink hover:bg-ink/5'
              )}
            >
              Telemetry & Engine
            </button>
          </div>

          {/* Tab Content */}
          {tab === 'models' ? (
            <div className="flex flex-col">
              {/* Search & Filter Toggle */}
              <div className="flex items-center gap-1.5 border-b border-line/40 tone-well-50 px-2.5 py-1.5">
                <Search className="h-3 w-3 text-faint shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter name, family, quant, provider…"
                  className="h-6 min-w-0 flex-1 bg-transparent font-ui text-[11px] text-ink placeholder:text-faint focus:outline-none"
                />
                {query && (
                  <button type="button" title="Clear search" onClick={() => setQuery('')} className="p-0.5 text-faint hover:text-ink cursor-pointer">
                    <X className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  title="Toggle property filters (Family, Type, MTP, Quant, Size)"
                  onClick={() => setShowFilters((v) => !v)}
                  className={cn(
                    'flex h-6 items-center gap-1 border px-1.5 font-label text-[9.5px] font-bold caps-5 transition-colors cursor-pointer',
                    showFilters || activeFilterCount > 0
                      ? 'border-accent/60 bg-accent/15 text-accent'
                      : 'border-line/50 text-dim hover:border-line hover:text-ink'
                  )}
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  <span>Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
                </button>
              </div>

              {/* Quick Scope Pills */}
              <div className="flex flex-wrap items-center gap-1 border-b border-line/35 tone-panel-40 px-2.5 py-1.5">
                {(
                  [
                    { id: 'all', label: `All ${scopeCounts.all}` },
                    { id: 'favourites', label: `★ ${scopeCounts.favourites}` },
                    { id: 'chat', label: `Chat ${scopeCounts.chat}` },
                    { id: 'image', label: `Image ${scopeCounts.image}` },
                    { id: 'remote', label: `Remote ${scopeCounts.remote}` }
                  ] as const
                ).map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setScope(pill.id)}
                    className={cn(
                      'border px-1.5 py-0.5 font-label text-[9.5px] font-bold caps-5 transition-colors cursor-pointer',
                      scope === pill.id
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-line/40 tone-well-35 text-dim hover:border-line hover:text-ink'
                    )}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              {/* Full Property Filters (same as Installed Models view) */}
              {showFilters && (
                <div className="border-b border-line/40 tone-well-35 px-2.5 py-2">
                  <FilterBar filters={filters} values={filterValues} onChange={setFilterValues} />
                </div>
              )}

              <div className="max-h-72 overflow-y-auto divide-y divide-line/20">
                {filteredModels.length === 0 ? (
                  <div className="px-3 py-5 text-center font-ui text-[11.5px] text-dim">
                    {runnable.length === 0 ? 'No runnable models. Add a folder in Models.' : 'No models match these filters.'}
                  </div>
                ) : (
                  filteredModels.map((m) => {
                    const isLoaded = m.id === loadedId
                    const isImg = isImageModel(m)
                    const fam = entryFamily(m)
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          'group flex w-full items-center gap-1.5 px-2.5 py-1.5 font-ui transition-colors hover:bg-accent/10',
                          isLoaded && 'bg-ok/5'
                        )}
                      >
                        <button
                          type="button"
                          title={m.favourite ? 'Remove from favourites' : 'Add to favourites'}
                          onClick={(e) => toggleFav(e, m)}
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center transition-colors cursor-pointer',
                            m.favourite ? 'text-accent hover:text-accent/80' : 'text-faint/45 hover:text-accent'
                          )}
                        >
                          <Star className="h-3.5 w-3.5" fill={m.favourite ? 'currentColor' : 'none'} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePickModel(m.id, close)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <div title={m.name} className="truncate text-[12px] text-ink">
                              {m.name}
                            </div>
                            <div className="truncate text-[10px] text-faint">
                              {[fam, m.remote ? m.remote.model : m.info?.architecture].filter(Boolean).join(' · ') || (m.remote ? 'Remote' : 'Local')}
                            </div>
                          </div>
                          {m.quant && (
                            <span className="shrink-0 text-[10px] text-tint-purple">
                              {m.quant}
                            </span>
                          )}
                          {isImg ? (
                            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-secondary" />
                          ) : m.remote ? (
                            <Cloud className="h-3.5 w-3.5 shrink-0 text-accent" />
                          ) : (
                            <span className="shrink-0 text-[10px] text-faint">
                              {formatBytes(modelBytes(m))}
                            </span>
                          )}
                          {isLoaded && (
                            <span className="shrink-0 text-[10px] font-bold caps-5 text-ok">
                              [LOADED]
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          title={`Open ${m.name} details in Models`}
                          onClick={(e) => {
                            e.stopPropagation()
                            openModelDetail(m.id, close)
                          }}
                          className="flex h-6 w-6 shrink-0 items-center justify-center border border-transparent text-faint opacity-60 transition-all hover:border-line/60 hover:bg-ink/5 hover:text-accent group-hover:opacity-100 cursor-pointer"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
              {/* Telemetry Mini-Footer */}
              <div className="flex items-center justify-between border-t border-line/50 tone-panel-70 px-3 py-1.5 font-ui text-[10px] text-faint">
                <span>CPU {stats?.cpu === null || stats?.cpu === undefined ? '—' : `${stats.cpu}%`}</span>
                <span>RAM {stats ? `${gigabytes(stats.ramUsed)} / ${gigabytes(stats.ramTotal)} GB` : '—'}</span>
                {stats?.vramTotal ? <span>VRAM {gigabytes(stats.vramUsed ?? 0)} GB</span> : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-col max-h-80 overflow-y-auto">
              {server && (
                <Section title={`llama-server ${server.tag ?? ''}`}>
                  <Row label="Device" value={server.device ?? 'Not reported'} />
                  <Row label="GPU layers" value={server.offload ? `${server.offload.gpu} of ${server.offload.total} on GPU` : 'Not reported'} tone={server.offload && server.offload.gpu < server.offload.total ? 'warn' : undefined} />
                  <Row
                    label="MTP"
                    value={server.mtp ? (acceptance === null ? 'On, no drafts yet' : `On, ${acceptance}% of drafts accepted`) : info?.mtpLayers ? 'Off in this model\'s settings' : 'Off: this model has no MTP heads'}
                    tone={server.mtp && acceptance === null && last ? 'warn' : undefined}
                  />
                  <Row label="Vision" value={server.vision ? 'On' : 'Off: no vision adapter'} />
                  <Row label="Speed" value={last ? `${last.genTps?.toFixed(1) ?? '?'} tok/s write, ${last.promptTps?.toFixed(0) ?? '?'} tok/s read` : 'No reply yet'} />
                  {shape && <Row label="Shape" value={shape} />}
                </Section>
              )}
              <Section title="Engine">
                <div className="flex items-center gap-2 text-[12px]">
                  <StatusDot tone={engineTone} />
                  <span className={engineTone === 'error' ? 'text-alert' : 'text-ink/85'}>{engine.state}</span>
                  <span className="ml-auto font-ui text-[10.5px] text-faint">{engine.restarts} restart{engine.restarts === 1 ? '' : 's'} this run</span>
                </div>
              </Section>
              <Section title="System">
                {!stats ? (
                  <div className="font-ui text-[11px] text-dim">Reading…</div>
                ) : (
                  <>
                    <Meter label="CPU" value={cpu} text={stats.cpu === null ? '—' : `${stats.cpu}%`} />
                    <Meter label="RAM" value={ram} text={`${gigabytes(stats.ramUsed)} / ${gigabytes(stats.ramTotal)} GB`} note={`Seven's engine ${gigabytes(stats.engineRss)} GB`} />
                    {stats.vramTotal !== null ? <Meter label="VRAM" value={vram} text={`${gigabytes(stats.vramUsed ?? 0)} / ${gigabytes(stats.vramTotal)} GB`} /> : <Meter label="VRAM" value={null} text="—" note="Shows once a model has been loaded." />}
                  </>
                )}
              </Section>
            </div>
          )}
        </div>
      )}
    </Popover>
  )
}
