import { useMemo } from 'react'
import { storyRefs, type Story } from '@shared/story'
import { Eyebrow } from '../../../ui'
import { useKindInfos } from '../../../../lib/kinds'
import { MentionChip } from './MentionChip'

export function StoryLinks({ story, self = null, onRelink }: { story: Story; self?: string | null; onRelink?: (kind: string, ref: string, to: string) => void }) {
  const kinds = useKindInfos()
  const groups = useMemo(() => {
    const by = new Map<string, ReturnType<typeof storyRefs>>()
    for (const r of storyRefs(story)) if (r.ref !== self) by.set(r.kind, [...(by.get(r.kind) ?? []), r])
    return [...by].map(([kind, refs]) => ({ kind, label: kinds.find((k) => k.kind === kind)?.label ?? kind, refs: refs.sort((a, b) => b.sessions.length - a.sessions.length) }))
  }, [story, kinds, self])
  if (!groups.length) return <div className="text-[12.5px] text-faint">Links you write with @ in sessions show up here: people, places, pages and files.</div>
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.kind} className="flex flex-col gap-1.5">
          <Eyebrow>{g.label}</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {g.refs.map((r) => (
              <MentionChip key={r.ref} kind={r.kind} ref={r.ref} count={r.sessions.length || undefined} onRelink={onRelink} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
