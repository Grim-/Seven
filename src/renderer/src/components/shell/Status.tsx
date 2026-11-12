import { useEffect, useMemo, useState } from 'react'
import { Cpu, Cloud, Star, ChevronDown, Search } from 'lucide-react'
import { METER_TEXT, Meter, SegmentBar, meterTone, type Tone, Popover } from '../ui'
import { cn } from '../../lib/cn'
import { useApp } from '../../store/app'
import { gigabytes, useSystemStats } from '../../lib/systemStats'
import { isRunnable, modelName, sortModels, useModels } from '../../store/models'
import { engine as ask } from '../../lib/ipc'
import type { ModelFacts } from '@shared/types'
import { toast } from '../../store/toasts'
import { failed } from '../../lib/notify'
import { formatBytes } from '../../lib/format'

const DOT: Record<Tone, string> = {
  ok: 'bg-ok shadow-[0_0_6px_var(--color-ok)]',
  busy: 'bg-cyan animate-pulse shadow-[0_0_6px_var(--color-cyan)]',
  warn: 'bg-accent',
  error: 'bg-alert shadow-[0_0_6px_var(--color-alert)]',
  idle: 'bg-faint'
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-line/40 px-3 py-2.5 first:border-t-0 font-mono">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-soft">{title}</div>
      {children}
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="flex items-baseline gap-3 text-[12px] font-mono">
      <span className="w-20 shrink-0 text-[10.5px] uppercase tracking-wider text-faint">{label}</span>
      <span className={cn('min-w-0 break-words', tone === 'warn' ? 'text-accent' : 'text-white/85')}>{value}</span>
    </div>
  )
}

