import type { Story } from '@shared/story'
import { StoryNow } from '../story/StoryNow'
import { Section } from './Section'

export function StoryLog({ story, onChange, onOpen }: { story: Story; onChange: (story: Story) => void; onOpen: () => void }) {
  const last = story.sessions[story.sessions.length - 1]
  return (
    <Section title="Now" action={<button onClick={onOpen} className="font-ui text-[11px] text-faint hover:text-accent">Story ›</button>}>
      <StoryNow story={story} onChange={onChange} hideDone />
      {last && (
        <button onClick={onOpen} className="mt-1 border-t border-line/30 pt-1.5 text-left text-[12px] text-dim hover:text-ink">
          <span className="font-ui text-[10.5px] text-faint">Session {story.sessions.length}{last.title ? ` · ${last.title}` : ''}</span>
          <span className="line-clamp-3 block">{last.notes.trim() || 'No notes yet.'}</span>
        </button>
      )}
    </Section>
  )
}
