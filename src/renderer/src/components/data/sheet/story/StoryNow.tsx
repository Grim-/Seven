import { Compass, Flame, MapPin, Target, X } from 'lucide-react'
import type { Story, StoryThread } from '@shared/story'
import { Eyebrow, InlineEdit } from '../../../ui'
import { cn } from '../../../../lib/cn'

export function StoryNow({
  story,
  onChange,
  large = false,
  hideDone = false
}: {
  story: Story
  onChange: (story: Story) => void
  large?: boolean
  hideDone?: boolean
}) {
  const setThreads = (threads: StoryThread[]) => onChange({ ...story, threads })
  const saveField = (key: 'where' | 'doing' | 'goal' | 'mood', val: string) => {
    const trimmed = val.trim()
    if (key === 'where') onChange({ ...story, where: trimmed })
    else onChange({ ...story, [key]: trimmed || undefined })
  }

  if (large) {
    return (
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        <div className="flex flex-col gap-2 border border-line/40 bg-black/45 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <MapPin className="mt-1 h-4 w-4 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <Eyebrow className="text-[9.5px] text-dim">Where right now</Eyebrow>
              <InlineEdit
                value={story.where}
                placeholder="@place:... or current location"
                title="Where they are now"
                onSave={(v) => saveField('where', v)}
                className="text-[15px] font-semibold text-white"
              />
            </div>
          </div>
          <div className="flex items-start gap-2 border-t border-line/25 pt-2">
            <Compass className="mt-1 h-4 w-4 shrink-0 text-cyan" />
            <div className="min-w-0 flex-1">
              <Eyebrow className="text-[9.5px] text-dim">Doing right now</Eyebrow>
              <InlineEdit
                value={story.doing ?? ''}
                placeholder="What is the active scene or immediate action?"
                title="Doing right now"
                onSave={(v) => saveField('doing', v)}
                className="text-[13.5px] text-white/90"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border border-line/40 bg-black/45 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <Target className="mt-1 h-4 w-4 shrink-0 text-ok" />
            <div className="min-w-0 flex-1">
              <Eyebrow className="text-[9.5px] text-dim">Immediate goal / focus</Eyebrow>
              <InlineEdit
                value={story.goal ?? ''}
                placeholder="What are they actively trying to achieve next?"
                title="Immediate goal"
                onSave={(v) => saveField('goal', v)}
                className="text-[13.5px] text-white/90"
              />
            </div>
          </div>
          <div className="flex items-start gap-2 border-t border-line/25 pt-2">
            <Flame className="mt-1 h-4 w-4 shrink-0 text-warn" />
            <div className="min-w-0 flex-1">
              <Eyebrow className="text-[9.5px] text-dim">Posture / stakes</Eyebrow>
              <InlineEdit
                value={story.mood ?? ''}
                placeholder="Condition, mood, or immediate pressure (optional)"
                title="Posture or stakes"
                onSave={(v) => saveField('mood', v)}
                className="text-[13px] text-dim"
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <InlineEdit
        value={story.where}
        placeholder="Where are they now?"
        title="Where they are now"
        onSave={(v) => saveField('where', v)}
        className="text-[13.5px] text-white"
      />
      {story.doing && <div className="text-[12px] text-cyan/90">{story.doing}</div>}
      <Eyebrow className="mt-2 text-[10px]">Open threads</Eyebrow>
      {story.threads.map((t, i) =>
        hideDone && t.done ? null : (
          <div key={t.id ?? i} className="group flex items-baseline gap-2 text-[13px]">
            <button
              type="button"
              title={t.done ? 'Reopen' : 'Mark resolved'}
              onClick={() =>
                setThreads(
                  story.threads.map((x, j) =>
                    j === i ? { ...x, done: !x.done, status: !x.done ? 'resolved' : 'active' } : x
                  )
                )
              }
              className={cn(
                'h-3 w-3 shrink-0 translate-y-0.5 border',
                t.done ? 'border-faint bg-faint' : 'border-accent hover:bg-accent/30'
              )}
            />
            <InlineEdit
              value={t.text}
              required
              onSave={(text) => setThreads(story.threads.map((x, j) => (j === i ? { ...x, text } : x)))}
              className={cn('min-w-0 flex-1', t.done ? 'text-faint line-through' : 'text-white')}
            />
            <button
              type="button"
              title="Remove this thread"
              onClick={() => setThreads(story.threads.filter((_, j) => j !== i))}
              className="text-faint opacity-0 hover:text-alert group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      )}
      <InlineEdit
        value=""
        placeholder="+ add a thread"
        onSave={(text) => text && setThreads([...story.threads, { text, done: false }])}
        className="self-start text-[12px] text-faint hover:text-accent"
      />
    </div>
  )
}
