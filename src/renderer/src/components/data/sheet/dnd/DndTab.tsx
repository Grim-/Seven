import { Swords } from 'lucide-react'
import { blankDnd, type DndStats } from '@shared/dnd'
import type { Story } from '@shared/story'
import { Button, askConfirm } from '../../../ui'
import { AbilityScores } from './AbilityScores'
import { Attacks } from './Attacks'
import { Conditions } from './Conditions'
import { ExtraStats } from './ExtraStats'
import { Features } from './Features'
import { Gear } from './Gear'
import { Identity } from './Identity'
import { Proficiencies } from './Proficiencies'
import { Spells } from './Spells'
import { StoryLog } from './StoryLog'
import { Vitals } from './Vitals'

export function DndTab({ dnd, onChange, story, onStory, onOpenStory }: { dnd: DndStats | null; onChange: (dnd: DndStats | null) => void; story: Story; onStory: (story: Story) => void; onOpenStory: () => void }) {
  if (!dnd)
    return (
      <div className="flex flex-col items-start gap-3 p-5">
        <div className="text-[13px] text-dim">This character has no D&D stats yet.</div>
        <Button variant="primary" icon={<Swords />} onClick={() => onChange(blankDnd())}>
          Add D&D stats
        </Button>
      </div>
    )
  const patch = (p: Partial<DndStats>) => onChange({ ...dnd, ...p })
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-2.5 p-4">
      <Identity dnd={dnd} onChange={patch} />
      <Vitals dnd={dnd} onChange={patch} />
      <div className="grid grid-cols-1 items-start gap-2.5 lg:grid-cols-[17rem_minmax(0,1fr)] 2xl:grid-cols-[17rem_minmax(0,1fr)_21rem]">
        <div className="flex min-w-0 flex-col gap-2.5">
          <AbilityScores dnd={dnd} onChange={patch} />
          <ExtraStats dnd={dnd} onChange={patch} />
        </div>
        <div className="flex min-w-0 flex-col gap-2.5">
          <Conditions dnd={dnd} onChange={patch} />
          <Attacks dnd={dnd} onChange={patch} />
          <Gear dnd={dnd} onChange={patch} />
          <Spells dnd={dnd} onChange={patch} />
          <Features dnd={dnd} onChange={patch} />
        </div>
        <div className="flex min-w-0 flex-col gap-2.5 lg:col-start-2 2xl:col-start-auto">
          <StoryLog story={story} onChange={onStory} onOpen={onOpenStory} />
          <Proficiencies dnd={dnd} onChange={patch} />
        </div>
      </div>
      <button onClick={() => askConfirm('Remove the D&D stats?', 'Stats, gear and spells are removed from this character. The story stays.', 'Remove', () => onChange(null))} className="self-start text-[12px] text-faint hover:text-alert">
        Remove D&D stats
      </button>
    </div>
  )
}
