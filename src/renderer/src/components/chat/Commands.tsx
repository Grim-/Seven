import { Fragment, useEffect, useRef, useState, type RefObject } from 'react'
import { FloatLayer } from '../ui/FloatLayer'
import { create } from 'zustand'
import { useAui, useAuiState } from '@assistant-ui/react'
import { Terminal, X } from 'lucide-react'
import { hitDetail, type CommandArg, type CommandInfo } from '@shared/types'
import {
  argLabel,
  commandVariables,
  formatCommandLine,
  parseCommandArgs,
  parsePromptSegments
} from '@shared/commandArgs'
import { engine } from '../../lib/ipc'
import { useCommands } from '../../store/commands'
import { Markdown } from './Markdown'
import { COMMAND_TONE, CommandLine } from './CommandLine'
import { cn } from '../../lib/cn'
import { skinSurface } from '../skins/skinSurface'
import { toast } from '../../store/toasts'
import { failed } from '../../lib/notify'
import { useConversation } from '../../lib/conversation'
import { useKindInfos } from '../../lib/kinds'
import { toId } from '@shared/ids'
import { useKeepInView } from '../../lib/useKeepInView'
import { noteFailure } from '../../store/problems'
import { useLibraryFind } from '../../lib/useLibraryFind'

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
      .catch(noteFailure('chat', 'Could not load the fields', () => live && setFields([])))
    return () => {
      live = false
    }
  }, [base])
  if (!base) return null
  return fields
    .filter((f) => !query || toId(f).startsWith(query) || f.toLowerCase().startsWith(query))
    .map((f) => ({ key: `${base}#${f}`, label: `#${toId(f)}`, detail: `put the text of ${f} here`, apply: () => setText(`${before}${base}#${toId(f)} `) }))
}

