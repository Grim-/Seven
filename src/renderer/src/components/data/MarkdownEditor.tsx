import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Crepe } from '@milkdown/crepe'
import { editorViewCtx } from '@milkdown/kit/core'
import { replaceAll } from '@milkdown/kit/utils'
import type { EditorView } from '@milkdown/kit/prose/view'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame-dark.css'
import { ComposerHints, useReferenceHints } from '../chat/Commands'
import { cn } from '../../lib/cn'
import { useRolls } from './useRolls'
import { referenceMarks } from './referenceMarks'
import { EditorCommandBar, editorAt, type EditorAt } from './EditorCommandBar'
import { assetUrl, useData } from '../../store/data'
import type { Ctx } from '@milkdown/kit/ctx'

interface Props {
  value: string
  onValue: (markdown: string) => void
  onSave?: () => void
  onBlur?: () => void
  placeholder?: string
  autoFocus?: boolean
  compact?: boolean
  rolls?: boolean
  className?: string
}

export interface MarkdownEditorHandle {
  insert: (text: string) => void
  focus: () => void
}

function prefixOf(view: EditorView): { text: string; start: number; end: number } | null {
  const { $from, empty } = view.state.selection
  if (!empty || !$from.parent.isTextblock) return null
  return { text: $from.parent.textBetween(0, $from.parentOffset, undefined, '￼'), start: $from.start(), end: $from.pos }
}

const LIBRARY_PICTURE = 'seven:file/'

function libraryPicture(url: string): string {
  if (!url.startsWith(LIBRARY_PICTURE)) return url
  const asset = useData.getState().assets.find((a) => a.id === url.slice(LIBRARY_PICTURE.length))
  return asset ? assetUrl(asset) : url
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(function MarkdownEditor({ value, onValue, onSave, onBlur, placeholder, autoFocus, compact = false, rolls = false, className }, ref) {
  const root = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const crepeRef = useRef<Crepe | null>(null)
  const emitted = useRef(value)
  const roll = useRolls(rolls, value, onValue)
  const onValueRef = useRef((markdown: string) => {
    onValue(markdown)
    roll(markdown)
  })
  onValueRef.current = (markdown: string) => {
    onValue(markdown)
    roll(markdown)
  }
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  const onBlurRef = useRef(onBlur)
  onBlurRef.current = onBlur
  const [before, setBefore] = useState<{ text: string; start: number; end: number } | null>(null)
  const [at, setAt] = useState<EditorAt>({ block: 'paragraph', marks: [] })
  const run = (work: (ctx: Ctx) => void) => {
    crepeRef.current?.editor.action(work)
    viewRef.current?.focus()
  }
  const [pick, setPick] = useState(0)
  const [hiddenAt, setHiddenAt] = useState<string | null>(null)

  useImperativeHandle(ref, () => ({
    insert: (text) => {
      const view = viewRef.current
      if (!view) return
      const { from, to } = view.state.selection
      view.dispatch(view.state.tr.insertText(text, from, to))
      view.focus()
    },
    focus: () => viewRef.current?.focus()
  }))

  const found = useReferenceHints(before?.text ?? '', (next) => {
    const view = viewRef.current
    if (!view || !before) return
    let same = 0
    while (same < next.length && same < before.text.length && next[same] === before.text[same]) same++
    const from = before.start + same
    view.dispatch(view.state.tr.insertText(next.slice(same), from, before.end))
    view.focus()
  })
  const keys = found.map((h) => h.key).join('|')
  useEffect(() => setPick(0), [keys])
  const hints = before && hiddenAt !== `${before.end}:${keys}` ? found : []
  const current = Math.min(pick, Math.max(0, hints.length - 1))
  const keyState = useRef({ hints, current, hide: () => {}, move: (_d: number) => {} })
  keyState.current = {
    hints,
    current,
    hide: () => before && setHiddenAt(`${before.end}:${keys}`),
    move: (d) => setPick((current + d + hints.length) % hints.length)
  }

  useEffect(() => {
    const crepe = crepeRef.current
    if (!crepe || !viewRef.current || value === emitted.current) return
    emitted.current = value
    crepe.editor.action(replaceAll(value))
  }, [value])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const host = document.createElement('div')
    el.appendChild(host)
    const crepe = new Crepe({
      root: host,
      defaultValue: value,
      features: { [Crepe.Feature.Latex]: false, [Crepe.Feature.AI]: false, [Crepe.Feature.TopBar]: false, [Crepe.Feature.BlockEdit]: !compact },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: { text: placeholder ?? 'Write here. @kind:Name links anything.', mode: 'doc' },
        [Crepe.Feature.ImageBlock]: { proxyDomURL: libraryPicture }
      }
    })
    crepe.editor.use(referenceMarks)
    crepeRef.current = crepe
    const track = () => {
      const view = viewRef.current
      setBefore(view ? prefixOf(view) : null)
      if (view) setAt(editorAt(view.state))
    }
    crepe.on((api) => {
      api.markdownUpdated((_ctx, markdown) => {
        emitted.current = markdown
        onValueRef.current(markdown)
      })
      api.selectionUpdated(() => track())
      api.updated(() => track())
    })
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.ctrlKey || e.metaKey) && onSaveRef.current) {
        e.preventDefault()
        e.stopPropagation()
        onSaveRef.current()
        return
      }
      const k = keyState.current
      if (!k.hints.length) return
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') k.move(e.key === 'ArrowDown' ? 1 : -1)
      else if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) k.hints[k.current]?.apply()
      else if (e.key === 'Escape') k.hide()
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    const focusout = (e: FocusEvent) => {
      if (!(e.relatedTarget instanceof Node && el.parentElement?.contains(e.relatedTarget))) onBlurRef.current?.()
    }
    el.addEventListener('keydown', keydown, true)
    el.addEventListener('focusout', focusout)
    let alive = true
    void crepe.create().then((editor) => {
      if (!alive) return
      editor.action((ctx) => {
        viewRef.current = ctx.get(editorViewCtx)
        if (autoFocus) viewRef.current.focus()
      })
    })
    return () => {
      alive = false
      el.removeEventListener('keydown', keydown, true)
      el.removeEventListener('focusout', focusout)
      viewRef.current = null
      crepeRef.current = null
      void crepe.destroy().finally(() => host.remove())
      host.style.display = 'none'
    }
  }, [])

  return (
    <div className={cn('seven-md-editor flex min-h-0 flex-col', compact ? 'seven-md-compact gap-1' : 'seven-md-doc', className)}>
      <ComposerHints hints={hints} selected={current} onSelect={setPick} inline />
      {!compact && <EditorCommandBar at={at} run={run} />}
      <div ref={root} className={cn('min-h-0 flex-1 border border-line/40', compact ? 'bg-black/40 focus-within:border-accent/60' : 'seven-doc-bg overflow-y-auto')} />
    </div>
  )
})
