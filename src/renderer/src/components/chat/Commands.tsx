import { useEffect, useState } from 'react'
import { useAui, useAuiState } from '@assistant-ui/react'
import { Terminal, X } from 'lucide-react'
import { hitDetail, type LibraryHit } from '@shared/types'
import { engine } from '../../lib/ipc'
import { useCommands } from '../../store/commands'
import { Markdown } from './Markdown'
import { cn } from '../../lib/cn'
import { toast } from '../../store/toasts'
import { failed } from '../../lib/notify'
import { useConversation } from '../../lib/conversation'
import { useKindInfos } from '../../lib/kinds'
import { toId } from '@shared/ids'

export interface Hint {
  key: string
  label: string
  detail: string
  apply: () => void
}

function useComposerText(): [string, (text: string) => void] {
  const text = useAuiState((s) => (s.composer.isEditing ? s.composer.text : ''))
  const aui = useAui()
  return [text, (next) => aui.composer.setText(next)]
}

function useCommandHints(text: string, setText: (t: string) => void): Hint[] {
  const list = useCommands((s) => s.list)
  const load = useCommands((s) => s.load)
  const conv = useConversation()
  const command = text.startsWith('/') && !text.startsWith('//')
  const slash = command && !/\s/.test(text)
  useEffect(() => {
    if (command) void load(conv)
  }, [command, load])
  if (!slash) return []
  const q = text.slice(1).toLowerCase()
  return list
    .filter((c) => c.name.toLowerCase().startsWith(q))
    .slice(0, 12)
    .map((c) => ({ key: `/${c.name}`, label: `/${c.name}`, detail: c.summary, apply: () => setText(`/${c.name} `) }))
}

function quote(id: string): string {
  return /[\s,;!?)]/.test(id) ? `"${id}"` : id
}

function useFieldHints(token: string | null, before: string, setText: (t: string) => void): Hint[] | null {
  const hash = token ? token.indexOf('#') : -1
  const base = token && hash > 0 && token.includes(':') ? token.slice(0, hash) : null
  const query = token && hash > 0 ? token.slice(hash + 1).toLowerCase() : ''
  const [fields, setFields] = useState<string[]>([])
  useEffect(() => {
    if (!base) return setFields([])
    let live = true
    void engine('library.fields', { entry: `@${base}` })
      .then((f) => live && setFields(f))
      .catch(() => live && setFields([]))
    return () => {
      live = false
    }
  }, [base])
  if (!base) return null
  return fields
    .filter((f) => !query || toId(f).startsWith(query) || f.toLowerCase().startsWith(query))
    .slice(0, 8)
    .map((f) => ({ key: `${base}#${f}`, label: `#${toId(f)}`, detail: `put the text of ${f} here`, apply: () => setText(`${before}${base}#${toId(f)} `) }))
}

