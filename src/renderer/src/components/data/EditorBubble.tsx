import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'
import { CommandButtons, MARKS } from './EditorCommandBar'

export function EditorBubble({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu editor={editor} className="z-50 border border-accent/60 tone-panel-95 py-0.5 shadow-[0_6px_20px_color-mix(in_srgb,var(--color-shade)_60%,transparent)]">
      <CommandButtons editor={editor} commands={MARKS} />
    </BubbleMenu>
  )
}
