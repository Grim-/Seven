import { useEffect, useMemo, useState } from 'react'
import type { ChatMessage, StatsSummary, TurnStats } from '@shared/types'
import { engine } from '../../lib/ipc'
import { useSessions } from '../../store/sessions'
import { formatRelative } from '../../lib/format'
import { useConversation } from '../../lib/conversation'
import { noteFailure } from '../../store/problems'

const EMPTY: ChatMessage[] = []

const n1 = (v: number | null | undefined) => (typeof v === 'number' ? v.toFixed(1) : '—')
const secs = (ms: number | null | undefined) => (typeof ms === 'number' ? `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s` : '—')
const k = (v: number | null | undefined) => (typeof v === 'number' ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)) : '—')

function Head({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 font-label text-[10.5px] font-semibold caps-14 text-accent-soft">{children}</div>
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-line/40 tone-panel-40 px-2.5 py-2" title={hint}>
      <div className="font-label text-[9.5px] caps-14 text-faint">{label}</div>
      <div className="font-ui text-[15px] text-ink">{value}</div>
    </div>
  )
}

function genRate(s: TurnStats): number | null {
  return s.tokensPerSecond
}

export function StatsTab() {
  const { sessionId: activeId } = useConversation()
  const running = useSessions((s) => (activeId ? s.running[activeId] === true : false))
  const messages = useSessions((s) => (activeId ? (s.messages[activeId] ?? EMPTY) : EMPTY))
  const [summary, setSummary] = useState<StatsSummary | null>(null)

  useEffect(() => {
    if (running) return
    let live = true
    engine('stats.summary')
      .then((s) => live && setSummary(s))
      .catch(noteFailure('chat', 'Could not read the speed stats'))
    return () => {
      live = false
    }
  }, [running, activeId])

  const turns = useMemo(() => messages.filter((m) => m.role === 'assistant' && m.stats).map((m) => ({ id: m.id, at: m.createdAt, stats: m.stats as TurnStats })), [messages])
  const last = turns[turns.length - 1]?.stats
  const host = summary?.host

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
      <section>
        <Head>Loaded model</Head>
        {host?.modelId ? (
          <div className="grid grid-cols-2 gap-1.5">
            <div className="col-span-2 truncate font-ui text-[12px] text-ink" title={host.modelName ?? ''}>{host.modelName}</div>
            <Tile label="Context" value={k(host.contextSize)} />
            <Tile label="GPU layers" value={host.gpuLayers === null ? '—' : String(host.gpuLayers)} hint={`Layers offloaded to the GPU; the rest run on the CPU${host.totalLayers ? `. The model has ${host.totalLayers} layers.` : ''}`} />
          </div>
        ) : (
          <div className="text-[12px] text-faint">No model loaded.</div>
        )}
      </section>

      <section>
        <Head>Last reply in this chat</Head>
        {last ? (
          <div className="grid grid-cols-2 gap-1.5">
            <Tile label="Writing" value={`${n1(genRate(last))} t/s`} hint="Tokens per second while the model was writing, not counting tools or reading" />
            <Tile label="Reading" value={`${n1(last.promptPerSecond)} t/s`} hint="Prompt tokens per second while the model read input (only when enough was read to measure)" />
            <Tile label="First token" value={secs(last.ttftMs)} />
            <Tile label="Written" value={`${k(last.genTokens ?? last.outputTokens)} tok`} />
            <Tile label="Read" value={`${k(last.evalTokens ?? last.evaluatedTokens)} tok`} hint={`${k(last.reusedTokens)} more were reused from the cache`} />
            <Tile label="In tools" value={secs(last.toolMs)} hint={last.waitMs ? `Plus ${secs(last.waitMs)} waiting for you` : undefined} />
            <Tile label="Context" value={`${k(last.contextUsed)} / ${k(last.contextSize)}`} />
            {last.predictions && (
              <Tile
                label="Guessed ahead"
                value={last.predictions.checked ? `${Math.round((last.predictions.used / last.predictions.checked) * 100)}% right` : 'No guesses'}
                hint={`Prompt lookup: ${last.predictions.used} of ${last.predictions.checked} guessed tokens were right and saved a step each`}
              />
            )}
          </div>
        ) : (
          <div className="text-[12px] text-faint">No finished replies yet.</div>
        )}
      </section>

      {turns.length > 1 && (
        <section>
          <Head>This chat</Head>
          <table className="w-full font-ui text-[11px]">
            <thead className="text-faint">
              <tr>
                <th className="text-left font-normal">When</th>
                <th className="text-right font-normal">Write</th>
                <th className="text-right font-normal">Read</th>
                <th className="text-right font-normal">First</th>
                <th className="text-right font-normal">Tools</th>
              </tr>
            </thead>
            <tbody className="text-dim">
              {turns.slice(-10).reverse().map((t) => (
                <tr key={t.id}>
                  <td className="truncate pr-2">{formatRelative(t.at)}</td>
                  <td className="text-right text-ink">{n1(genRate(t.stats))}</td>
                  <td className="text-right">{n1(t.stats.promptPerSecond)}</td>
                  <td className="text-right">{secs(t.stats.ttftMs)}</td>
                  <td className="text-right">{secs(t.stats.toolMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <Head>Models compared</Head>
        {summary?.models.length ? (
          <div className="flex flex-col gap-1.5">
            {summary.models.map((m) => (
              <div key={`${m.modelId}-${m.contextSize}-${m.gpuLayers}`} className="border border-line/40 tone-panel-40 px-2.5 py-2">
                <div className="truncate font-ui text-[11.5px] text-ink" title={m.modelName}>{m.modelName}</div>
                <div className="mb-1 font-ui text-[10px] text-faint">
                  ctx {k(m.contextSize)} · GPU layers {m.gpuLayers ?? '—'} · {m.turns} repl{m.turns === 1 ? 'y' : 'ies'}
                </div>
                <div className="grid grid-cols-4 gap-1 font-ui text-[11px]">
                  <span title="Average writing speed">W {n1(m.genPerSecond)}</span>
                  <span title="Average reading speed">R {n1(m.promptPerSecond)}</span>
                  <span title="Average time to first token">F {secs(m.ttftMs)}</span>
                  <span title="Share of busy time spent in tools">T {m.toolShare === null ? '—' : `${Math.round(m.toolShare * 100)}%`}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-faint">Speeds are recorded from now on, per model, context size and GPU layers.</div>
        )}
      </section>
    </div>
  )
}
