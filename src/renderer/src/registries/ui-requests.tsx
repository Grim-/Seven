import { useEffect, useState, type ComponentType } from 'react'
import { Check, Send, ShieldAlert } from 'lucide-react'
import type { ApprovalAnswer, ApprovalProps, ConfirmProps, FormAnswer, FormProps, QuestionAnswer, QuestionProps, UiRequestState } from '@shared/types'
import { PatchView, TerminalOutput } from './views'
import { Button, Input, Select, Toggle } from '../components/ui'
import { engine } from '../lib/ipc'
import { cn } from '../lib/cn'
import { useSessions } from '../store/sessions'
import { toast } from '../store/toasts'
import { errorText } from '../lib/format'
import { UnlockCard } from '../components/vault/Vault'
import { GatherCard } from '../components/chat/Gather'
import { focusedConversation, useConversation } from '../lib/conversation'
import { hidePlayRequest, showPlayRequest } from '../lib/playRequests'

export async function answer(ui: UiRequestState, value: unknown, fallbackText: string): Promise<void> {
  try {
    if (ui.status === 'expired') {
      const conv = focusedConversation()
      if (conv) await useSessions.getState().send(conv, fallbackText)
      return
    }
    const ok = await engine('ui.respond', { id: ui.id, value })
    if (!ok) toast.error('Answer not delivered', 'That question is no longer waiting for an answer.')
  } catch (err) {
    toast.error('Answer not delivered', errorText(err))
  }
}

export function StatusLine({ ui }: { ui: UiRequestState }) {
  if (ui.status === 'pending') return <span className="animate-pulse text-accent">Waiting for your answer</span>
  if (ui.status === 'expired') return <span className="text-accent-soft">Seven restarted before you answered. Answering now sends it as a new message.</span>
  if (ui.status === 'cancelled') return <span className="text-faint">Cancelled</span>
  return <span className="text-ok">Answered</span>
}

function QuestionCard({ ui }: { ui: UiRequestState }) {
  const props = ui.props as QuestionProps
  const answered = ui.status === 'answered' ? (ui.answer as QuestionAnswer) : null
  const open = ui.status === 'pending' || ui.status === 'expired'
  const [picked, setPicked] = useState<string[]>([])
  const [other, setOther] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async (choices: string[], otherText: string | null) => {
    if (sending) return
    setSending(true)
    const value: QuestionAnswer = { choices, other: otherText }
    const text = `${props.question}\nMy answer: ${[...choices, ...(otherText ? [otherText] : [])].join(', ')}`
    await answer(ui, value, text)
    setSending(false)
  }

  const toggle = (option: string) => {
    if (!open) return
    if (!props.multiSelect) {
      void submit([option], null)
      return
    }
    setPicked((p) => (p.includes(option) ? p.filter((o) => o !== option) : [...p, option]))
  }

  const chosen = (option: string) => (answered ? answered.choices.includes(option) : picked.includes(option))

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[14px] leading-snug text-white">{props.question}</div>
      <div className="flex flex-col gap-1.5">
        {props.options.map((option, i) => (
          <button
            key={option}
            disabled={!open || sending}
            onClick={() => toggle(option)}
            className={cn(
              'flex items-center gap-2.5 border px-3 py-2 text-left text-[13.5px] transition-colors',
              chosen(option) ? 'border-accent bg-accent/15 text-white' : 'border-line/60 bg-black/50 text-white/90',
              open && !sending && 'hover:border-accent hover:bg-accent/10'
            )}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-line font-mono text-[10.5px] text-accent">
              {chosen(option) ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            {option}
          </button>
        ))}
      </div>
      {answered?.other && <div className="border-l-2 border-l-accent pl-2.5 text-[13px] text-white/90">"{answered.other}"</div>}
      {open && (
        <div className="flex gap-2">
          {props.allowOther && (
            <Input
              placeholder="Something else..."
              value={other}
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && other.trim()) void submit(picked, other.trim())
              }}
            />
          )}
          {(props.multiSelect || props.allowOther) && (
            <Button
              variant="primary"
              icon={<Send />}
              disabled={sending || (!picked.length && !other.trim())}
              onClick={() => void submit(picked, other.trim() || null)}
            >
              Answer
            </Button>
          )}
        </div>
      )}
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em]">
        <StatusLine ui={ui} />
      </div>
    </div>
  )
}

