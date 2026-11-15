import type { MouseEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { showName } from '@shared/ids'
import type { DeckOwner } from '@shared/cardDecks'
import { openMenu, type MenuEvent, type MenuItem } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useData } from '../../store/data'
import { useAgents } from '../../store/agents'

export function OwnerPicker({ owner, title, menuTitle, nobody, onPick }: { owner: DeckOwner | null; title: string; menuTitle: string; nobody?: boolean; onPick: (owner: DeckOwner | null) => void }) {
  const pages = useData((s) => s.pages)
  const agents = useAgents((s) => s.list)
  const sheetTitle = (id: string) => showName(pages.find((p) => p.id === id)?.title ?? 'A character')
  const label = !owner ? 'No owner' : 'user' in owner ? 'Your deck' : 'agent' in owner ? `${agents.find((a) => a.id === owner.agent)?.name ?? 'An agent'}'s deck` : `${sheetTitle(owner.character)}'s deck`
  const choose = (at: MenuEvent) =>
    void engine('library.find', { query: '', kind: 'sheet' }).then((sheets) => {
      const items: MenuItem[] = [
        { label: 'You', onSelect: () => onPick({ user: true }) },
        { label: 'An agent', disabled: !agents.length, children: agents.map((a) => ({ label: a.name, onSelect: () => onPick({ agent: a.id }) })) },
        { label: 'A character', disabled: !sheets.length, children: sheets.map((s) => ({ label: showName(s.title), onSelect: () => onPick({ character: s.id }) })) },
        ...(nobody ? [{ label: 'Nobody', onSelect: () => onPick(null) }] : [])
      ]
      openMenu(at, menuTitle, items)
    }, failed('Could not list the characters'))
  const where = (e: MouseEvent): MenuEvent => ({ preventDefault() {}, stopPropagation() {}, clientX: e.clientX, clientY: e.clientY })
  return (
    <button type="button" title={title} className="flex items-center gap-1 font-mono text-[11px] text-accent-soft hover:text-white" onClick={(e) => choose(where(e))} onContextMenu={(e) => {
      e.preventDefault()
      choose(where(e))
    }}>
      {label}
      <ChevronDown className="h-3 w-3" />
    </button>
  )
}
