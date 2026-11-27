import { avatarIdOfRef, type Avatar } from '@shared/avatars'
import { useAgents } from '../../../store/agents'
import { InlineEdit } from '../../ui'
import { LiveAvatar } from '../LiveAvatar'
import { SizeStrip } from './SizeStrip'
import { StageTools } from './StageTools'
import type { AvatarDraft } from './useAvatarDraft'
import type { PoseActions } from './poses'
import type { StagePreview } from './useStagePreview'

function StageMeta({ saved, builtin, createdBy }: { saved: Avatar | null; builtin: boolean; createdBy: string | null }) {
  const agents = useAgents((s) => s.list)
  const maker = createdBy ? (agents.find((a) => a.id === createdBy)?.name ?? 'an agent') : null
  const users = saved ? agents.filter((a) => avatarIdOfRef(a.look.avatar) === saved.id).map((a) => a.name) : []
  const facts = [builtin ? 'built in' : null, maker ? `by ${maker}` : null, users.length ? `on ${users.join(', ')}` : null].filter(Boolean)
  if (!facts.length) return null
  return <span className="font-label text-[10.5px] caps-10 text-faint">{facts.join(' · ')}</span>
}

export function AvatarStage({
  avatar,
  saved,
  draft,
  readOnly,
  set,
  preview,
  target,
  editing,
  actions
}: {
  avatar: Avatar
  saved: Avatar | null
  draft: AvatarDraft
  readOnly: boolean
  set: (patch: Partial<AvatarDraft>) => void
  preview: StagePreview
  target: string
  editing: string
  actions: PoseActions
}) {
  return (
    <div className="group/stage relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-5 overflow-hidden px-24 py-6 tablet:px-10">
      <LiveAvatar avatar={avatar} pose={preview.pose} target={target} className="aspect-square w-[min(100%,18rem)]" />
      <div className="flex max-w-full flex-col items-center gap-1 text-center">
        {readOnly ? (
          <span className="type-heading text-ink">{draft.name}</span>
        ) : (
          <InlineEdit value={draft.name} placeholder="Name" required title="Rename" onSave={(name) => set({ name })} className="type-heading text-ink" />
        )}
        {readOnly ? (
          draft.description && <span className="text-[12.5px] text-dim">{draft.description}</span>
        ) : (
          <InlineEdit value={draft.description} placeholder="Description" title="How it looks or reacts" onSave={(description) => set({ description })} className="text-[12.5px] text-dim" />
        )}
        <StageMeta saved={saved} builtin={readOnly} createdBy={draft.createdBy ?? null} />
      </div>
      <SizeStrip avatar={avatar} pose={preview.pose} className="absolute bottom-3 left-3 opacity-0 transition-opacity group-hover/stage:opacity-100 touch:opacity-100" />
      <StageTools preview={preview} editing={editing} actions={actions} />
    </div>
  )
}
