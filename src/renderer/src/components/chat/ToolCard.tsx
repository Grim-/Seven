import { useState } from 'react'
import { Brain, ChevronRight, Copy, CircleAlert, CircleCheck, CircleSlash, LoaderCircle, MessageCircleQuestion, Pencil, ShieldX } from 'lucide-react'
import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import type { ToolPart } from '@shared/types'
import { cn } from '../../lib/cn'
import { LinkTextarea } from '../data/LinkTextarea'
import { Button, openMenu } from '../ui'
import { engine } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { errorText } from '../../lib/format'
import { LIVE_VIEWS, TerminalOutput, ViewRenderer } from '../../registries/views'
import { useSessions } from '../../store/sessions'
import { UiRequestCard } from '../../registries/ui-requests'
import { PresentationPart, isPresentation } from '../../registries/presentations'
import { useRoleplay } from './agentContext'
import { copyText } from '../../lib/notify'
import { useConversation } from '../../lib/conversation'
import { useThreadLook } from './threadLook'
import { Trace, partTone } from './Trace'
import { skinSurface } from '../skins/skinSurface'

function seconds(part: ToolPart): string | undefined {
  return part.durationMs === undefined ? undefined : `${(part.durationMs / 1000).toFixed(1)}s`
}

function summary(part: ToolPart): string {
  const a = part.args
  const pick = ['command', 'path', 'pattern', 'question', 'collection', 'title', 'name'].map((k) => a[k]).find((v) => typeof v === 'string' && v)
  if (typeof pick === 'string') return pick
  if (Array.isArray(a.paths)) return a.paths.filter((p) => typeof p === 'string').join(', ')
  const json = JSON.stringify(a)
  return json === '{}' ? '' : json.length > 90 ? `${json.slice(0, 87)}...` : json
}

function sentEntries(args: Record<string, unknown>): [string, string][] {
  return Object.entries(args)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v, null, 2)])
}

function Sent({ entries }: { entries: [string, string][] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-label text-[10px] font-semibold caps-16 text-accent-soft">Sent</div>
      {entries.map(([key, text]) =>
        text.includes('\n') || text.length > 90 ? (
          <div key={key} className="flex flex-col gap-0.5">
            <span className="font-mono text-[11px] text-faint">{key}</span>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-l-2 border-line/50 pl-2 font-mono text-[12px] text-ink/85">{text}</pre>
          </div>
        ) : (
          <div key={key} className="flex gap-2 font-mono text-[12px]">
            <span className="shrink-0 text-faint">{key}</span>
            <span className="min-w-0 whitespace-pre-wrap break-words text-ink/85">{text}</span>
          </div>
        )
      )}
    </div>
  )
}

function StatusIcon({ part }: { part: ToolPart }) {
  if (part.ui?.status === 'pending') return <MessageCircleQuestion className="h-4 w-4 animate-pulse text-accent" />
  if (part.status === 'running') return <LoaderCircle className="h-4 w-4 animate-spin text-secondary-ink" />
  if (part.status === 'error') return <CircleAlert className="h-4 w-4 text-alert" />
  if (part.status === 'blocked') return <ShieldX className="h-4 w-4 text-alert" />
  if (part.status === 'cancelled') return <CircleSlash className="h-4 w-4 text-faint" />
  return <CircleCheck className="h-4 w-4 text-ok" />
}

