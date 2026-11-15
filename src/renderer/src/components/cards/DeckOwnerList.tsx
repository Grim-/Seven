import type { ReactNode } from 'react'
import { UserRound } from 'lucide-react'
import { showName } from '@shared/ids'
import { sameOwner, type DeckOwner } from '@shared/cardDecks'
import { Eyebrow } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { useAgents } from '../../store/agents'
import { AgentAvatar } from '../agents/look'
import { SheetPortrait } from '../data/SheetPortrait'
import { DeckOwnerRow } from './DeckOwnerRow'

export interface PlayingSide {
  owner: DeckOwner
  note: string
}

export function DeckOwnerList({ owner, playing, onPick }: { owner: DeckOwner; playing: PlayingSide[]; onPick: (owner: DeckOwner) => void }) {
  const agents = useAgents((s) => s.list)
  const sheets = useLive(() => engine('sheets.list'), 'page.changed') ?? []
  const row = (o: DeckOwner, name: string, icon: ReactNode) => (
    <DeckOwnerRow key={JSON.stringify(o)} owner={o} name={name} icon={icon} note={playing.find((p) => sameOwner(p.owner, o))?.note} active={sameOwner(owner, o)} onPick={onPick} />
  )
  return (
    <div className="flex min-h-0 w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line/40 pr-3 phone:max-h-56 phone:w-full phone:border-b phone:border-r-0 phone:pb-3 phone:pr-0">
      <section className="flex flex-col gap-1">
        <Eyebrow>You</Eyebrow>
        {row({ user: true }, 'You', <UserRound />)}
      </section>
      {agents.length > 0 && (
        <section className="flex flex-col gap-1">
          <Eyebrow>Agents</Eyebrow>
          {agents.map((a) => row({ agent: a.id }, a.name, <AgentAvatar agent={a} size={28} />))}
        </section>
      )}
      {sheets.length > 0 && (
        <section className="flex flex-col gap-1">
          <Eyebrow>Characters</Eyebrow>
          {sheets.map((s) => row({ character: s.id }, showName(s.title), <SheetPortrait image={s.image} className="h-7 w-7" />))}
        </section>
      )}
    </div>
  )
}
