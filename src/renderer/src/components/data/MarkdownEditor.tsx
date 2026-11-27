import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { TableKit } from '@tiptap/extension-table'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import { FloatingHints, useReferenceHints, type Hint } from '../chat/Commands'
import { cn } from '../../lib/cn'
import { AddressTools } from '../ui'
import { useRolls } from './useRolls'
import { referenceMarks } from './referenceMarks'
import { escapeOnlyWhatMatters, libraryImage, plainParagraph } from './editorExtensions'
import { BLOCKS, EditorCommandBar } from './EditorCommandBar'
import { EditorBubble } from './EditorBubble'

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
  title?: string
  bar?: boolean
}

export interface MarkdownEditorHandle {
  insert: (text: string) => void
  focus: () => void
}

interface Before {
  text: string
  start: number
  end: number
}

function prefixOf(editor: Editor): Before | null {
  const { $from, empty } = editor.state.selection
  if (!empty || !$from.parent.isTextblock) return null
  return { text: $from.parent.textBetween(0, $from.parentOffset, undefined, '￼'), start: $from.start(), end: $from.pos }
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(function MarkdownEditor({ value, onValue, onSave, onBlur, placeholder, autoFocus, compact = false, rolls = false, className, title, bar = false }, ref) {
  const emitted = useRef(value)
  const area = useRef<HTMLDivElement>(null)
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
  const [before, setBefore] = useState<Before | null>(null)
  const [pick, setPick] = useState(0)
  const [hiddenAt, setHiddenAt] = useState<string | null>(null)
  const keyState = useRef({ hints: [] as { apply: () => void }[], current: 0, hide: () => {}, move: (_d: number) => {} })

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ paragraph: false, link: { openOnClick: false } }),
      plainParagraph,
      Markdown,
      TableKit.configure({ table: { resizable: false } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      libraryImage,
      referenceMarks,
      Placeholder.configure({ placeholder: placeholder ?? 'Write here. @kind:Name links anything.' })
    ],
    content: value,
    contentType: 'markdown',
    autofocus: autoFocus ? 'end' : false,
    onCreate: ({ editor }) => escapeOnlyWhatMatters(editor),
    onUpdate: ({ editor }) => {
      const markdown = editor.getMarkdown()
      emitted.current = markdown
      onValueRef.current(markdown)
      setBefore(prefixOf(editor))
    },
    onSelectionUpdate: ({ editor }) => setBefore(prefixOf(editor)),
    onBlur: () => onBlurRef.current?.(),
    editorProps: {
      handleKeyDown: (_view, e) => {
        if (e.key === 's' && (e.ctrlKey || e.metaKey) && onSaveRef.current) {
          e.preventDefault()
          onSaveRef.current()
          return true
        }
        const k = keyState.current
        if (!k.hints.length) return false
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') k.move(e.key === 'ArrowDown' ? 1 : -1)
        else if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) k.hints[k.current]?.apply()
        else if (e.key === 'Escape') k.hide()
        else return false
        e.preventDefault()
        return true
      }
    }
  })

  useImperativeHandle(ref, () => ({
    insert: (text) => {
      if (!editor) return
      const { from, to } = editor.state.selection
      editor.view.dispatch(editor.state.tr.insertText(text, from, to))
      editor.commands.focus()
    },
    focus: () => editor?.commands.focus()
  }))

  const found = useReferenceHints(before?.text ?? '', (next) => {
    if (!editor || !before) return
    let same = 0
    while (same < next.length && same < before.text.length && next[same] === before.text[same]) same++
    editor.view.dispatch(editor.state.tr.insertText(next.slice(same), before.start + same, before.end))
    editor.commands.focus()
  })
  const slash = before ? /^\/([\w-]*)$/.exec(before.text) : null
  const slashHints: Hint[] =
    slash && editor && before
      ? BLOCKS.filter((b) => !slash[1] || b.id.startsWith(slash[1].toLowerCase()) || b.title.toLowerCase().includes(slash[1].toLowerCase())).map((b) => ({
          key: `/${b.id}`,
          label: `/${b.id}`,
          detail: b.title,
          apply: () => {
            editor.chain().focus().deleteRange({ from: before.start, to: before.end }).run()
            b.run(editor)
          }
        }))
      : []
  const offered = slash ? slashHints : found
  const keys = offered.map((h) => h.key).join('|')
  useEffect(() => setPick(0), [keys])
  const hints = before && hiddenAt !== `${before.end}:${keys}` ? offered : []
  const current = Math.min(pick, Math.max(0, hints.length - 1))
  keyState.current = {
    hints,
    current,
    hide: () => before && setHiddenAt(`${before.end}:${keys}`),
    move: (d) => setPick((current + d + hints.length) % hints.length)
  }

  useEffect(() => {
    if (!editor || value === emitted.current) return
    emitted.current = value
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
  }, [value, editor])

  return (
    <div className={cn('seven-md-editor flex min-h-0 flex-col', compact ? 'seven-md-compact gap-1' : 'seven-md-doc', className)}>
      {!compact && !bar && title && <div className="seven-screen-tab">{title}</div>}
      <div ref={area} className={cn('flex min-h-0 flex-1 flex-col', !compact && !bar && 'seven-screen')}>
        <FloatingHints anchor={area} hints={hints} selected={current} onSelect={setPick} onClose={() => keyState.current.hide()} />
        {!compact &&
          (bar ? (
            <AddressTools>
              <EditorCommandBar editor={editor} bare />
            </AddressTools>
          ) : (
            <EditorCommandBar editor={editor} />
          ))}
        <div onClick={(e) => e.target === e.currentTarget && editor?.commands.focus('end')} className={cn('min-h-0 flex-1 cursor-text', compact ? 'border border-line/40 tone-panel-40 focus-within:border-accent/60' : 'seven-doc-bg overflow-y-auto')}>
          <EditorContent editor={editor} />
        </div>
      </div>
      {editor && <EditorBubble editor={editor} />}
    </div>
  )
})
