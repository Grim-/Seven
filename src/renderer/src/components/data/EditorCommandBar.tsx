import type { Ctx } from '@milkdown/kit/ctx'
import { commandsCtx, editorViewCtx, type CmdKey } from '@milkdown/kit/core'
import { addBlockTypeCommand, createCodeBlockCommand, insertHrCommand, listItemSchema, toggleEmphasisCommand, toggleInlineCodeCommand, toggleStrongCommand, turnIntoTextCommand, wrapInBlockTypeCommand, wrapInBlockquoteCommand, wrapInBulletListCommand, wrapInHeadingCommand, wrapInOrderedListCommand } from '@milkdown/kit/preset/commonmark'
import { insertTableCommand, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm'
import { imageBlockSchema } from '@milkdown/kit/component/image-block'
import type { EditorState } from '@milkdown/kit/prose/state'
import { pickPicture } from './PicturePicker'
import { cn } from '../../lib/cn'

export interface EditorAt {
  block: string
  marks: string[]
}

export function editorAt(state: EditorState): EditorAt {
  const { $from } = state.selection
  const node = $from.parent
  return {
    block: node.type.name === 'heading' ? `h${node.attrs.level}` : node.type.name,
    marks: (state.storedMarks ?? $from.marks()).map((m) => m.type.name)
  }
}

type Run = (work: (ctx: Ctx) => void) => void

interface Command {
  label: string
  title: string
  on?: (at: EditorAt) => boolean
  run: (ctx: Ctx, run: Run) => void
}

const call =
  <T,>(key: CmdKey<T>, payload?: T) =>
  (ctx: Ctx) =>
    void ctx.get(commandsCtx).call(key, payload)

const GROUPS: Command[][] = [
  [
    { label: '¶', title: 'Text', on: (at) => at.block === 'paragraph', run: call(turnIntoTextCommand.key) },
    { label: 'H1', title: 'Heading 1', on: (at) => at.block === 'h1', run: call(wrapInHeadingCommand.key, 1) },
    { label: 'H2', title: 'Heading 2', on: (at) => at.block === 'h2', run: call(wrapInHeadingCommand.key, 2) },
    { label: 'H3', title: 'Heading 3', on: (at) => at.block === 'h3', run: call(wrapInHeadingCommand.key, 3) }
  ],
  [
    { label: 'B', title: 'Bold', on: (at) => at.marks.includes('strong'), run: call(toggleStrongCommand.key) },
    { label: 'I', title: 'Italic', on: (at) => at.marks.includes('emphasis'), run: call(toggleEmphasisCommand.key) },
    { label: 'S', title: 'Strikethrough', on: (at) => at.marks.includes('strike_through'), run: call(toggleStrikethroughCommand.key) },
    { label: '</>', title: 'Inline code', on: (at) => at.marks.includes('inlineCode'), run: call(toggleInlineCodeCommand.key) }
  ],
  [
    { label: '• List', title: 'Bullet list', run: call(wrapInBulletListCommand.key) },
    { label: '1. List', title: 'Numbered list', run: call(wrapInOrderedListCommand.key) },
    { label: '☐ Task', title: 'Task list', run: (ctx) => void ctx.get(commandsCtx).call(wrapInBlockTypeCommand.key, { nodeType: listItemSchema.type(ctx), attrs: { checked: false } }) }
  ],
  [
    {
      label: '@ Link',
      title: 'Link anything in Seven',
      run: (ctx) => {
        const view = ctx.get(editorViewCtx)
        const { from, to } = view.state.selection
        view.dispatch(view.state.tr.insertText('@', from, to))
      }
    },
    {
      label: 'Image',
      title: 'Picture from Seven or your computer',
      run: (_ctx, run) =>
        void pickPicture(null).then((picked) => {
          if (picked?.id) run((ctx) => void ctx.get(commandsCtx).call(addBlockTypeCommand.key, { nodeType: imageBlockSchema.type(ctx), attrs: { src: `seven:file/${picked.id}` } }))
        })
    },
    { label: 'Table', title: 'Table', run: call(insertTableCommand.key, { row: 3, col: 3 }) },
    { label: 'Code', title: 'Code block', on: (at) => at.block === 'code_block', run: call(createCodeBlockCommand.key) },
    { label: 'Quote', title: 'Quote', run: call(wrapInBlockquoteCommand.key) },
    { label: '—', title: 'Divider', run: call(insertHrCommand.key) }
  ]
]

export function EditorCommandBar({ at, run }: { at: EditorAt; run: Run }) {
  return (
    <div className="flex flex-wrap items-stretch border border-b-0 border-line/40 bg-black/60 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em]">
      {GROUPS.map((group, i) => (
        <div key={i} className="flex border-r border-line/40">
          {group.map((c) => (
            <button
              key={c.label}
              type="button"
              title={c.title}
              onMouseDown={(e) => {
                e.preventDefault()
                run((ctx) => c.run(ctx, run))
              }}
              className={cn('border-b-2 px-2.5 py-2', c.on?.(at) ? 'border-accent bg-accent/15 text-white' : 'border-transparent text-dim hover:bg-accent/10 hover:text-white')}
            >
              {c.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