export function useReferenceHints(text: string, setText: (t: string) => void): Hint[] {
  const m = /(^|\s)@([^\s]*)$/.exec(text)
  const token = m ? m[2] : null
  const fieldHints = useFieldHints(token, token === null ? text : text.slice(0, text.length - token.length), setText)
  const colon = token ? token.indexOf(':') : -1
  const kind = token && colon > 0 ? token.slice(0, colon) : null
  const query = token && colon > 0 ? token.slice(colon + 1) : ''
  const kinds = useKindInfos(token !== null)
  const [hits, setHits] = useState<LibraryHit[]>([])

  useEffect(() => {
    if (!kind) return setHits([])
    let live = true
    const timer = setTimeout(() => {
      void engine('library.find', { query, kind })
        .then((h) => live && setHits(h.slice(0, 8)))
        .catch(() => live && setHits([]))
    }, 150)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [kind, query])

  if (token === null) return []
  if (fieldHints) return fieldHints
  const before = text.slice(0, text.length - token.length)
  if (!kind) {
    const q = token.toLowerCase()
    return kinds
      .filter((k) => !q || k.kind.toLowerCase().startsWith(q) || k.short.toLowerCase().startsWith(q) || k.label.toLowerCase().startsWith(q))
      .slice(0, 8)
      .map((k) => ({ key: `@${k.kind}`, label: `@${k.short}:`, detail: k.description, apply: () => setText(`${before}${k.short}:`) }))
  }
  const info = kinds.find((k) => k.kind === kind || k.short === kind?.toLowerCase())
  return hits.flatMap((h) => {
    const link: Hint = { key: `${h.kind}/${h.id}`, label: h.title, detail: hitDetail(h), apply: () => setText(`${before}${kind}:${quote(h.id)} `) }
    const parts: Hint[] = (info?.parts ?? []).map((p) => ({ key: `${h.kind}/${h.id}#${p.name}`, label: `${h.title} · #${p.name}`, detail: p.description, apply: () => setText(`${before}${kind}:${quote(h.id)}#${p.name} `) }))
    if (!info?.rollable) return [link, ...parts]
    const roll: Hint = {
      key: `${h.kind}/${h.id}#random`,
      label: `${h.title} · roll`,
      detail: 'put a random value from it here',
      apply: () =>
        void engine('library.rollText', { text: `@${kind}:${quote(h.id)}#random` })
          .then((r) => (r.rolled[0]?.error ? toast.error('Could not roll', r.rolled[0].error) : setText(`${before.slice(0, -1)}${r.text} `)))
          .catch(failed('Could not roll'))
    }
    return [roll, link, ...parts]
  })
}

export function ActiveCommand() {
  const [text] = useComposerText()
  const list = useCommands((s) => s.list)
  const name = /^\/(\S+)\s/.exec(text)?.[1]?.toLowerCase()
  const info = name ? list.find((c) => c.name.toLowerCase() === name) : undefined
  if (!info) return null
  return (
    <div className="absolute bottom-full left-0 right-0 z-30 mb-px flex items-start gap-3 border border-accent/70 bg-black/95 px-3 py-2">
      <span className="shrink-0 border border-accent bg-accent/15 px-1.5 py-0.5 font-mono text-[12px] font-bold text-white">/{info.name}</span>
      <div className="min-w-0 flex-1 text-[12px] text-dim">
        <Markdown text={info.usage} />
      </div>
    </div>
  )
}

export function useComposerHints(): Hint[] {
  const [text, setText] = useComposerText()
  const commands = useCommandHints(text, setText)
  const references = useReferenceHints(text, setText)
  return commands.length ? commands : references
}

export function ComposerHints({ hints, selected, onSelect, inline = false }: { hints: Hint[]; selected: number; onSelect: (index: number) => void; inline?: boolean }) {
  if (!hints.length) return null
  return (
    <div className={cn('max-h-80 overflow-y-auto border border-line bg-black/95 py-1', inline ? 'shrink-0' : 'absolute bottom-full left-0 right-0 z-30 mb-px')}>
      {hints.map((h, i) => (
        <button
          key={h.key}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => onSelect(i)}
          onClick={h.apply}
          className={cn('flex w-full items-baseline gap-3 border-l-2 px-3 py-1.5 text-left', i === selected ? 'border-l-accent bg-accent/15' : 'border-l-transparent')}
        >
          <span className={cn('max-w-[45%] shrink-0 truncate font-mono text-[12.5px]', i === selected ? 'text-white' : 'text-accent')}>{h.label}</span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-dim">{h.detail}</span>
          {i === selected && <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-faint">Tab / Enter</span>}
        </button>
      ))}
    </div>
  )
}

export function CommandOutputCard() {
  const output = useCommands((s) => s.output)
  const dismiss = useCommands((s) => s.dismiss)
  const { sessionId } = useConversation()
  if (!output || output.sessionId !== sessionId) return null
  return (
    <div className={cn('flex max-h-72 shrink-0 gap-3 border-t px-3.5 py-2', output.error ? 'border-alert/40 bg-alert/[0.06]' : 'border-teal/40 bg-teal/[0.05]')}>
      <Terminal className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', output.error ? 'text-alert' : 'text-teal')} />
      <div className="min-w-0 flex-1 overflow-y-auto text-[12.5px]">
        <div className="mb-1 font-mono text-[11px] text-faint">{output.line}</div>
        {output.busy ? (
          <div className="font-mono text-[11.5px] text-dim">Working…</div>
        ) : output.error ? (
          <div className="font-mono text-[12px] text-alert">{output.text}</div>
        ) : (
          <Markdown text={output.text ?? ''} />
        )}
      </div>
      {!output.busy && (
        <button title="Close" onClick={dismiss} className="h-5 w-5 shrink-0 text-dim hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
