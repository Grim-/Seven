import { Input, TextCards } from '../ui'
import { Section, StoryText } from './StoryText'
import type { Act } from './model'

export function ActEditor({ act, index, onChange }: { act: Act; index: number; onChange: (act: Act) => void }) {
  const set = (patch: Partial<Act>) => onChange({ ...act, ...patch })
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="font-label text-[11px] caps-16 text-faint">Act {index + 1}</span>
        <Input value={act.name} onChange={(e) => set({ name: e.target.value })} placeholder="Name this act, e.g. The Descent" className="h-9 flex-1 text-[16px] font-semibold" />
      </div>
      <Section title="What happens" hint="The beat the storyteller steers towards in this act.">
        <StoryText value={act.story_beat} onValue={(story_beat) => set({ story_beat })} rows={4} placeholder="The party reaches {location} and finds the {artifact} already taken…" />
      </Section>
      <Section title="It ends when" hint="What has to happen before the story moves to the next act.">
        <StoryText value={act.transition_threshold} onValue={(transition_threshold) => set({ transition_threshold })} rows={2} placeholder="They learn who took it, or lose the trail." />
      </Section>
      <Section title="Possible turns" hint="Twists the storyteller can pick from in this act; one is rolled.">
        <TextCards
          values={act.branches.map((b) => b.content)}
          onChange={(list) => set({ branches: list.map((content) => ({ content })) })}
          addLabel="Add a turn"
          empty="No turns yet. Add a few so each run plays out differently."
          editor={(value, setValue) => <StoryText value={value} onValue={setValue} rows={2} placeholder="A rival from {faction} arrives first…" />}
        />
      </Section>
    </div>
  )
}