function ConfirmCard({ ui }: { ui: UiRequestState }) {
  const props = ui.props as ConfirmProps
  const open = ui.status === 'pending' || ui.status === 'expired'
  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[14px] leading-snug text-white">{props.message}</div>
      {open ? (
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => void answer(ui, true, `${props.message}\nMy answer: ${props.confirmLabel}`)}>
            {props.confirmLabel}
          </Button>
          <Button variant="secondary" onClick={() => void answer(ui, false, `${props.message}\nMy answer: ${props.cancelLabel}`)}>
            {props.cancelLabel}
          </Button>
        </div>
      ) : (
        <div className="font-mono text-[12px] text-white/90">{ui.answer === true ? props.confirmLabel : ui.answer === false ? props.cancelLabel : ''}</div>
      )}
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em]">
        <StatusLine ui={ui} />
      </div>
    </div>
  )
}

function ApprovalCard({ ui }: { ui: UiRequestState }) {
  const props = ui.props as ApprovalProps
  const answered = ui.status === 'answered' ? (ui.answer as ApprovalAnswer) : null
  const pending = ui.status === 'pending'
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  const decide = async (decision: ApprovalAnswer['decision']) => {
    if (sending) return
    setSending(true)
    const value: ApprovalAnswer = { decision, note: decision === 'deny' && note.trim() ? note.trim() : null }
    try {
      const ok = await engine('ui.respond', { id: ui.id, value })
      if (!ok) toast.error('Not delivered', 'That request is no longer waiting.')
    } catch (err) {
      toast.error('Not delivered', errorText(err))
    }
    setSending(false)
  }

  const outcome = answered
    ? answered.decision === 'deny'
      ? <span className="text-alert">Denied{answered.note ? `: "${answered.note}"` : ''}</span>
      : answered.decision === 'session'
        ? <span className="text-ok">Allowed ({props.sessionLabel?.toLowerCase() ?? 'for this chat'})</span>
        : <span className="text-ok">Allowed once</span>
    : ui.status === 'expired'
      ? <span className="text-accent-soft">Expired: Seven restarted before you answered. Nothing was run.</span>
      : ui.status === 'cancelled'
        ? <span className="text-faint">Cancelled. Nothing was run.</span>
        : <span className="animate-pulse text-accent">Waiting for your approval</span>

  if (answered && answered.decision !== 'deny') {
    return (
      <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em]">
        <ShieldAlert className="h-3.5 w-3.5 text-ok" />
        {outcome}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-accent" />
        <span className="font-mono text-[12.5px] font-bold uppercase tracking-[0.08em] text-white">{props.title}</span>
      </div>
      <div className="text-[12.5px] text-dim">{props.reason}</div>
      {props.command && <TerminalOutput command={props.command} shell={props.shell ?? undefined} output="" />}
      {props.patch && <PatchView patch={props.patch} maxHeight="max-h-80" />}
      {props.details && <pre className="max-h-60 overflow-auto border border-line/40 bg-black/50 px-2.5 py-2 font-mono text-[11.5px] text-white/85">{props.details}</pre>}
      {pending && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={sending} onClick={() => void decide('once')}>
              Allow once
            </Button>
            {props.sessionLabel && (
              <Button variant="badge" disabled={sending} onClick={() => void decide('session')}>
                {props.sessionLabel}
              </Button>
            )}
            <Button variant="danger" disabled={sending} onClick={() => void decide('deny')}>
              Deny
            </Button>
          </div>
          <Input
            placeholder="Optional: tell the agent why, or what to do instead (sent with Deny)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void decide('deny')
            }}
          />
        </div>
      )}
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em]">{outcome}</div>
    </div>
  )
}

