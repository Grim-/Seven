import { useEffect, useState } from 'react'
import { HardDriveDownload, Layers, Lock, LockOpen, RefreshCw, Square } from 'lucide-react'
import { DEFAULT_CONTEXT, type ChatMessage, type ContextSettings, type ContextUsage, type ModelFacts } from '@shared/types'
import { Button, Modal, Tooltip } from '../ui'
import { draftOf, useSessions } from '../../store/sessions'
import { useAgentIdOf, useConversation } from '../../lib/conversation'
import { useModels } from '../../store/models'
import { useAgents } from '../../store/agents'
import { useVault } from '../../store/vault'
import { toast } from '../../store/toasts'
import { engine, on } from '../../lib/ipc'
import { formatBytes } from '../../lib/format'
import { cn } from '../../lib/cn'
import { failed } from '../../lib/notify'
import { noteFailure } from '../../store/problems'

const EMPTY: ChatMessage[] = []
type CacheState = 'building' | 'saving' | 'restoring' | 'idle'

const CACHE_LABEL = new Map<CacheState, string>([
  ['building', 'Building cache…'],
  ['saving', 'Saving cache…'],
  ['restoring', 'Restoring cache…']
])

function useCacheState(sessionId: string | null): CacheState {
  const [state, setState] = useState<CacheState>('idle')
  useEffect(() => {
    setState('idle')
    if (!sessionId) return
    return on('cache.state', (e) => {
      if (e.sessionId === sessionId) setState(e.state)
    })
  }, [sessionId])
  return state
}

