import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'
import { CommandButtons, MARKS } from './EditorCommandBar'

export function EditorBubble({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu editor={editor} className="z-50 border border-accent/60 bg-black/95 py-0.5 shadow-[0_6px_20px_rgba(0,0,0,0.6)]">
      <CommandButtons editor={editor} commands={MARKS} />
    </BubbleMenu>
  )
}
