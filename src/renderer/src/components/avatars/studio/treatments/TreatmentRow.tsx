import { useMemo, type ReactNode } from 'react'
import { avatarTreatmentInfo, type Avatar, type TreatmentEntry } from '@shared/avatars'
import { cn } from '../../../../lib/cn'
import { IconActions, Toggle, openMenu, type MenuItem, type ReorderProps } from '../../../ui'
import { LiveAvatar } from '../../LiveAvatar'
import { wearing } from './thumb'

export function TreatmentRow({
  avatar,
  entry,
  open,
  on,
  marked,
  actions,
  reorder,
  over,
  onPick,
  onToggle,
  children
}: {
  avatar: Avatar
  entry: TreatmentEntry
  open: boolean
  on: boolean
  marked: boolean
  actions: MenuItem[]
  reorder: ReorderProps
  over: boolean
  onPick: () => void
  onToggle: (on: boolean) => void
  children: ReactNode
}) {
  const label = avatarTreatmentInfo(entry.type)?.label ?? entry.type
  const thumb = useMemo(() => wearing(avatar, entry), [avatar, entry])
  return (
    <div data-treatment={entry.key} onContextMenu={(e) => openMenu(e, label, actions)} className={cn('group flex flex-col border-l-2', open ? 'border-l-accent bg-accent/[0.06]' : 'border-l-transparent hover:bg-ink/[0.03]', over && 'shadow-[inset_0_2px_0_var(--color-accent)]')}>
      <div {...reorder} className="flex items-center gap-2 py-1.5 pl-2 pr-2.5">
        <div role="button" tabIndex={0} onClick={onPick} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 outline-none">
          <LiveAvatar avatar={thumb} size={32} target={`studio-treatment:${entry.key}`} className={cn(!on && 'opacity-40')} />
          <span className={cn('truncate text-[12.5px]', on ? 'text-ink' : 'text-faint')}>{label}</span>
          {marked && <span title="Changed for this pose" className="h-1.5 w-1.5 shrink-0 bg-accent" />}
        </div>
        <IconActions items={actions} className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 touch:opacity-100" />
        <Toggle checked={on} onChange={onToggle} />
      </div>
      {open && <div className="pb-3 pl-3 pr-2.5">{children}</div>}
    </div>
  )
}