function k(n: number): string {
  return n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function seconds(ms: number | null): string {
  return ms === null ? '—' : ms >= 10000 ? `${Math.round(ms / 1000)}s` : `${(ms / 1000).toFixed(1)}s`
}

export function useContextSettings(): ContextSettings {
  const agentId = useAgentIdOf(useConversation())
  const context = useAgents((s) => s.list.find((a) => a.id === agentId)?.context)
  return context ?? DEFAULT_CONTEXT
}

function tone(fraction: number, ctx: ContextSettings): string {
  return fraction >= ctx.summaryAt ? 'text-alert' : fraction >= ctx.trimAt ? 'text-accent' : 'text-secondary'
}

function Bar({ usage, height = 'h-1.5' }: { usage: ContextUsage; height?: string }) {
  const ctx = useContextSettings()
  const pct = (n: number) => `${Math.min(100, (n / usage.size) * 100)}%`
  return (
    <div className={cn('relative w-full overflow-hidden bg-ink/[0.06]', height)}>
      <div className="segment-mask absolute inset-y-0 left-0 flex" style={{ width: pct(usage.used) }}>
        <div className="h-full bg-tint-purple/70" style={{ width: `${(usage.fixed / Math.max(1, usage.used)) * 100}%` }} />
        <div className="h-full bg-accent/70" style={{ width: `${(usage.history / Math.max(1, usage.used)) * 100}%` }} />
        <div className="h-full flex-1 bg-secondary-ink/70" />
      </div>
      <div className="absolute inset-y-0 w-px bg-accent" style={{ left: `${ctx.trimAt * 100}%` }} />
      <div className="absolute inset-y-0 w-px bg-alert" style={{ left: `${ctx.summaryAt * 100}%` }} />
    </div>
  )
}

function Inspector({ sessionId, usage, cacheState, onClose }: { sessionId: string | null; usage: ContextUsage | null; cacheState: CacheState; onClose: () => void }) {
  const messages = useSessions((s) => (sessionId ? (s.messages[sessionId] ?? EMPTY) : EMPTY))
  const ctx = useContextSettings()
  const summaries = useSessions((s) => (sessionId ? (s.summaries[sessionId]?.length ?? 0) : 0))
  const busy = useSessions((s) => (sessionId ? s.running[sessionId] === true || s.compacting[sessionId] === true : true))
  const compact = useSessions((s) => s.compact)
  const loaded = useModels((s) => s.host.status === 'ready')
  const vaultConfigured = useVault((s) => s.status.configured)
  const [savingCache, setSavingCache] = useState(false)
  const [facts, setFacts] = useState<ModelFacts | null | undefined>(undefined)
  useEffect(() => {
    engine('models.facts')
      .then(setFacts)
      .catch(noteFailure('model', 'Could not read the model facts', () => setFacts(null)))
  }, [])
  const turns = messages.filter((m) => m.role === 'assistant' && m.stats)
  return (
    <Modal open title="Context" onClose={onClose}>
      <div className="flex max-h-[66vh] flex-col gap-4 overflow-y-auto pr-1 font-ui text-[12px]">
        {usage && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <span className="text-dim">In use</span>
              <span className={tone(usage.used / usage.size, ctx)}>
                {usage.used.toLocaleString()} / {usage.size.toLocaleString()} tokens ({Math.round((usage.used / usage.size) * 100)}%)
              </span>
            </div>
            <Bar usage={usage} height="h-2" />
            <div className="flex gap-4 text-[11px]">
              <span><span className="text-tint-purple">■</span> instructions + tools {k(usage.fixed)}</span>
              <span><span className="text-accent">■</span> history {k(usage.history)}</span>
              <span><span className="text-secondary-ink">■</span> last turn {k(usage.turn)}</span>
            </div>
            <div className="text-[11px] text-dim">
              Old tool output is trimmed above {Math.round(ctx.trimAt * 100)}% (last {ctx.keepTurns} turns kept); a summary is {ctx.autoSummary ? 'written' : 'offered'} above{' '}
              {Math.round(ctx.summaryAt * 100)}%.{summaries ? ` ${summaries} summar${summaries > 1 ? 'ies' : 'y'} so far.` : ''}
            </div>
          </div>
        )}
        {sessionId && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="secondary"
              icon={<Layers />}
              disabled={busy}
              onClick={() => {
                onClose()
                void compact(sessionId).catch(failed('Could not summarise'))
              }}
            >
              Compact now
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<HardDriveDownload />}
              disabled={busy || savingCache || !loaded}
              onClick={() => {
                setSavingCache(true)
                void engine('sessions.saveCache', { id: sessionId })
                  .then((ok) => (ok ? toast.success('Cache saved to disk', vaultConfigured ? 'Encrypted with your vault key.' : 'Saved unencrypted.') : toast.info('Nothing to save', 'No active local model cache for this chat yet.')))
                  .catch(failed('Could not save cache'))
                  .finally(() => setSavingCache(false))
              }}
            >
              {savingCache || cacheState === 'saving' ? 'Saving cache…' : 'Save cache to disk'}
            </Button>
            <span className="inline-flex items-center gap-1 text-[11px] text-dim">
              {vaultConfigured ? <Lock className="h-3 w-3 text-ok" /> : <LockOpen className="h-3 w-3 text-faint" />}
              {vaultConfigured ? 'Saved cache encrypted with vault' : 'Vault not set up (unencrypted)'}
            </span>
          </div>
        )}
        <div>
          <div className="mb-1 text-[10.5px] caps-14 text-accent-soft">Model</div>
          {facts === undefined ? (
            <span className="text-dim">Loading…</span>
          ) : facts === null ? (
            <span className="text-dim">No model loaded.</span>
          ) : (
            <div className="grid grid-cols-[170px_1fr] gap-y-0.5">
              <span className="text-faint">Chat format</span>
              <span className="text-ink/90">{facts.wrapper}</span>
              <span className="text-faint">Context</span>
              <span className="text-ink/90">
                {facts.contextSize.toLocaleString()} (trained on {facts.trainContextSize.toLocaleString()})
              </span>
              <span className="text-faint">Sliding window</span>
              <span className="text-ink/90">{facts.swaSize ? `${facts.swaSize.toLocaleString()} tokens` : 'none'}</span>
              <span className="text-faint">Cache checkpoints</span>
              <span className="text-ink/90">{facts.needsCheckpoints ? `used (${formatBytes(facts.checkpointMemory)} in RAM)` : 'not needed'}</span>
            </div>
          )}
        </div>
        <div>
          <div className="mb-1 text-[10.5px] caps-14 text-accent-soft">Turns</div>
          {turns.length === 0 ? (
            <span className="text-dim">No measured turns in this chat yet.</span>
          ) : (
            <table className="w-full text-left">
              <thead className="text-[10px] caps-5 text-faint">
                <tr>
                  <th className="py-1 pr-2">#</th>
                  <th className="pr-2">Prompt</th>
                  <th className="pr-2">Reused</th>
                  <th className="pr-2">Read</th>
                  <th className="pr-2">First token</th>
                  <th className="pr-2">Out</th>
                  <th>Speed</th>
                </tr>
              </thead>
              <tbody>
                {turns.map((m, i) => {
                  const st = m.stats!
                  const reusedPct = st.promptTokens ? Math.round((st.reusedTokens / st.promptTokens) * 100) : 0
                  return (
                    <tr key={m.id} className="border-t border-line/20 text-ink/90">
                      <td className="py-1 pr-2 text-faint">{i + 1}</td>
                      <td className="pr-2">{k(st.promptTokens)}</td>
                      <td className={cn('pr-2', reusedPct >= 80 ? 'text-ok' : reusedPct >= 40 ? 'text-accent' : 'text-alert')}>{reusedPct}%</td>
                      <td className="pr-2">{k(st.evaluatedTokens)}</td>
                      <td className="pr-2">{seconds(st.ttftMs)}</td>
                      <td className="pr-2">{k(st.outputTokens)}</td>
                      <td>{st.tokensPerSecond !== null ? `${st.tokensPerSecond} t/s` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  )
}

export function ContextMeter({ compact = false }: { compact?: boolean }) {
  const conv = useConversation()
  const activeId = conv.sessionId
  const usage = useSessions((s) => (activeId ? (s.usage[activeId] ?? null) : draftOf(s, conv.key).usage))
  const loaded = useModels((s) => s.host.status === 'ready')
  const [open, setOpen] = useState(false)
  const ctx = useContextSettings()
  const cacheState = useCacheState(activeId)
  const cacheLabel = CACHE_LABEL.get(cacheState)
  const fraction = usage ? usage.used / usage.size : 0
  const body = usage
    ? `${usage.used.toLocaleString()} of ${usage.size.toLocaleString()} tokens. Instructions and tools ${k(usage.fixed)}, history ${k(usage.history)}, last turn ${k(usage.turn)}. Click for details.`
    : loaded
      ? 'Not measured yet. Click for details.'
      : 'No model loaded, so nothing to measure yet.'
  return (
    <>
      <Tooltip title="Context" side="bottom" body={cacheLabel ? `${cacheLabel} ${body}` : body}>
        <button onClick={() => setOpen(true)} className={cn('flex flex-col items-stretch gap-1', compact ? 'w-20' : 'w-28', !loaded && 'opacity-60')}>
          <span className={cn('flex justify-between font-label text-[10px] caps-5 ', cacheLabel ? 'text-accent' : usage ? tone(fraction, ctx) : 'text-dim')}>
            <span className="inline-flex items-center gap-1">
              {cacheLabel && <span className="h-1.5 w-1.5 animate-pulse bg-accent" />}
              <span>{cacheLabel ?? 'ctx'}</span>
            </span>
            <span>{usage ? `${k(usage.used)}/${k(usage.size)}` : '—'}</span>
          </span>
          {usage ? <Bar usage={usage} /> : <div className="h-1.5 w-full bg-ink/[0.06]" />}
        </button>
      </Tooltip>
      {open && <Inspector sessionId={activeId} usage={usage} cacheState={cacheState} onClose={() => setOpen(false)} />}
    </>
  )
}

export function InstructionsBanner() {
  const { sessionId: activeId } = useConversation()
  const changed = useSessions((s) => (activeId ? s.instructionsChanged[activeId] === true : false))
  const running = useSessions((s) => (activeId ? s.running[activeId] === true : false))
  const refresh = useSessions((s) => s.refreshInstructions)
  if (!activeId || !changed) return null
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-accent/40 bg-accent/[0.06] px-3.5 py-1.5 text-[12.5px] text-ink/90">
      <span className="min-w-0 flex-1">The agent's instructions or tools changed since this chat started. This chat keeps the old ones until you refresh, which re-reads the chat once.</span>
      <Button
        size="sm"
        variant="secondary"
        icon={<RefreshCw />}
        disabled={running}
        onClick={() => void refresh(activeId).catch(failed('Could not refresh'))}
      >
        Refresh
      </Button>
    </div>
  )
}

export function SummaryCard() {
  const { sessionId: activeId } = useConversation()
  const usage = useSessions((s) => (activeId ? (s.usage[activeId] ?? null) : null))
  const running = useSessions((s) => (activeId ? s.running[activeId] === true : false))
  const compacting = useSessions((s) => (activeId ? s.compacting[activeId] === true : false))
  const compact = useSessions((s) => s.compact)
  const ctx = useContextSettings()
  const [dismissed, setDismissed] = useState<Record<string, number>>({})
  if (!activeId) return null
  if (compacting) {
    return (
      <div className="flex shrink-0 items-center gap-3 border-t border-accent/40 bg-accent/[0.06] px-3.5 py-2 text-[12.5px] text-ink/90">
        <span className="h-1.5 w-1.5 animate-pulse bg-accent" />
        <span className="min-w-0 flex-1">Summarising the oldest turns for the model…</span>
        <Button size="sm" variant="ghost" icon={<Square />} onClick={() => void engine('sessions.abort', { id: activeId }).catch(failed('Could not stop it'))}>
          Stop
        </Button>
      </div>
    )
  }
  if (!usage || running || ctx.autoSummary) return null
  const fraction = usage.used / usage.size
  const hiddenAt = dismissed[activeId]
  if (fraction < ctx.summaryAt || (hiddenAt !== undefined && fraction < hiddenAt + 0.05)) return null
  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-alert/40 bg-alert/[0.06] px-3.5 py-2 text-[12.5px] text-ink/90">
      <span className="min-w-0 flex-1">
        Context is {Math.round(fraction * 100)}% full. Summarise the oldest turns? The model gets a summary instead; the chat here keeps everything.
      </span>
      <Button size="sm" variant="ghost" onClick={() => setDismissed({ ...dismissed, [activeId]: fraction })}>
        Not now
      </Button>
      <Button size="sm" variant="secondary" icon={<Layers />} onClick={() => void compact(activeId).catch(failed('Could not summarise'))}>
        Summarise
      </Button>
    </div>
  )
}
