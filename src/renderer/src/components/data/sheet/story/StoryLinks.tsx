import { useMemo } from 'react'
import { storyRefs, type Story } from '@shared/story'
import { Eyebrow } from '../../../ui'
import { useKindInfos } from '../../../../lib/kinds'
import { RefChip } from './RefChip'

export function StoryLinks({ story }: { story: Story }) {
  const kinds = useKindInfos()
  const groups = useMemo(() => {
    const by = new Map<string, ReturnType<typeof storyRefs>>()
    for (const r of storyRefs(story)) by.set(r.kind, [...(by.get(r.kind) ?? []), r])
    return [...by].map(([kind, refs]) => ({ kind, label: kinds.find((k) => k.kind === kind)?.label ?? kind, refs: refs.sort((a, b) => b.sessions.length - a.sessions.length) }))
  }, [story, kinds])
  if (!groups.length) return <div className="text-[12.5px] text-faint">Links you write with @ in sessions show up here: people, places, pages and files.</div>
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.kind} className="flex flex-col gap-1.5">
          <Eyebrow>{g.label}</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {g.refs.map((r) => (
              <RefChip key={r.ref} kind={r.kind} ref={r.ref} count={r.sessions.length || undefined} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