function FormCard({ ui }: { ui: UiRequestState }) {
  const props = ui.props as FormProps
  const pending = ui.status === 'pending'
  const done = ui.status === 'answered' ? (ui.answer as FormAnswer) : null
  const [values, setValues] = useState<Record<string, string | number | boolean>>(() =>
    Object.fromEntries(props.fields.filter((f) => f.default !== undefined).map((f) => [f.name, f.default as string | number | boolean]))
  )
  const missing = props.fields.filter((f) => f.required && (values[f.name] === undefined || values[f.name] === ''))
  const send = (action: FormAnswer['action']) => {
    const clean: Record<string, string | number | boolean> = {}
    for (const f of props.fields) {
      const v = values[f.name]
      if (v === undefined || v === '') continue
      clean[f.name] = f.type === 'number' || f.type === 'integer' ? Number(v) : v
    }
    void answer(ui, { action, values: action === 'accept' ? clean : {} } satisfies FormAnswer, action === 'accept' ? JSON.stringify(clean) : 'I declined to answer.')
  }
  return (
    <div className="flex flex-col gap-2.5">
      <div className="font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-white">{props.title}</div>
      {props.message && <div className="text-[13px] text-white/90">{props.message}</div>}
      {props.fields.map((f) => (
        <label key={f.name} className="flex flex-col gap-1">
          <span className="text-[12px] text-dim">
            {f.label}
            {f.required && <span className="text-accent"> *</span>}
            {f.description && <span className="text-faint"> · {f.description}</span>}
          </span>
          {f.type === 'boolean' ? (
            <Toggle checked={values[f.name] === true} onChange={(v) => setValues({ ...values, [f.name]: v })} label={values[f.name] === true ? 'Yes' : 'No'} />
          ) : f.type === 'choice' ? (
            <Select value={String(values[f.name] ?? '')} options={[{ value: '', label: 'Choose…' }, ...(f.choices ?? []).map((c) => ({ value: c, label: c }))]} onChange={(v) => setValues({ ...values, [f.name]: v })} />
          ) : (
            <Input
              disabled={!pending}
              type={f.type === 'string' ? 'text' : 'number'}
              value={values[f.name] === undefined ? '' : String(values[f.name])}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
            />
          )}
        </label>
      ))}
      {pending ? (
        <div className="flex gap-2">
          <Button size="sm" variant="primary" icon={<Send />} disabled={missing.length > 0} onClick={() => send('accept')}>
            Send
          </Button>
          <Button size="sm" variant="ghost" onClick={() => send('decline')}>
            Decline
          </Button>
        </div>
      ) : (
        <div className="font-mono text-[11px] uppercase tracking-wider text-faint">{done ? (done.action === 'accept' ? 'Sent' : 'Declined') : ui.status}</div>
      )}
    </div>
  )
}

export type RequestPlace = 'inline' | 'panel'

type OwnCard = ComponentType<{ ui: UiRequestState; place: RequestPlace }>

const ownCards = new Map<string, OwnCard>()

export function registerUiRequest(kind: string, card: OwnCard): void {
  ownCards.set(kind, card)
}

function InlineOwn({ ui, Own }: { ui: UiRequestState; Own: OwnCard }) {
  const chat = useConversation().key
  useEffect(() => {
    if (ui.status === 'pending') showPlayRequest(chat, ui)
    else hidePlayRequest(chat, ui.id)
    return () => hidePlayRequest(chat, ui.id)
  }, [chat, ui.id, ui.status])
  return <Own ui={ui} place="inline" />
}

export function UiRequestCard({ ui, place = 'inline' }: { ui: UiRequestState; place?: RequestPlace }) {
  const Own = ownCards.get(ui.kind)
  if (Own) return place === 'panel' ? <Own ui={ui} place="panel" /> : <InlineOwn ui={ui} Own={Own} />
  if (ui.kind === 'approval') return <ApprovalCard ui={ui} />
  if (ui.kind === 'form') return <FormCard ui={ui} />
  if (ui.kind === 'unlock') return <UnlockCard ui={ui} />
  if (ui.kind === 'gather') return <GatherCard ui={ui} answer={(value, fallback) => answer(ui, value, fallback)} />
  return ui.kind === 'confirm' ? <ConfirmCard ui={ui} /> : <QuestionCard ui={ui} />
}
