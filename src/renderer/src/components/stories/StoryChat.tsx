import { EmptyState } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { formatRelative } from '../../lib/format'
import { cn } from '../../lib/cn'
import { EntryCard, Facts, Loading, BigStat } from '../entries/EntryCard'
import type { EntrySurfaceProps } from '../../registries/kinds'

function useStory(id: string) {
  const list = useLive(() => engine('stories.list'), 'stories.changed')
  return { list, story: list?.find((s) => s.id === id) }
}

function StoryView({ id, large }: { id: string; large: boolean }) {
  const { list, story } = useStory(id)
  if (!list) return <Loading />
  if (!story) return <EmptyState title="Removed">This story no longer exists.</EmptyState>
  return (
    <EntryCard title={story.id} tag="story" aside={<span className="font-mono text-[11px] uppercase text-faint">{story.status}</span>} className={cn(large && 'text-[15px]')}>
      <Facts rows={[['Template', story.template], ['Act', String(story.act)], ['Turn', String(story.turn)], ['Last', formatRelative(story.at)]]} />
      {story.note && <div className="text-dim">{story.note}</div>}
    </EntryCard>
  )
}

export function StoryChat({ id }: EntrySurfaceProps) {
  return <StoryView id={id} large={false} />
}

export function StoryStage({ id }: EntrySurfaceProps) {
  return <StoryView id={id} large />
}

export function StoryWidget({ id }: EntrySurfaceProps) {
  const { story } = useStory(id)
  if (!story) return <Loading />
  return (
    <div className="flex flex-col gap-2">
      <BigStat value={`Act ${story.act}`} label={`turn ${story.turn} · ${story.status}`} />
      {story.note && <span className="text-[12px] text-dim">{story.note}</span>}
    </div>
  )
}
