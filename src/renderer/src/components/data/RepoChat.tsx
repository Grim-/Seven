import { useState } from 'react'
import { Dices } from 'lucide-react'
import { splitLink } from '@shared/text'
import { showName } from '@shared/ids'
import { Button, TraitChips } from '../ui'
import { engine } from '../../lib/ipc'
import { useLibraryData } from '../../lib/useLive'
import { failed } from '../../lib/notify'
import { cn } from '../../lib/cn'
import { EntryCard, Loading } from '../entries/EntryCard'
import { withReferences } from '../chat/References'
import type { EntrySurfaceProps } from '../../registries/kinds'

const SHOWN = 8

function useRoll(id: string) {
  const [rolled, setRolled] = useState<string | null>(null)
  const roll = () =>
    void engine('library.draw', { entry: `repo/${id}`, count: 1 })
      .then((v) => setRolled(v[0] ?? null))
      .catch(failed('Could not roll'))
  return { rolled, roll }
}

function useRepo(id: string) {
  return useLibraryData(() => engine('repos.get', { id }), id)
}

function RollButton({ roll, label = 'Roll' }: { roll: () => void; label?: string }) {
  return (
    <Button size="sm" variant="primary" icon={<Dices />} onClick={roll}>
      {label}
    </Button>
  )
}

function displayTrait(v: string): string {
  const parsed = splitLink(v)
  return parsed.kind ? `${parsed.kind}: ${showName(parsed.ref)}` : v
}

export function RepoChat({ id }: EntrySurfaceProps) {
  const repo = useRepo(id)
  const { rolled, roll } = useRoll(id)
  if (!repo) return <Loading />
  const more = repo.values.length - SHOWN
  return (
    <EntryCard title={repo.title} tag="repo" aside={<RollButton roll={roll} />}>
      <TraitChips traits={[...repo.values.slice(0, SHOWN).map((v, i) => ({ key: String(i), label: displayTrait(v) })), ...(more > 0 ? [{ key: 'more', label: `+ ${more} more` }] : [])]} />
      {rolled !== null && (
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Rolled</span>
          <span className="font-semibold text-accent">{withReferences(rolled)}</span>
        </div>
      )}
    </EntryCard>
  )
}

function BigRoll({ id, large }: { id: string; large: boolean }) {
  const repo = useRepo(id)
  const { rolled, roll } = useRoll(id)
  if (!repo) return <Loading />
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 text-center', large ? 'h-[60vh]' : 'h-full')}>
      {large && <span className="font-mono text-[12px] uppercase tracking-[0.2em] text-faint">{repo.title}</span>}
      <span className={cn('font-mono font-bold text-accent', large ? 'text-[56px]' : 'text-[22px]')}>{rolled !== null ? withReferences(rolled) : '—'}</span>
      <RollButton roll={roll} label={rolled === null ? 'Roll' : 'Roll again'} />
      {!large && <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{repo.values.length} values</span>}
    </div>
  )
}

export function RepoWidget({ id }: EntrySurfaceProps) {
  return <BigRoll id={id} large={false} />
}

export function RepoStage({ id }: EntrySurfaceProps) {
  return <BigRoll id={id} large />
}
