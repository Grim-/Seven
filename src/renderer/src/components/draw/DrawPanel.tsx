import { useMemo, useState } from 'react'
import { Shuffle, X } from 'lucide-react'
import { showName } from '@shared/ids'
import { Button, CountStepper, Eyebrow, FaceGrid, Select, enterStyle } from '../ui'
import { DrawnFace } from './DrawnFace'
import { useDrawSources } from './useDrawSources'
import { engine } from '../../lib/ipc'
import { entryLink } from '../../store/data'
import { useBusy } from '../../lib/useBusy'
import { useViewPlace } from '../../lib/viewPlace'
import { useEscapeLayer } from '../../lib/escape'
import { cn } from '../../lib/cn'

export interface Drawn {
  value: string
  from: string
}

export function DrawPanel({ onUse, onClose, className }: { onUse: (picked: Drawn[]) => void; onClose: () => void; className?: string }) {
  const sources = useDrawSources()
  const [place, setPlace] = useViewPlace('draw', { source: '', count: 3 })
  const [results, setResults] = useState<Drawn[] | null>(null)
  const [busy, run] = useBusy()
  const [round, setRound] = useState(0)
  useEscapeLayer(true, onClose)
  const options = useMemo(() => (sources ?? []).map((h) => ({ value: `${h.kind}/${h.id}`, label: `${showName(h.title)} · ${h.kind}` })), [sources])
  const source = (sources ?? []).find((h) => `${h.kind}/${h.id}` === place.source) ?? sources?.[0] ?? null
  const draw = () => {
    if (!source) return
    void run(async () => {
      const values = await engine('library.draw', { entry: entryLink(source.kind, source.id), count: place.count })
      setRound((n) => n + 1)
      setResults(values.map((value) => ({ value, from: showName(source.title) })))
    }, 'Could not draw')
  }
  return (
    <div data-layer className={cn('notch border border-accent bg-bg/[0.97] shadow-[0_0_30px_rgba(0,0,0,0.8),0_0_18px_color-mix(in_srgb,var(--color-accent)_12%,transparent)]', className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-2.5 py-2">
        <Eyebrow>Draw from</Eyebrow>
        {sources === null ? (
          <span className="font-mono text-[11px] text-dim">Looking…</span>
        ) : options.length ? (
          <Select value={source ? `${source.kind}/${source.id}` : ''} options={options} onChange={(v) => setPlace({ ...place, source: v })} className="h-7 max-w-64 text-[12px]" />
        ) : (
          <span className="text-[12px] text-dim">Nothing to draw from yet. Make a repo or a deck first.</span>
        )}
        <CountStepper value={place.count} min={1} onChange={(count) => setPlace({ ...place, count })} />
        <span className="flex-1" />
        <Button size="sm" variant="primary" icon={<Shuffle />} disabled={!source || busy} onClick={draw}>
          {results ? 'Redraw' : 'Draw'}
        </Button>
        {results && results.length > 1 && (
          <Button size="sm" variant="badge" onClick={() => onUse(results)}>
            Keep all
          </Button>
        )}
        <button type="button" title="Close (Esc)" onClick={onClose} className="p-1 text-dim hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      {results && (
        <div className="max-h-[50vh] overflow-y-auto p-3">
          <FaceGrid>
            {results.map((r, i) => (
              <button key={`${round}-${i}`} type="button" title="Use this" onClick={() => onUse([r])} style={enterStyle(i)} className="draw-flip block min-w-0 text-left transition-transform hover:-translate-y-1">
                <DrawnFace value={r.value} from={r.from} />
              </button>
            ))}
          </FaceGrid>
        </div>
      )}
    </div>
  )
}
