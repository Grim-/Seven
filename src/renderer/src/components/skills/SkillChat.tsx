import { EmptyState } from '../ui'
import { engine } from '../../lib/ipc'
import { useLibraryData } from '../../lib/useLive'
import { Markdown } from '../chat/Markdown'
import { EntryCard, Loading } from '../entries/EntryCard'
import type { EntrySurfaceProps } from '../../registries/kinds'

function useSkill(id: string) {
  const list = useLibraryData(() => engine('skills.list'), 'skills')
  const text = useLibraryData(() => engine('skills.read', { name: id }), id)
  return { list, skill: list?.find((s) => s.name === id), text }
}

function SkillView({ id, full }: { id: string; full: boolean }) {
  const { list, skill, text } = useSkill(id)
  if (!list) return <Loading />
  if (!skill) return <EmptyState title="Removed">This skill no longer exists.</EmptyState>
  return (
    <EntryCard title={skill.title} tag="skill">
      {skill.when && <div className="text-[12.5px] text-dim">When: {skill.when}</div>}
      {text !== null && (
        <div className={full ? '' : 'max-h-56 overflow-hidden border-l-2 border-line pl-3'}>
          <Markdown text={text} />
        </div>
      )}
    </EntryCard>
  )
}

export function SkillChat({ id }: EntrySurfaceProps) {
  return <SkillView id={id} full={false} />
}

export function SkillStage({ id }: EntrySurfaceProps) {
  return <SkillView id={id} full />
}

export function SkillWidget({ id }: EntrySurfaceProps) {
  const { skill } = useSkill(id)
  if (!skill) return <Loading />
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] text-ink">{skill.title}</span>
      <span className="text-[12.5px] text-dim">{skill.when || skill.description}</span>
    </div>
  )
}
