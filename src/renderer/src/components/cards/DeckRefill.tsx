import type { MouseEvent } from 'react'
import { RotateCcw } from 'lucide-react'
import { showName } from '@shared/ids'
import { totalOf } from '@shared/cardDecks'
import { Button, askConfirm, openMenu, type MenuEvent } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import type { CountsEdit } from './CountsEditor'
import { SET_TYPE, readCounts, useTypePages } from './model'

const idOf = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

export function DeckRefill({ edit }: { edit: CountsEdit }) {
  const sets = useTypePages(SET_TYPE)
  const from = idOf(edit.list.from)
  const pick = (at: MenuEvent) =>
    openMenu(at, 'Refill from a set', sets.map((s) => ({ label: showName(s.title), onSelect: () => refill(s.id, at) })))
  const refill = (setId: string, at: MenuEvent) =>
    void engine('data.pages.find', { id: setId }).then((page) => {
      if (!page) {
        toast.error('That card set no longer exists', 'Pick another set.')
        return pick(at)
      }
      const set = readCounts(page.data, page.title)
      askConfirm(`Refill ${showName(edit.list.name)}?`, `It goes back to ${showName(set.name)}: ${totalOf(set.cards)} cards. Cards added since are taken out.`, 'Refill', () => edit.set((d) => ({ ...d, cards: set.cards, from: setId })))
    }, failed('Could not read the card set'))
  const where = (e: MouseEvent): MenuEvent => ({ preventDefault() {}, stopPropagation() {}, clientX: e.clientX, clientY: e.clientY })
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={<RotateCcw />}
      disabled={!sets.length}
      title={from ? 'Put it back to its set. Right-click to pick another set.' : 'Pick a set to refill it from.'}
      onClick={(e) => (from ? refill(from, where(e)) : pick(where(e)))}
      onContextMenu={(e) => pick(e)}
    >
      Refill
    </Button>
  )
}