function ReasonCard({ part }: { part: ToolPart }) {
  const t = (part.view?.data ?? {}) as { style?: string | null; question?: string; reasoning?: string; conclusion?: string }
  const [open, setOpen] = useState<boolean | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const look = useThreadLook()
  const { sessionId } = useConversation()
  const messageId = useSessions((s) => (sessionId ? (s.messages[sessionId]?.find((m) => m.parts.some((p) => p.type === 'tool' && p.id === part.id))?.id ?? null) : null))
  const busy = useSessions((s) => Boolean(sessionId && s.running[sessionId]))
  const where = sessionId && messageId ? { sessionId, messageId, busy } : null
  const expanded = open ?? !look.foldTools
  const conclusion = part.result ?? t.conclusion ?? ''
  const save = async () => {
    if (!where || draft === null) return
    setSaving(true)
    try {
      await engine('sessions.editResult', { id: where.sessionId, messageId: where.messageId, partId: part.id, text: draft.trim() })
      setDraft(null)
    } catch (err) {
      toast.error('Could not change it', errorText(err))
    } finally {
      setSaving(false)
    }
  }
  if (!expanded && look.foldTools) return <Trace tone="mind" label="reasoning" text={summary(part)} aside={seconds(part)} open={false} onToggle={() => setOpen(true)} />
  return (
    <div className="my-2 border border-tint-purple/50 tone-panel-50">
      <button onClick={() => setOpen(!expanded)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-ink/[0.03]">
        <Brain className="h-4 w-4 shrink-0 text-tint-purple" />
        <span className="font-ui text-[12px] font-semibold text-tint-purple">reasoning</span>
        {t.style && <span className="shrink-0 border border-tint-purple/50 px-1 font-label text-[10px] caps-5 text-tint-purple">{t.style}</span>}
        {part.edited && <span title="You changed what the agent got back" className="shrink-0 border border-accent/60 px-1 font-label text-[10px] caps-5 text-accent">edited</span>}
        <span className="min-w-0 flex-1 truncate font-ui text-[12px] text-dim">{summary(part)}</span>
        {part.durationMs !== undefined && <span className="shrink-0 font-data text-[10.5px] text-faint">{seconds(part)}</span>}
        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-dim transition-transform', expanded && 'rotate-90')} />
      </button>
      <div className="flex flex-col gap-2 border-t border-tint-purple/30 px-2.5 py-2 text-[12.5px]">
        {expanded && t.question && (
          <div className="flex flex-col gap-0.5">
            <span className="font-label text-[10px] caps-14 text-faint">Asked</span>
            <div className="whitespace-pre-wrap text-accent-soft">{t.question}</div>
          </div>
        )}
        {expanded && t.reasoning && <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words border-l-2 border-l-tint-purple/60 pl-2.5 font-ui text-[12px] leading-relaxed text-ink/80">{t.reasoning}</pre>}
        {draft === null ? (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 text-ink">
              <span className="font-label text-[10.5px] caps-14 text-accent">Conclusion </span>
              {conclusion}
            </div>
            <button
              title={where?.busy ? 'Wait for the reply to finish' : 'Change what the agent got back'}
              disabled={!where || where.busy}
              onClick={() => setDraft(conclusion)}
              className="shrink-0 p-0.5 text-dim hover:text-accent disabled:opacity-40"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <LinkTextarea autoFocus rows={3} value={draft} onValue={setDraft} />
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="primary" disabled={saving || !draft.trim()} onClick={() => void save()}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <span className="font-ui text-[10.5px] text-faint">The agent sees your version from your next message.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function ToolCard(props: ToolCallMessagePartProps) {
  const part = props.artifact as ToolPart | undefined
  const [open, setOpen] = useState<boolean | null>(null)
  const roleplay = useRoleplay()
  const look = useThreadLook()
  const live = useSessions((s) => (part ? s.outputs[part.id] : undefined))
  const { sessionId } = useConversation()
  const repeat = useSessions((s) => {
    if (!part || !sessionId) return 0
    const message = s.messages[sessionId]?.find((m) => m.parts.some((p) => p.type === 'tool' && p.id === part.id))
    if (!message) return 0
    const key = JSON.stringify(part.args)
    let count = 0
    for (const p of message.parts) {
      if (p.type !== 'tool' || p.name !== part.name || JSON.stringify(p.args) !== key) continue
      count += 1
      if (p.id === part.id) break
    }
    return count
  })
  if (!part) return null
  if (part.name === 'reason' && part.status === 'done' && part.view?.kind === 'thought') return <ReasonCard part={part} />
  if ((isPresentation(part.name) || part.view?.kind === 'present') && !part.ui) return <PresentationPart part={part} />

  const streaming = part.status === 'running' && live !== undefined
  if (part.ui && (part.ui.kind !== 'approval' || part.ui.status === 'pending')) {
    return (
      <div {...skinSurface('approval')} className="notch-sm my-3 border border-line border-l-2 border-l-accent tone-panel-60 p-3.5">
        <UiRequestCard ui={part.ui} />
      </div>
    )
  }

  const sent = roleplay ? [] : sentEntries(part.args)
  const expandable = Boolean(part.view || part.result || part.error || part.ui || sent.length)
  const showView = part.status === 'done' && part.view !== undefined && LIVE_VIEWS.has(part.view.kind)
  const expanded = roleplay || look.foldTools ? open === true : (open ?? (expandable || showView)) || part.status === 'error' || part.status === 'blocked' || streaming
  if (look.foldTools && !expanded) return <Trace tone={partTone(part)} label={part.name} text={summary(part)} aside={seconds(part)} open={false} onToggle={expandable ? () => setOpen(true) : undefined} />

  return (
    <div
      className={cn('my-2 border tone-panel-50', part.status === 'error' || part.status === 'blocked' ? 'border-alert/50' : 'border-line/50')}
      onContextMenu={(e) =>
        openMenu(e, part.name, [
          { label: 'Copy result', icon: <Copy />, disabled: !(part.result ?? part.error), onSelect: () => void copyText(part.result ?? part.error ?? '') },
          { label: 'Copy arguments', icon: <Copy />, onSelect: () => void copyText(JSON.stringify(part.args, null, 2)) },
          { label: expanded ? 'Collapse' : 'Expand', disabled: !expandable, onSelect: () => setOpen(!expanded) }
        ])
      }
    >
      <button
        disabled={!expandable}
        onClick={() => setOpen(!expanded)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-ink/[0.03] disabled:cursor-default"
      >
        <StatusIcon part={part} />
        <span className="font-mono text-[12px] font-semibold text-accent">{part.name}</span>
        <span className="min-w-0 flex-1 truncate font-ui text-[12px] text-dim">{summary(part)}</span>
        {repeat > 1 && <span className="shrink-0 border border-accent/50 px-1 font-label text-[10px] caps-5 text-accent">same call ×{repeat}</span>}
        {part.trimmed !== undefined && (
          <span title="Removed from the model's context to save space. The model can read it again with read_kind." className="shrink-0 border border-line/60 px-1 font-label text-[9.5px] caps-5 text-faint">
            trimmed
          </span>
        )}
        {part.durationMs !== undefined && <span className="shrink-0 font-data text-[10.5px] text-faint">{seconds(part)}</span>}
        {expandable && <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-dim transition-transform', expanded && 'rotate-90')} />}
      </button>
      {expanded && (
        <div className="flex flex-col gap-2 border-t border-line/40 px-2.5 py-2">
          {part.ui && !streaming && <UiRequestCard ui={part.ui} />}
          {sent.length > 0 && !streaming && <Sent entries={sent} />}
          {streaming ? (
            <TerminalOutput command={String(part.args.command ?? '')} output={live} />
          ) : part.error ? (
            <div className="font-ui text-[12px] text-alert">{part.error}</div>
          ) : part.view ? (
            <ViewRenderer view={part.view} />
          ) : part.result ? (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap font-mono text-[12px] text-ink/90">{part.result}</pre>
          ) : null}
          {part.cut && (
            <div className="font-ui text-[10.5px] text-faint">The model saw a shortened copy of this output; it can read the rest with read_kind.</div>
          )}
        </div>
      )}
    </div>
  )
}