export function useReferenceHints(text: string, setText: (t: string) => void): Hint[] {
  const m = /(^|\s|")@([^\s"]*)$/.exec(text)
  const token = m ? m[2] : null
  const fieldHints = useFieldHints(token, token === null ? text : text.slice(0, text.length - token.length), setText)
  const colon = token ? token.indexOf(':') : -1
  const kind = token && colon > 0 ? token.slice(0, colon) : null
  const query = token && colon > 0 ? token.slice(colon + 1) : ''
  const actionColon = !query.startsWith('"') ? query.indexOf(':') : -1
  const actionBase = actionColon > 0 ? query.slice(0, actionColon) : null
  const actionQuery = actionColon > 0 ? query.slice(actionColon + 1).toLowerCase() : ''
  const slash = query.lastIndexOf('/')
  const parent = slash > 0 && actionColon < 0 ? query.slice(0, slash) : null
  const tail = slash > 0 ? query.slice(slash + 1).toLowerCase() : ''
  const kinds = useKindInfos(token !== null)
  const hits = useLibraryFind(query, kind, 30, Boolean(kind) && parent === null && actionColon <= 0) ?? []
  const [inside, setInside] = useState<{ segment: string; kind: string; title: string; path?: string }[]>([])

  useEffect(() => {
    if (!kind || parent === null) return setInside([])
    let live = true
    void engine('library.inside', { entry: `@${kind}:${parent}` })
      .then((c) => live && setInside(c))
      .catch(noteFailure('chat', 'Could not look inside', () => live && setInside([])))
    return () => {
      live = false
    }
  }, [kind, parent])

  if (token === null) return []
  if (fieldHints) return fieldHints
  const before = text.slice(0, text.length - token.length)
  if (!kind) {
    const q = token.toLowerCase()
    return kinds
      .filter((k) => !q || k.kind.toLowerCase().startsWith(q) || k.short.toLowerCase().startsWith(q) || k.label.toLowerCase().startsWith(q))
      .map((k) => ({ key: `@${k.kind}`, label: `@${k.short}:`, detail: k.description, apply: () => setText(`${before}${k.short}:`) }))
  }
  const descend = (ref: string) => {
    if (ref.startsWith('"')) return setText(`${before}${kind}:${ref} `)
    void engine('library.inside', { entry: `@${kind}:${ref}` })
      .then((c) => setText(`${before}${kind}:${ref}${c.length ? '/' : ' '}`))
      .catch(noteFailure('chat', 'Could not look inside', () => setText(`${before}${kind}:${ref} `)))
  }
  if (parent !== null) {
    const label = (k: string) => kinds.find((x) => x.kind === k)?.label ?? k
    const here: Hint[] = tail ? [] : [{ key: `${kind}:${parent}:here`, label: `@${kind}:${parent}`, detail: 'Link this one', apply: () => setText(`${before}${kind}:${parent} `) }]
    return here.concat(inside
      .filter((c) => !tail || c.segment.startsWith(tail) || c.title.toLowerCase().startsWith(tail))
      .map((c) => {
        const ref = c.path ?? `${parent}/${c.segment}`
        return { key: `${kind}:${ref}`, label: c.title, detail: `${label(c.kind)} · ${ref}`, apply: () => descend(ref) }
      }))
  }
  const info = kinds.find((k) => k.kind === kind || k.short === kind?.toLowerCase())
  const actions = info?.linkActions ?? (info?.rollable ? [{ name: 'roll', label: 'roll', detail: 'put a random value from it here', mode: 'insert' as const }] : [])
  const runAction = (refId: string, actionName: string, mode: 'insert' | 'placeholder') => {
    if (mode === 'placeholder') {
      setText(`${before}${kind}:${refId}:${actionName} `)
      return
    }
    void engine('library.rollText', { text: `@${kind}:${refId}:${actionName}` })
      .then((r) => (r.rolled[0]?.error ? toast.error('Could not run', r.rolled[0].error) : setText(`${before.slice(0, -1)}${r.text} `)))
      .catch(failed('Could not run'))
  }
  if (actionBase !== null) {
    return actions
      .filter((a) => !actionQuery || a.name.toLowerCase().startsWith(actionQuery) || a.label.toLowerCase().replace(/^:/, '').startsWith(actionQuery))
      .map((a) => ({
        key: `${kind}/${actionBase}:${a.name}`,
        label: a.label.startsWith(':') ? a.label : `:${a.name}`,
        detail: a.detail,
        apply: () => runAction(actionBase, a.name, a.mode)
      }))
  }
  return hits.flatMap((h) => {
    const refId = quote(h.id)
    const actionHints: Hint[] = actions.map((a) => ({
      key: `${h.kind}/${h.id}:${a.name}`,
      label: `${h.title} · ${a.label}`,
      detail: a.detail,
      apply: () => runAction(refId, a.name, a.mode)
    }))
    const link: Hint = { key: `${h.kind}/${h.id}`, label: h.title, detail: hitDetail(h), apply: () => descend(refId) }
    const parts: Hint[] = (info?.parts ?? []).map((p) => ({ key: `${h.kind}/${h.id}#${p.name}`, label: `${h.title} · #${p.name}`, detail: p.description, apply: () => setText(`${before}${kind}:${refId}#${p.name} `) }))
    return [...actionHints, link, ...parts]
  })
}


interface CommandBarState {
  editingIndex: number | null
  focusComposer: (() => void) | null
  setEditingIndex: (idx: number | null) => void
  setFocusComposer: (fn: (() => void) | null) => void
}

export const useCommandBar = create<CommandBarState>((set) => ({
  editingIndex: null,
  focusComposer: null,
  setEditingIndex: (editingIndex) => set({ editingIndex }),
  setFocusComposer: (focusComposer) => set({ focusComposer })
}))

function matchActiveCommand(
  text: string,
  list: CommandInfo[]
): { info: CommandInfo; rawArgs: string; vars: CommandArg[] } | null {
  const m = /^\/(\S+)\s([\s\S]*)$/.exec(text)
  if (!m) return null
  const name = m[1].toLowerCase()
  const info = list.find((c) => c.name.toLowerCase() === name)
  if (!info) return null
  const vars = info.prompt ? commandVariables(info.prompt, info.args) : []
  return { info, rawArgs: m[2], vars }
}

