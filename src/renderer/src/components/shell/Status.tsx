import { useEffect, useRef, useState } from 'react'
import { Cpu } from 'lucide-react'
import { METER_TEXT, Meter, SegmentBar, meterTone, type Tone } from '../ui'
import { cn } from '../../lib/cn'
import { useApp } from '../../store/app'
import { gigabytes, useSystemStats } from '../../lib/systemStats'
import { modelName, useModels } from '../../store/models'

const DOT: Record<Tone, string> = {
  ok: 'bg-ok shadow-[0_0_6px_var(--color-ok)]',
  busy: 'bg-cyan animate-pulse shadow-[0_0_6px_var(--color-cyan)]',
  warn: 'bg-accent',
  error: 'bg-alert shadow-[0_0_6px_var(--color-alert)]',
  idle: 'bg-faint'
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-line/40 px-3 py-2.5 first:border-t-0">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-soft">{title}</div>
      {children}
    </div>
  )
}

export function StatusControl() {
  const setView = useApp((s) => s.setView)
  const engine = useApp((s) => s.engine)
  const host = useModels((s) => s.host)
  const list = useModels((s) => s.list)
  const stats = useSystemStats()
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!pinned) return
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setPinned(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setPinned(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', key)
    }
  }, [pinned])

  const modelTone: Tone = host.status === 'ready' ? 'ok' : host.status === 'loading' ? 'busy' : host.status === 'error' ? 'error' : 'idle'
  const engineTone: Tone = engine.state === 'ready' ? 'ok' : engine.state === 'starting' ? 'busy' : 'error'
  const ram = stats ? stats.ramUsed / stats.ramTotal : null
  const vram = stats?.vramTotal ? (stats.vramUsed ?? 0) / stats.vramTotal : null
  const cpu = stats?.cpu === null || stats?.cpu === undefined ? null : stats.cpu / 100
  const tones = [meterTone(ram), meterTone(vram), meterTone(cpu)]
  const worst = tones.includes('hot') ? 'hot' : tones.includes('warm') ? 'warm' : null
  const label = host.status === 'loading' ? `Loading ${Math.round(host.progress * 100)}%` : host.status === 'error' ? 'Model error' : host.status === 'ready' ? 'Ready' : 'No model'
  const open = pinned || hover

  return (
    <div
      ref={box}
      className="relative flex items-center"
      onMouseEnter={() => {
        if (leave.current) clearTimeout(leave.current)
        setHover(true)
      }}
      onMouseLeave={() => {
        leave.current = setTimeout(() => setHover(false), 180)
      }}
    >
      <button
        onClick={() => setPinned(!pinned)}
        className={cn('flex h-7 items-center gap-2 border px-2 font-mono text-[10.5px] uppercase tracking-wider transition-colors', pinned ? 'border-accent/50 bg-accent/[0.05]' : 'border-line/30 hover:border-line')}
      >
        <Cpu className={cn('h-3.5 w-3.5', worst ? METER_TEXT[worst] : 'text-dim')} />
        <span className={cn('h-1.5 w-1.5 shrink-0', DOT[modelTone])} />
        <span className={cn('h-1.5 w-1.5 shrink-0', DOT[engineTone])} />
        <span className={cn(modelTone === 'error' || engineTone === 'error' ? 'text-alert' : modelTone === 'idle' ? 'text-faint' : 'text-white/80')}>{engineTone === 'error' ? 'Engine down' : label}</span>
      </button>
      {open && (
        <div className="absolute right-0 bottom-full z-50 mb-2 w-80 border border-line bg-bg/95 shadow-[0_0_24px_rgba(0,0,0,0.6)] backdrop-blur-sm">
          <Section title="Model">
            <div className="flex items-start gap-2">
              <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0', DOT[modelTone])} />
              <div className="min-w-0 flex-1">
                <div className="break-words text-[13px] text-white">{host.status === 'unloaded' ? 'No model loaded' : modelName(list, host.modelId)}</div>
                <div className={cn('text-[11.5px]', host.error ? 'text-alert' : 'text-dim')}>
                  {host.error ?? (host.status === 'loading' ? 'Loading…' : host.contextSize ? `Context ${host.contextSize.toLocaleString()} tokens` : 'Load one from the Models view.')}
                </div>
              </div>
              <button
                onClick={() => {
                  setPinned(false)
                  setHover(false)
                  setView('models')
                }}
                className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-soft hover:text-white"
              >
                Models
              </button>
            </div>
            {host.status === 'loading' && <SegmentBar value={host.progress} />}
          </Section>
          <Section title="Engine">
            <div className="flex items-center gap-2 text-[12.5px]">
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
  )
}
