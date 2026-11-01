import { useRef, useState } from 'react'
import { AtSign, Dices, GripVertical, Trash2 } from 'lucide-react'
import type { LibraryHit } from '@shared/types'
import { linkFor } from '@shared/text'
import { InlineTitle, type ReorderProps } from '../../ui'
import { engine } from '../../../lib/ipc'
import { toast } from '../../../store/toasts'
import { Markdown } from '../../chat/Markdown'
import { EntryPicker } from '../../library/EntryPicker'
import { MarkdownEditor, type MarkdownEditorHandle } from '../MarkdownEditor'
import { cn } from '../../../lib/cn'
import { failed } from '../../../lib/notify'

function ToolButton({ active, title, onClick, children }: { active: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={cn('flex h-7 items-center gap-1 px-1.5 font-mono text-[10.5px] uppercase tracking-wider', active ? 'text-accent' : 'text-dim hover:text-accent')}>
      {children}
    </button>
  )
}

export function FieldCard({ name, value, drag, dragOver, onValue, onRename, onRemove, onDone }: { name: string; value: string; drag: ReorderProps; dragOver: boolean; onValue: (text: string) => void; onRename: (to: string) => void; onRemove: () => void; onDone: () => void }) {
  const [editing, setEditing] = useState(false)
  const [picker, setPicker] = useState<'roll' | 'link' | null>(null)
  const editor = useRef<MarkdownEditorHandle>(null)
  const insert = (text: string) => {
    if (editing && editor.current) return editor.current.insert(text)
    onValue(value.trim() ? `${value.trimEnd()} ${text}` : text)
    setEditing(true)
  }

  const roll = (hit: LibraryHit) => {
    setPicker(null)
    void engine('library.rollText', { text: `@repo:${hit.id}#random` })
      .then((r) => (r.rolled[0]?.error ? toast.error('Could not roll', r.rolled[0].error) : insert(r.text)))
      .catch(failed('Could not roll'))
  }

  return (
    <section {...(editing ? {} : drag)} className={cn('group/field flex min-w-0 flex-col border border-line/50 bg-black/60 transition-colors focus-within:border-accent/70 hover:border-line', dragOver && 'border-l-4 border-l-accent')}>
      <header className="relative flex items-center gap-1 border-b border-line/30 px-2 py-1.5">
        <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-faint opacity-0 group-hover/field:opacity-100" />
        <InlineTitle value={name} onSave={onRename} className="min-w-0 flex-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-accent-soft" />
        <ToolButton title="Roll a random value from a repo" active={picker === 'roll'} onClick={() => setPicker(picker === 'roll' ? null : 'roll')}>
          <Dices className="h-3.5 w-3.5" /> Roll
        </ToolButton>
        <ToolButton title="Link anything in Seven" active={picker === 'link'} onClick={() => setPicker(picker === 'link' ? null : 'link')}>
          <AtSign className="h-3.5 w-3.5" /> Link
        </ToolButton>
        <button title="Take off the sheet (its text is kept)" onClick={onRemove} className="flex h-7 w-7 items-center justify-center text-dim opacity-0 hover:text-alert group-hover/field:opacity-100">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        {picker === 'roll' && <EntryPicker kind="repo" title="Roll from a repo" onPick={roll} onClose={() => setPicker(null)} />}
        {picker === 'link' && (
          <EntryPicker
            kind={null}
            title="Link to"
            onPick={(hit) => {
              setPicker(null)
              insert(linkFor(hit.kind, hit.id))
            }}
            onClose={() => setPicker(null)}
          />
        )}
      </header>
      {editing ? (
        <div className="p-2">
          <MarkdownEditor
            ref={editor}
            compact
            rolls
            autoFocus
            value={value}
            onValue={onValue}
            onBlur={() => {
              if (picker) return
              setEditing(false)
              onDone()
            }}
            placeholder="Write it, or type @ to link anything"
          />
        </div>
      ) : value.trim() ? (
        <div role="button" tabIndex={0} onClick={() => setEditing(true)} onKeyDown={(e) => e.key === 'Enter' && setEditing(true)} className="cursor-text px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white/90 hover:bg-white/[0.02]">
          <Markdown text={value} />
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="px-3.5 py-4 text-left text-[12.5px] italic text-faint hover:text-dim">
          Empty. Click to write, or Roll / Link above.
        </button>
      )}
    </section>
  )
}
