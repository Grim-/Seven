import type { ReactNode } from 'react'
import { Activity as ActivityIcon, Crosshair, RotateCcw, Zap } from 'lucide-react'
import { ACTIVITIES, MOODS, REACTION_POSES, type Activity } from '@shared/moods'
import { vfxPresets } from '../../vfx'
import { Button, EdgeRail, Popover, RailButton, RailItem, Segmented, SquareIcon } from '../../ui'
import { MoodPad } from './MoodPad'
import { openPoseMenu, type PoseActions } from './poses'
import { REST_ACTIVITY, type StagePreview } from './useStagePreview'

const ACTIVITY_OPTIONS = ACTIVITIES.map((a) => ({ value: a.name as Activity, label: a.label }))

function RailPopover({ label, icon, active, children }: { label: string; icon: ReactNode; active?: boolean; children: ReactNode }) {
  return (
    <RailItem label={label}>
      <Popover title={label} trigger={<SquareIcon active={active}>{icon}</SquareIcon>} className="flex flex-col gap-2 p-2.5">
        {children}
      </Popover>
    </RailItem>
  )
}

function TestButtons({ items }: { items: { id: string; label: string; onClick: () => void }[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((i) => (
        <Button key={i.id} size="sm" variant="badge" onClick={i.onClick}>
          {i.label}
        </Button>
      ))}
    </div>
  )
}

export function StageTools({ preview, editing, actions }: { preview: StagePreview; editing: string; actions: PoseActions }) {
  const marks = MOODS.map((m) => ({ name: m.name, label: m.label, energy: m.energy, warmth: m.warmth, marked: actions.marked.includes(m.name) }))
  return (
    <EdgeRail>
      <RailPopover label="Doing" icon={<ActivityIcon />} active={preview.activity !== REST_ACTIVITY}>
        <Segmented value={preview.activity} options={ACTIVITY_OPTIONS} onChange={preview.setActivity} wrap />
      </RailPopover>
      <RailPopover label="Mood" icon={<Crosshair />} active={Boolean(preview.dials)}>
        <MoodPad value={preview.dials} marks={marks} active={editing} onChange={preview.setDials} onPick={actions.onPick} onMenu={(e, key) => openPoseMenu(e, key, actions)} className="w-56" />
      </RailPopover>
      <RailPopover label="Test" icon={<Zap />}>
        <span className="type-eyebrow text-faint">Reactions</span>
        <TestButtons items={REACTION_POSES.map((r) => ({ id: r.name, label: r.label, onClick: () => preview.react(r.name) }))} />
        <span className="type-eyebrow text-faint">Effects</span>
        <TestButtons items={vfxPresets().map((p) => ({ id: p.id, label: p.label, onClick: () => preview.effect(p.id) }))} />
      </RailPopover>
      <RailButton label="Reset" onClick={() => preview.show(editing)}>
        <RotateCcw />
      </RailButton>
    </EdgeRail>
  )
}