export function StatusControl() {
  const setView = useApp((s) => s.setView)
  const engine = useApp((s) => s.engine)
  const host = useModels((s) => s.host)
  const list = useModels((s) => s.list)
  const load = useModels((s) => s.load)
  const unload = useModels((s) => s.unload)
  const stats = useSystemStats()
  const [tab, setTab] = useState<'models' | 'system'>('models')
  const [query, setQuery] = useState('')
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
    const read = () => void ask('models.facts').then(setFacts).catch(() => setFacts(null))
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
  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q ? runnable.filter((m) => m.name.toLowerCase().includes(q) || (m.quant && m.quant.toLowerCase().includes(q))) : runnable
    return sortModels(base, loadedId)
  }, [runnable, query, loadedId])

  const handlePickModel = (id: string) => {
    if (id === loadedId) return
    const target = list.find((m) => m.id === id)
    if (target?.remote) {
      toast.info('Remote models aren’t loaded', 'Give an agent this model in Agents; that agent uses it when it replies.')
      return
    }
    load(id).catch(failed('Model load failed'))
  }

  return (
    <Popover
      side="top"
      align="end"
      className="w-96 max-w-[calc(100vw-1rem)] gap-0 p-0 font-mono shadow-[0_0_30px_rgba(0,0,0,0.85)] border border-line bg-bg/95 backdrop-blur-md select-none"
      trigger={
        <div
          className={cn(
            'flex h-7 items-center gap-2 border px-2 font-mono text-[10.5px] uppercase tracking-wider transition-colors cursor-pointer select-none phone:gap-1 phone:px-1.5',
            host.status === 'ready'
              ? 'border-accent/40 bg-accent/5 hover:border-accent text-white'
              : host.status === 'loading'
              ? 'border-cyan/40 bg-cyan/5 hover:border-cyan text-cyan'
              : 'border-line/30 hover:border-line text-white/80'
          )}
          aria-label="Model and engine status"
          title={`Model: ${host.status === 'ready' ? modelName(list, host.modelId) : label} · Engine: ${engine.state} · Click to manage models & telemetry`}
        >
          <Cpu className={cn('h-3.5 w-3.5 shrink-0', worst ? METER_TEXT[worst] : 'text-dim')} />
          <span className={cn('h-1.5 w-1.5 shrink-0', DOT[modelTone])} />
          <span className={cn('h-1.5 w-1.5 shrink-0', DOT[engineTone])} />
          <span className={cn('truncate max-w-44 tablet:max-w-20 phone:hidden', modelTone === 'error' || engineTone === 'error' ? 'text-alert' : modelTone === 'idle' ? 'text-faint' : 'text-white/85')}>
            {engineTone === 'error' ? 'Engine down' : label}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 text-faint phone:hidden" />
        </div>
      }
    >
      {(close) => (
        <div className="flex flex-col">
          {/* Active Model Header */}
          <div className="flex flex-col gap-1.5 p-3 border-b border-line/60 bg-black/40">
            <div className="flex items-start gap-2">
              <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0', DOT[modelTone])} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-bold text-white uppercase tracking-wider">
                  {host.status === 'unloaded' ? 'No model loaded' : modelName(list, host.modelId)}
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
                    className="notch-sm border border-alert/50 bg-alert/10 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-alert hover:bg-alert/20"
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
                  className="notch-sm border border-line/60 bg-white/5 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-dim hover:border-accent hover:text-white"
                >
                  Models View
                </button>
              </div>
            </div>
            {host.status === 'loading' && <SegmentBar value={null} />}
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center border-b border-line/60 bg-black/60 font-mono text-[10.5px] font-bold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setTab('models')}
              className={cn(
                'flex-1 py-1.5 text-center transition-colors border-r border-line/40',
                tab === 'models' ? 'bg-accent/10 text-accent border-b-2 border-b-accent' : 'text-dim hover:text-white hover:bg-white/5'
              )}
            >
              Models ({runnable.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('system')}
              className={cn(
                'flex-1 py-1.5 text-center transition-colors',
                tab === 'system' ? 'bg-accent/10 text-accent border-b-2 border-b-accent' : 'text-dim hover:text-white hover:bg-white/5'
              )}
            >
              Telemetry & Engine
            </button>
          </div>

          {/* Tab Content */}
          {tab === 'models' ? (
            <div className="flex flex-col">
              {runnable.length > 5 && (
                <div className="flex items-center gap-2 border-b border-line/40 bg-black/50 px-2.5 py-1.5">
                  <Search className="h-3 w-3 text-faint shrink-0" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="FILTER MODELS..."
                    className="h-6 w-full bg-transparent font-mono text-[11px] text-white placeholder:text-faint focus:outline-none"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery('')} className="text-[10px] text-faint hover:text-white uppercase font-mono">
                      CLEAR
                    </button>
                  )}
                </div>
              )}
              <div className="max-h-72 overflow-y-auto divide-y divide-line/20">
                {filteredModels.length === 0 ? (
                  <div className="px-3 py-4 text-center font-mono text-[11.5px] text-dim">
                    {runnable.length === 0 ? 'No runnable models. Add a folder in Models.' : 'No matching models.'}
                  </div>
                ) : (
                  filteredModels.map((m) => {
                    const isLoaded = m.id === loadedId
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handlePickModel(m.id)}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-2 text-left font-mono transition-colors hover:bg-accent/10',
                          isLoaded && 'bg-ok/5'
                        )}
                      >
                        <Star
                          className={cn('h-3.5 w-3.5 shrink-0', m.favourite ? 'text-accent' : 'text-transparent')}
                          fill={m.favourite ? 'currentColor' : 'none'}
                        />
                        <span title={m.name} className="min-w-0 flex-1 truncate text-[12px] text-white">
                          {m.name}
                        </span>
                        {m.quant && (
                          <span className="shrink-0 text-[10px] text-purple">
                            {m.quant}
                          </span>
                        )}
                        {m.remote ? (
                          <Cloud className="h-3.5 w-3.5 shrink-0 text-accent" />
                        ) : (
                          <span className="shrink-0 text-[10px] text-faint">
                            {formatBytes(m.sizeBytes)}
                          </span>
                        )}
                        {isLoaded && (
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-ok">
                            [LOADED]
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
              {/* Telemetry Mini-Footer */}
              <div className="flex items-center justify-between border-t border-line/50 bg-black/70 px-3 py-1.5 font-mono text-[10px] text-faint">
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
                  <span className={cn('h-1.5 w-1.5 shrink-0', DOT[engineTone])} />
                  <span className={engineTone === 'error' ? 'text-alert' : 'text-white/85'}>{engine.state}</span>
                  <span className="ml-auto font-mono text-[10.5px] text-faint">{engine.restarts} restart{engine.restarts === 1 ? '' : 's'} this run</span>
                </div>
              </Section>
              <Section title="System">
                {!stats ? (
                  <div className="font-mono text-[11px] text-dim">Reading…</div>
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
