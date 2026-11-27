import { SegmentBar } from '../ui'
import { useState } from 'react'
import { Check, ChevronRight, ListTodo, X } from 'lucide-react'
import type { TodoItem } from '@shared/types'
import { useSessions } from '../../store/sessions'
import { cn } from '../../lib/cn'
import { failed } from '../../lib/notify'
import { useConversation } from '../../lib/conversation'

export function TodoBar({ compact }: { compact: boolean }) {
  const { sessionId } = useConversation()
  const list = useSessions((s) => (sessionId ? s.todos[sessionId] : null))
  const setTodos = useSessions((s) => s.setTodos)
  const [open, setOpen] = useState(!compact)
  if (!sessionId || !list || !list.items.length) return null
  const items = list.items
  const done = items.filter((i) => i.status === 'done').length
  const doing = items.find((i) => i.status === 'doing')
  const save = (next: TodoItem[]) => void setTodos(sessionId, next).catch(failed('Could not change the list'))
  const toggle = (id: string) => save(items.map((i) => (i.id === id ? { ...i, status: i.status === 'done' ? 'pending' : 'done' } : i)))
  return (
    <div className={cn('border-t border-line/60 tone-panel-80', compact ? 'px-2 py-1.5' : 'px-3 py-2')}>
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-accent transition-transform', open && 'rotate-90')} />
          <ListTodo className="h-3.5 w-3.5 shrink-0 text-accent" />
          <span className="shrink-0 font-label text-[10.5px] font-bold caps-16 text-accent-soft">
            Tasks {done}/{items.length}
          </span>
          {!open && doing && <span className="min-w-0 truncate text-[12px] text-ink/85">{doing.task}</span>}
        </button>
        <SegmentBar value={done / items.length} segments={Math.min(items.length, 24)} className="w-20 shrink-0" />
        {done === items.length && (
          <button title="Clear the list" onClick={() => save([])} className="text-faint hover:text-ink">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className={cn('mt-1.5 flex flex-col gap-0.5 overflow-y-auto', compact ? 'max-h-32' : 'max-h-48')}>
          {items.map((item) => (
            <button key={item.id} onClick={() => toggle(item.id)} className="flex items-start gap-2 py-0.5 text-left">
              <span
                className={cn(
                  'mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center border',
                  item.status === 'done' ? 'border-ok bg-ok/20 text-ok' : item.status === 'doing' ? 'animate-pulse border-accent bg-accent/20' : 'border-line'
                )}
              >
                {item.status === 'done' && <Check className="h-3 w-3" />}
              </span>
              <span className={cn('text-[12.5px] leading-snug', item.status === 'done' ? 'text-faint line-through' : item.status === 'doing' ? 'text-ink' : 'text-ink/80')}>{item.task}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