/**
 * Advance or navigate command variable slots on Tab / Shift+Tab from the main Composer.
 * Returns true if the event was handled by an active command with variables.
 */
export function handleComposerCommandTab(
  e: { shiftKey: boolean; preventDefault: () => void; stopPropagation: () => void },
  text: string,
  setText: (next: string) => void,
  list: CommandInfo[]
): boolean {
  const matched = matchActiveCommand(text, list)
  if (!matched || !matched.vars.length) return false
  const { info, rawArgs, vars } = matched
  e.preventDefault()
  e.stopPropagation()

  const { values, activeIndex } = parseCommandArgs(rawArgs, vars)
  if (vars.length === 1) {
    useCommandBar.getState().setEditingIndex(0)
    return true
  }

  const next = e.shiftKey
    ? (activeIndex - 1 + vars.length) % vars.length
    : (activeIndex + 1) % vars.length

  if (!e.shiftKey && activeIndex < vars.length - 1 && (values[vars[next].name] ?? '') === '') {
    setText(formatCommandLine(info.name, vars, values, { openSlot: next, trailingSpace: true }))
    useCommandBar.getState().setEditingIndex(null)
  } else {
    setText(formatCommandLine(info.name, vars, values))
    useCommandBar.getState().setEditingIndex(next)
  }
  return true
}

