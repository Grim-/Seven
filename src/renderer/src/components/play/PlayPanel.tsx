import { useState } from 'react'
import { Dices, Hexagon, Signpost, Swords, X } from 'lucide-react'
import { Button, ShellTabs } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { useViewPlace } from '../../lib/viewPlace'
import type { PlayWhere } from './playStore'
import { SavedList, type SavedItem } from './SavedList'
import { ActionPanel } from './ActionPanel'
import { DecisionPanel } from '../decisions/DecisionPanel'
import { RolledPanel } from '../decisions/RolledPanel'
import { OpposedPanel } from '../decisions/OpposedPanel'

type Tab = 'action' | 'decision' | 'rolled' | 'opposed'

const TABS = [
  { value: 'action' as const, label: 'Action', icon: <Dices className="h-3.5 w-3.5" /> },
  { value: 'decision' as const, label: 'Decision', icon: <Signpost className="h-3.5 w-3.5" /> },
  { value: 'rolled' as const, label: 'Rolled', icon: <Hexagon className="h-3.5 w-3.5" /> },
  { value: 'opposed' as const, label: 'Opposed check', icon: <Swords className="h-3.5 w-3.5" /> }
]

const LIST: Record<Exclude<Tab, 'opposed'>, { placeholder: string; newLabel: string }> = {
  action: { placeholder: 'Find a saved action', newLabel: 'New action' },
  decision: { placeholder: 'Find a saved decision', newLabel: 'New decision' },
  rolled: { placeholder: 'Find a saved rolled decision', newLabel: 'New rolled decision' }
}

export function PlayPanel({ character, where, onClose }: { character: string | null; where: PlayWhere; onClose: () => void }) {
  const [tab, setTab] = useViewPlace<Tab>('play.tab', 'action')
  const [picked, setPicked] = useState<Record<string, string | null>>({})
  const [fresh, setFresh] = useState(0)
  const actions = useLive(() => engine('storyActions.list', {}), 'storyActions.changed') ?? []
  const decisions = useLive(() => engine('decisions.list', {}), 'decisions.changed') ?? []
  const current = picked[tab] ?? null
  const pick = (id: string | null) => {
    setPicked({ ...picked, [tab]: id })
    setFresh((n) => n + 1)
  }
  const saved = (id: string) => setPicked({ ...picked, [tab]: id })
  const items: SavedItem[] =
    tab === 'action'
      ? actions.map((a) => ({ id: a.id, name: a.name, sub: a.action.attempt, tags: a.tags }))
      : decisions.filter((d) => (tab === 'rolled' ? d.mode === 'roll' : d.mode === 'pick')).map((d) => ({ id: d.id, name: d.name, sub: d.mode === 'roll' ? `d${d.die}` : d.options.length ? `${d.options.length} kept` : `${d.count} written by the agent`, tags: d.tags }))
  const key = `${tab}:${current ?? 'new'}:${fresh}`
  return (
    <div className="flex h-full min-h-0 flex-col border border-accent/60 bg-black/95 shadow-[0_-12px_30px_rgba(0,0,0,0.6)]">
      <ShellTabs value={tab} options={TABS} onChange={setTab}>
        <Button size="sm" variant="ghost" icon={<X />} title="Close" onClick={onClose} />
      </ShellTabs>
      <div className="flex min-h-0 flex-1">
        {tab !== 'opposed' && <SavedList items={items} current={current} onPick={pick} onNew={() => pick(null)} {...LIST[tab]} />}
        {tab === 'action' && <ActionPanel key={key} start={actions.find((a) => a.id === current) ?? null} character={character} where={where} onSaved={saved} />}
        {tab === 'decision' && <DecisionPanel key={key} start={decisions.find((d) => d.id === current) ?? null} character={character} where={where} onSaved={saved} />}
        {tab === 'rolled' && <RolledPanel key={key} start={decisions.find((d) => d.id === current) ?? null} where={where} onSaved={saved} />}
        {tab === 'opposed' && <OpposedPanel where={where} />}
      </div>
    </div>
  )
}
