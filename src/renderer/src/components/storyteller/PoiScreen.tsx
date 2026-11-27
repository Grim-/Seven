import { MapPin } from 'lucide-react'
import { TagInput } from '../ui'
import type { KindScreenProps } from '../../registries/kinds'
import { Section, StoryText } from './StoryText'
import { cleanPoi, type Poi } from './model'
import { useModulePageState } from '../../lib/modulePage'
import { AddonPage, AddonTitle } from '../data/AddonPage'

function Editor({ pageId, title, start }: { pageId: string; title: string; start: Poi }) {
  const saver = useModulePageState<Poi>(pageId, start)
  const poi = saver.value
  const change = (patch: Partial<Poi>) => saver.set((p) => ({ ...p, ...patch }))
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto border border-line/60 tone-panel-70 p-4">
      <AddonTitle pageId={pageId} title={title} status={saver.status} error={saver.error} icon={<MapPin className="h-5 w-5 shrink-0 text-accent-soft" />} />
      <TagInput value={poi.tags} onChange={(tags) => change({ tags })} placeholder="Tags, e.g. tavern, city" />
      <Section title="Description" hint="What the place is like; type { to roll from a repo.">
        <StoryText value={poi.description} onValue={(description) => change({ description })} rows={8} placeholder="A crooked inn run by {innkeeper_names}…" />
      </Section>
    </div>
  )
}

export function PoiScreen({ id }: KindScreenProps) {
  return <AddonPage id={id} what="place" read={(data) => cleanPoi(data)} render={(page) => <Editor {...page} />} />
}
