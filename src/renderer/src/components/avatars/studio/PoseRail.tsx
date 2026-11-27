import type { KeyboardEvent } from 'react'
import type { Avatar } from '@shared/avatars'
import { cn } from '../../../lib/cn'
import { UP_DOWN, stepByKey } from '../../../lib/stepKeys'
import { LiveAvatar } from '../LiveAvatar'
import { ALL_POSES, POSE_GROUPS, openPoseMenu, previewPose, type PoseActions, type PoseEntry } from './poses'

function PoseRow({ avatar, pose, active, marked, actions }: { avatar: Avatar; pose: PoseEntry; active: boolean; marked: boolean; actions: PoseActions }) {
  return (
    <button
      type="button"
      data-pose={pose.key}
      title={marked ? `${pose.label}: has its own look` : pose.label}
      onClick={() => actions.onPick(pose.key)}
      onContextMenu={(e) => openPoseMenu(e, pose.key, actions)}
      className={cn('group flex items-center gap-2 border-l-2 py-1 pl-1.5 pr-2 text-left outline-none focus-visible:bg-ink/[0.05]', active ? 'border-l-accent bg-accent/10' : 'border-l-transparent hover:bg-ink/[0.04]')}
    >
      <LiveAvatar avatar={avatar} pose={previewPose(pose.key)} target={`studio-pose:${pose.key}`} size={26} className={cn(!active && 'border-line')} />
      <span className={cn('min-w-0 flex-1 truncate text-[12px] phone:hidden', active ? 'text-ink' : 'text-dim group-hover:text-ink')}>{pose.label}</span>
      {marked && <span className="h-1.5 w-1.5 shrink-0 bg-accent" />}
    </button>
  )
}

export function PoseRail({ avatar, editing, actions, className }: { avatar: Avatar; editing: string; actions: PoseActions; className?: string }) {
  const keys = (e: KeyboardEvent<HTMLElement>) => {
    const at = stepByKey(e, ALL_POSES.findIndex((p) => p.key === editing), ALL_POSES.length, UP_DOWN)
    if (at === null) return
    const next = ALL_POSES[at]
    actions.onPick(next.key)
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-pose="${next.key}"]`)?.focus()
  }
  return (
    <nav aria-label="Poses" onKeyDown={keys} className={cn('flex flex-col gap-3 overflow-y-auto py-2', className)}>
      {POSE_GROUPS.map((group) => (
        <div key={group.label ?? 'base'} className="flex flex-col gap-px">
          {group.label && <span className="type-eyebrow px-2 pb-1 text-faint phone:hidden">{group.label}</span>}
          {group.poses.map((pose) => (
            <PoseRow key={pose.key} avatar={avatar} pose={pose} active={pose.key === editing} marked={actions.marked.includes(pose.key)} actions={actions} />
          ))}
        </div>
      ))}
    </nav>
  )
}
