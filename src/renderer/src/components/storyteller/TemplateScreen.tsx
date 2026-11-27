import { useState } from 'react'
import { ScrollText } from 'lucide-react'
import { EmptyState, TagInput, TextCards } from '../ui'
import type { KindScreenProps } from '../../registries/kinds'
import { ActEditor } from './ActEditor'
import { ActList } from './ActList'
import { Section, StoryText } from './StoryText'
import { blankAct, cleanTemplate, type StoryTemplate } from './model'
import { useModulePageState } from '../../lib/modulePage'
import { AddonPage, AddonTitle } from '../data/AddonPage'

function Editor({ pageId, title, start }: { pageId: string; title: string; start: StoryTemplate }) {
  const [act, setAct] = useState(0)
  const saver = useModulePageState<StoryTemplate>(pageId, start)
  const template = saver.value
  const change = (patch: Partial<StoryTemplate>) => saver.set((t) => ({ ...t, ...patch }))
  const current = template.acts[act]
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto border border-line/60 tone-panel-70 p-4">
      <AddonTitle pageId={pageId} title={title} status={saver.status} error={saver.error} icon={<ScrollText className="h-5 w-5 shrink-0 text-accent-soft" />} />
      <TagInput value={template.tags} onChange={(tags) => change({ tags })} placeholder="Tags, e.g. horror, short" />
      <div className="text-[12px] text-dim">
        Type <span className="font-ui text-secondary">{'{'}</span> in any box to roll from one of your repos when the story starts, e.g. <span className="font-ui text-secondary">{'{villain_names}'}</span>.
      </div>
      <Section title="The world and its rules" hint="Kept in mind for the whole story.">
        <StoryText value={template.story_notes} onValue={(story_notes) => change({ story_notes })} rows={5} placeholder="A drowned city ruled by {faction}. Magic always costs a memory…" />
      </Section>
      <Section title="How it can begin" hint="One opening is rolled when a story starts.">
        <TextCards
          values={template.callToActionOptions.map((c) => c.content)}
          onChange={(list) => change({ callToActionOptions: list.map((content) => ({ content })) })}
          addLabel="Add an opening"
          empty="No openings yet."
          editor={(value, set) => <StoryText value={value} onValue={set} rows={2} placeholder="A letter arrives from {npc_name}…" />}
        />
      </Section>
      <Section title="Acts" hint="The story moves through these in order.">
        <div className="flex min-h-[22rem] gap-4 border border-line/40 tone-panel-40 p-3">
          <ActList
            acts={template.acts}
            selected={act}
            onSelect={setAct}
            onChange={(acts) => change({ acts })}
            onAdd={() => {
              change({ acts: [...template.acts, blankAct(template.acts.length + 1)] })
              setAct(template.acts.length)
            }}
          />
          {current ? (
            <ActEditor key={act} act={current} index={act} onChange={(next) => change({ acts: template.acts.map((a, i) => (i === act ? next : a)) })} />
          ) : (
            <EmptyState title="No acts yet">Add an act to give the story its shape.</EmptyState>
          )}
        </div>
      </Section>
    </div>
  )
}

export function TemplateScreen({ id }: KindScreenProps) {
  return <AddonPage id={id} what="template" read={cleanTemplate} render={(page) => <Editor {...page} />} />
}