function CommandPieceToken({
  def,
  value,
  active,
  editing,
  onStartEdit,
  onChange,
  onStepTab,
  onDone
}: {
  def: CommandArg
  value: string
  active: boolean
  editing: boolean
  onStartEdit: () => void
  onChange: (next: string) => void
  onStepTab: (dir: -1 | 1) => void
  onDone: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const label = argLabel(def)
  const placeholder = def.hint || (def.default ? `${label} (${def.default})` : label)
  const filled = value.length > 0

  useEffect(() => {
    if (!editing) return
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => cancelAnimationFrame(frame)
  }, [editing])

  if (editing) {
    return (
      <label
        data-cmd-piece
        className="mx-0.5 inline-grid h-[26px] max-w-[32rem] min-w-[7rem] items-center border border-[var(--tone)] bg-[color-mix(in_srgb,var(--tone)_18%,var(--color-surface))] px-2 align-middle shadow-[0_0_12px_color-mix(in_srgb,var(--tone)_28%,transparent)]"
      >
        <span className="invisible col-start-1 row-start-1 whitespace-pre px-0.5 font-mono text-[13px] font-semibold">
          {value || placeholder}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            const target = e.relatedTarget as HTMLElement | null
            if (!target?.closest('[data-cmd-piece]')) useCommandBar.getState().setEditingIndex(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault()
              e.stopPropagation()
              onStepTab(e.shiftKey ? -1 : 1)
            } else if (e.key === 'Enter' || e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              onDone()
            }
          }}
          className="col-start-1 row-start-1 w-full min-w-0 bg-transparent font-ui text-[13px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-dim/70"
        />
      </label>
    )
  }

  return (
    <button
      type="button"
      data-cmd-piece
      title={def.hint ? `${label} — ${def.hint} (click to edit)` : `Click to edit ${label}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onStartEdit}
      className={cn(
        'mx-0.5 inline-flex h-[26px] max-w-full cursor-pointer items-center gap-1.5 border px-2 align-middle font-ui text-[13px] transition-colors',
        active
          ? 'border-[var(--tone)] bg-[color-mix(in_srgb,var(--tone)_18%,transparent)] font-semibold text-ink shadow-[0_0_10px_color-mix(in_srgb,var(--tone)_22%,transparent)]'
          : filled
            ? 'border-[color-mix(in_srgb,var(--tone)_45%,transparent)] bg-[color-mix(in_srgb,var(--tone)_10%,transparent)] font-semibold text-ink hover:border-[var(--tone)] hover:bg-[color-mix(in_srgb,var(--tone)_20%,transparent)]'
            : 'border-dashed border-line text-dim hover:border-dim hover:text-ink'
      )}
    >
      <span className="truncate">{filled ? value : def.default ? `${label}: ${def.default}` : label}</span>
    </button>
  )
}

export function ActiveCommand() {
  const [text, setText] = useComposerText()
  const list = useCommands((s) => s.list)
  const editingIndex = useCommandBar((s) => s.editingIndex)
  const setEditingIndex = useCommandBar((s) => s.setEditingIndex)
  const focusComposer = useCommandBar((s) => s.focusComposer)

  const matched = matchActiveCommand(text, list)
  const cmdName = matched?.info.name ?? null
  useEffect(() => {
    setEditingIndex(null)
  }, [cmdName, setEditingIndex])

  if (!matched) return null
  const { info, rawArgs, vars } = matched

  if (!info.prompt || vars.length === 0) {
    return (
      <div {...skinSurface('chat-popover')} className="absolute bottom-full left-0 right-0 z-50 mb-px flex items-start gap-3 border border-accent/70 tone-panel-95 px-3 py-2">
        <span className="shrink-0 border border-accent bg-accent/15 px-1.5 py-0.5 font-mono text-[12px] font-bold text-ink">/{info.name}</span>
        <div className="min-w-0 flex-1 text-[12px] text-dim">
          <Markdown text={info.usage} />
        </div>
      </div>
    )
  }

  const { values, activeIndex } = parseCommandArgs(rawArgs, vars)
  const currentSlot = editingIndex !== null ? editingIndex : activeIndex
  const segments = parsePromptSegments(info.prompt)
  const indexByLower = new Map(vars.map((v, i) => [v.name.toLowerCase(), i]))
  const renderedSlots = new Set<number>()

  const updateSlot = (slotIdx: number, nextVal: string) => {
    const nextValues = { ...values, [vars[slotIdx].name]: nextVal }
    setText(formatCommandLine(info.name, vars, nextValues))
  }

  const stepSlot = (fromIdx: number, dir: -1 | 1) => {
    const nextIdx = (fromIdx + dir + vars.length) % vars.length
    setEditingIndex(nextIdx)
  }

  const finishPieceEdit = () => {
    setEditingIndex(null)
    focusComposer?.()
  }

  return (
    <div
      style={COMMAND_TONE}
      {...skinSurface('chat-popover')}
      className="absolute bottom-full left-0 right-0 z-50 mb-px flex flex-col gap-2 border border-accent/70 tone-panel-95 px-3 py-2.5 shadow-[0_-10px_28px_color-mix(in_srgb,var(--color-shade)_70%,transparent)]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 border border-accent bg-accent/15 px-1.5 py-0.5 font-mono text-[12px] font-bold text-ink">
          /{info.name}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {vars.map((v, idx) => {
            const val = values[v.name] ?? ''
            const isCur = idx === currentSlot
            return (
              <button
                key={v.name}
                type="button"
                data-cmd-piece
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setEditingIndex(idx)}
                className={cn(
                  'inline-flex items-center gap-1.5 border px-2 py-0.5 font-label text-[10.5px] caps-8 transition-colors',
                  isCur
                    ? 'border-[var(--tone)] bg-[color-mix(in_srgb,var(--tone)_20%,transparent)] text-ink'
                    : val
                      ? 'border-[color-mix(in_srgb,var(--tone)_45%,transparent)] bg-[color-mix(in_srgb,var(--tone)_8%,transparent)] text-ink/85 hover:border-[var(--tone)]'
                      : 'border-dashed border-line text-dim hover:border-dim hover:text-ink'
                )}
              >
                <span className="text-[9.5px] text-faint">{idx + 1}</span>
                <span>{argLabel(v)}</span>
              </button>
            )
          })}
        </div>
        <span className="shrink-0 font-label text-[10px] caps-10 text-faint">
          Tab next · Click piece · Enter send
        </span>
      </div>
      <CommandLine>
        {segments.map((seg, i) => {
          if (seg.type === 'text') {
            return (
              <span key={i} className="whitespace-pre-wrap">
                {seg.value}
              </span>
            )
          }
          const idx = indexByLower.get(seg.name.toLowerCase())
          if (idx === undefined) return <Fragment key={i}>{`{${seg.name}}`}</Fragment>
          const def = vars[idx]
          const val = values[def.name] ?? ''
          const firstAppearance = !renderedSlots.has(idx)
          if (firstAppearance) renderedSlots.add(idx)
          return (
            <CommandPieceToken
              key={`${i}:${def.name}`}
              def={def}
              value={val}
              active={idx === currentSlot}
              editing={firstAppearance && editingIndex === idx}
              onStartEdit={() => setEditingIndex(idx)}
              onChange={(nextVal) => updateSlot(idx, nextVal)}
              onStepTab={(dir) => stepSlot(idx, dir)}
              onDone={finishPieceEdit}
            />
          )
        })}
      </CommandLine>
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
  const list = useKeepInView<HTMLDivElement>(selected)
  if (!hints.length) return null
  return (
    <div ref={list} {...(inline ? {} : skinSurface('chat-popover'))} className={cn('max-h-80 overflow-y-auto border border-line tone-panel-95 py-1', inline ? 'shrink-0' : 'absolute bottom-full left-0 right-0 z-50 mb-px')}>
      {hints.map((h, i) => (
        <button
          key={h.key}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => onSelect(i)}
          onClick={h.apply}
          className={cn('flex w-full items-baseline gap-3 border-l-2 px-3 py-1.5 text-left', i === selected ? 'border-l-accent bg-accent/15' : 'border-l-transparent')}
        >
          <span className={cn('max-w-[45%] shrink-0 truncate font-ui text-[12.5px]', i === selected ? 'text-ink' : 'text-accent')}>{h.label}</span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-dim">{h.detail}</span>
          {i === selected && <span className="shrink-0 font-label text-[10px] caps-5 text-faint">Tab / Enter</span>}
        </button>
      ))}
    </div>
  )
}

export function FloatingHints({ anchor, hints, selected, onSelect, onClose }: { anchor: RefObject<HTMLElement | null>; hints: Hint[]; selected: number; onSelect: (index: number) => void; onClose: () => void }) {
  if (!hints.length) return null
  return (
    <FloatLayer anchor={anchor} onClose={onClose} side="top" align="start" className="w-[min(32rem,90vw)] border-0 bg-transparent shadow-none">
      <ComposerHints hints={hints} selected={selected} onSelect={onSelect} inline />
    </FloatLayer>
  )
}

export function CommandOutputCard() {
  const output = useCommands((s) => s.output)
  const dismiss = useCommands((s) => s.dismiss)
  const { sessionId } = useConversation()
  if (!output || output.sessionId !== sessionId) return null
  return (
    <div className={cn('flex max-h-72 shrink-0 gap-3 border-t px-3.5 py-2', output.error ? 'border-alert/40 bg-alert/[0.06]' : 'border-secondary/40 bg-secondary/[0.05]')}>
      <Terminal className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', output.error ? 'text-alert' : 'text-secondary')} />
      <div className="min-w-0 flex-1 overflow-y-auto text-[12.5px]">
        <div className="mb-1 font-ui text-[11px] text-faint">{output.line}</div>
        {output.busy ? (
          <div className="font-ui text-[11.5px] text-dim">Working…</div>
        ) : output.error ? (
          <div className="font-ui text-[12px] text-alert">{output.text}</div>
        ) : (
          <Markdown text={output.text ?? ''} />
        )}
      </div>
      {!output.busy && (
        <button title="Close" onClick={dismiss} className="h-5 w-5 shrink-0 text-dim hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
