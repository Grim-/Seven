import { X } from 'lucide-react'
import type { Story, StoryThread } from '@shared/story'
import { Eyebrow, InlineEdit } from '../../../ui'
import { cn } from '../../../../lib/cn'

export function StoryNow({ story, onChange, large = false, hideDone = false }: { story: Story; onChange: (story: Story) => void; large?: boolean; hideDone?: boolean }) {
  const setThreads = (threads: StoryThread[]) => onChange({ ...story, threads })
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <InlineEdit value={story.where} placeholder="Where are they now?" title="Where they are now" onSave={(where) => onChange({ ...story, where })} className={cn('text-white', large ? 'text-[18px]' : 'text-[13.5px]')} />
      <Eyebrow className="mt-2 text-[10px]">Open threads</Eyebrow>
      {story.threads.map((t, i) =>
        hideDone && t.done ? null : (
          <div key={i} className="group flex items-baseline gap-2 text-[13px]">
            <button title={t.done ? 'Reopen' : 'Mark resolved'} onClick={() => setThreads(story.threads.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} className={cn('h-3 w-3 shrink-0 translate-y-0.5 border', t.done ? 'border-faint bg-faint' : 'border-accent hover:bg-accent/30')} />
            <InlineEdit value={t.text} required onSave={(text) => setThreads(story.threads.map((x, j) => (j === i ? { ...x, text } : x)))} className={cn('min-w-0 flex-1', t.done ? 'text-faint line-through' : 'text-white')} />
            <button title="Remove this thread" onClick={() => setThreads(story.threads.filter((_, j) => j !== i))} className="text-faint opacity-0 hover:text-alert group-hover:opacity-100">
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      )}
      <InlineEdit value="" placeholder="+ add a thread" onSave={(text) => text && setThreads([...story.threads, { text, done: false }])} className="self-start text-[12px] text-faint hover:text-accent" />
    </div>
  )
}
