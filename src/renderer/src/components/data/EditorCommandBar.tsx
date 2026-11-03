import type { ReactNode } from 'react'
import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { AtSign, Bold, Code, Columns3, Heading1, Heading2, Heading3, ImagePlus, Italic, Link, List, ListChecks, ListOrdered, Minus, Pilcrow, Rows3, SquareCode, Strikethrough, Table, TextQuote, Trash2 } from 'lucide-react'
import { askText, Select } from '../ui'
import { pickPicture } from './PicturePicker'
import { cn } from '../../lib/cn'

export interface EditorCommand {
  id: string
  title: string
  icon: ReactNode
  on?: (e: Editor) => boolean
  run: (e: Editor) => void
}

const LISTS = ['bulletList', 'orderedList', 'taskList']
const icon = (Icon: typeof Bold) => <Icon className="h-4 w-4" />

function insertTable(e: Editor): void {
  const { $from } = e.state.selection
  for (let d = $from.depth; d > 0; d--) {
    if (!LISTS.includes($from.node(d).type.name)) continue
    const after = $from.after(d)
    e.chain().focus().insertContentAt(after, { type: 'paragraph' }).setTextSelection(after + 1).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    return
  }
  e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

function editLink(e: Editor): void {
  const current = String(e.getAttributes('link').href ?? '')
  askText('Link', 'Address (empty removes the link)', current, (href) => {
    const clean = href.trim()
    if (clean) e.chain().focus().extendMarkRange('link').setLink({ href: clean }).run()
    else e.chain().focus().extendMarkRange('link').unsetLink().run()
  }, { optional: true })
}

export const MARKS: EditorCommand[] = [
  { id: 'bold', title: 'Bold', icon: icon(Bold), on: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
  { id: 'italic', title: 'Italic', icon: icon(Italic), on: (e) => e.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
  { id: 'strike', title: 'Strikethrough', icon: icon(Strikethrough), on: (e) => e.isActive('strike'), run: (e) => e.chain().focus().toggleStrike().run() },
  { id: 'code', title: 'Inline code', icon: icon(Code), on: (e) => e.isActive('code'), run: (e) => e.chain().focus().toggleCode().run() },
  { id: 'link', title: 'Web link', icon: icon(Link), on: (e) => e.isActive('link'), run: editLink }
]

export const BLOCKS: EditorCommand[] = [
  { id: 'text', title: 'Text', icon: icon(Pilcrow), on: (e) => e.isActive('paragraph'), run: (e) => e.chain().focus().setParagraph().run() },
  { id: 'h1', title: 'Heading 1', icon: icon(Heading1), on: (e) => e.isActive('heading', { level: 1 }), run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: 'h2', title: 'Heading 2', icon: icon(Heading2), on: (e) => e.isActive('heading', { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: 'h3', title: 'Heading 3', icon: icon(Heading3), on: (e) => e.isActive('heading', { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { id: 'list', title: 'Bullet list', icon: icon(List), on: (e) => e.isActive('bulletList'), run: (e) => e.chain().focus().toggleBulletList().run() },
  { id: 'numbered', title: 'Numbered list', icon: icon(ListOrdered), on: (e) => e.isActive('orderedList'), run: (e) => e.chain().focus().toggleOrderedList().run() },
  { id: 'task', title: 'Task list', icon: icon(ListChecks), on: (e) => e.isActive('taskList'), run: (e) => e.chain().focus().toggleTaskList().run() },
  { id: 'table', title: 'Table', icon: icon(Table), on: (e) => e.isActive('table'), run: insertTable },
  {
    id: 'image',
    title: 'Picture from Seven or your computer',
    icon: icon(ImagePlus),
    run: (e) =>
      void pickPicture(null).then((picked) => {
        if (picked?.id) e.chain().focus().setImage({ src: `seven:file/${picked.id}` }).run()
      })
  },
  { id: 'quote', title: 'Quote', icon: icon(TextQuote), on: (e) => e.isActive('blockquote'), run: (e) => e.chain().focus().toggleBlockquote().run() },
  { id: 'codeblock', title: 'Code block', icon: icon(SquareCode), on: (e) => e.isActive('codeBlock'), run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { id: 'divider', title: 'Divider', icon: icon(Minus), run: (e) => e.chain().focus().setHorizontalRule().run() }
]

const LINK_ANYTHING: EditorCommand = { id: 'at', title: 'Link anything in Seven', icon: icon(AtSign), run: (e) => e.chain().focus().insertContent('@').run() }

const TABLE: EditorCommand[] = [
  { id: 'row', title: 'Add a row below', icon: icon(Rows3), run: (e) => e.chain().focus().addRowAfter().run() },
  { id: 'column', title: 'Add a column to the right', icon: icon(Columns3), run: (e) => e.chain().focus().addColumnAfter().run() },
  { id: 'droprow', title: 'Remove this row', icon: <span className="font-mono text-[11px]">−row</span>, run: (e) => e.chain().focus().deleteRow().run() },
  { id: 'dropcolumn', title: 'Remove this column', icon: <span className="font-mono text-[11px]">−col</span>, run: (e) => e.chain().focus().deleteColumn().run() },
  { id: 'droptable', title: 'Delete the table', icon: icon(Trash2), run: (e) => e.chain().focus().deleteTable().run() }
]

export function CommandButtons({ editor, commands }: { editor: Editor; commands: EditorCommand[] }) {
  return (
    <div className="flex items-center gap-0.5 px-1">
      {commands.map((c) => (
        <button
          key={c.id}
          type="button"
          title={c.title}
          aria-label={c.title}
          onMouseDown={(ev) => {
            ev.preventDefault()
            c.run(editor)
          }}
          className={cn('flex h-8 min-w-8 items-center justify-center px-1.5', c.on?.(editor) ? 'bg-accent/20 text-accent' : 'text-dim hover:bg-accent/10 hover:text-white')}
        >
          {c.icon}
        </button>
      ))}
    </div>
  )
}

const HEADINGS = BLOCKS.slice(0, 4)

export function EditorCommandBar({ editor }: { editor: Editor | null }) {
  const state = useEditorState({ editor, selector: (ctx) => ({ step: ctx.transactionNumber, table: ctx.editor?.isActive('table') ?? false, block: HEADINGS.find((h) => ctx.editor && h.on?.(ctx.editor))?.id ?? 'text' }) })
  if (!editor || !state) return null
  return (
    <div className="flex flex-wrap items-center divide-x divide-line/40 border-b border-line/50 bg-black/60 py-1">
      <div className="px-1.5">
        <Select value={state.block} options={HEADINGS.map((h) => ({ value: h.id, label: h.title }))} onChange={(id) => HEADINGS.find((h) => h.id === id)?.run(editor)} className="h-8 w-32 text-[12.5px]" />
      </div>
      <CommandButtons editor={editor} commands={MARKS} />
      <CommandButtons editor={editor} commands={BLOCKS.slice(4, 7)} />
      <CommandButtons editor={editor} commands={[LINK_ANYTHING, ...BLOCKS.slice(7)]} />
      {state.table && <CommandButtons editor={editor} commands={TABLE} />}
    </div>
  )
}
