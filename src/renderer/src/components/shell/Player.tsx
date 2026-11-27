import { useMemo } from 'react'
import { Pause, Play, SkipBack, SkipForward, Square } from 'lucide-react'
import { Select } from '../ui'
import { useData } from '../../store/data'
import { addToQueue, jump, next, pause, previous, resume, seek, stop, usePlayer } from '../../store/player'
import { cn } from '../../lib/cn'

function time(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function Controls({ size = 'h-3.5 w-3.5', buttonClass }: { size?: string; buttonClass?: string }) {
  const playing = usePlayer((s) => s.playing)
  const btn = cn('flex items-center justify-center text-dim hover:text-ink', buttonClass)
  return (
    <>
      <button title="Previous" onClick={previous} className={btn}>
        <SkipBack className={size} />
      </button>
      <button title={playing ? 'Pause' : 'Play'} onClick={playing ? pause : resume} className={cn(btn, 'text-accent')}>
        {playing ? <Pause className={size} /> : <Play className={size} />}
      </button>
      <button title="Next" onClick={next} className={btn}>
        <SkipForward className={size} />
      </button>
      <button title="Stop and clear" onClick={stop} className={btn}>
        <Square className={size} />
      </button>
    </>
  )
}

export function MiniPlayer({ layout = 'bar' }: { layout?: 'bar' | 'menu' }) {
  const current = usePlayer((s) => s.queue[s.index])
  if (!current) return null
  if (layout === 'menu') {
    return (
      <div className="flex flex-col gap-2">
        <div className="truncate text-[12px] normal-case text-ink" title={current.name}>
          {current.name}
        </div>
        <div className="flex items-center gap-2">
          <Controls size="h-4 w-4" buttonClass="h-9 flex-1 border border-line/40 hover:border-line" />
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5 normal-case">
      <span className="max-w-40 truncate text-ink/80" title={current.name}>
        {current.name}
      </span>
      <Controls size="h-3 w-3" />
    </div>
  )
}

export function PlayerGlance() {
  const { queue, index, position, duration } = usePlayer()
  const assets = useData((s) => s.assets)
  const audio = useMemo(() => assets.filter((a) => a.kind === 'audio'), [assets])
  const current = queue[index]
  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="min-w-0">
        <div className="truncate text-[15px] font-semibold text-ink">{current?.name ?? 'Nothing playing'}</div>
        <div className="font-ui text-[10.5px] text-faint">{current ? `${index + 1} of ${queue.length}` : `${audio.length} audio files · add tracks or play audio from Data`}</div>
      </div>
      {current && (
        <div className="flex items-center gap-2 font-ui text-[10.5px] text-dim">
          <span>{time(position)}</span>
          <input type="range" min={0} max={Math.max(1, duration)} step={1} value={Math.min(position, duration)} onChange={(e) => seek(Number(e.target.value))} className="h-1 flex-1 cursor-pointer appearance-none bg-line accent-[var(--color-accent)]" />
          <span>{time(duration)}</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Controls size="h-4 w-4" />
        <Select
          value=""
          options={[{ value: '', label: 'Add from library…' }, ...audio.map((a) => ({ value: a.id, label: a.name }))]}
          onChange={(id) => id && addToQueue([id])}
          className="ml-auto h-7 w-44 text-[11.5px]"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {queue.map((t, i) => (
          <button key={`${t.id}${i}`} onClick={() => jump(i)} className={cn('flex w-full items-center gap-2 border-l-2 px-2 py-1 text-left text-[12.5px]', i === index ? 'border-l-accent bg-accent/10 text-ink' : 'border-l-transparent text-ink/75 hover:bg-ink/[0.03]')}>
            <span className="w-5 shrink-0 font-data text-[10px] text-faint">{i + 1}</span>
            <span className="truncate">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
