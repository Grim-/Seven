import { cleanDeckOwner, type DeckOwner as Owner } from '@shared/cardDecks'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import type { CountsEdit } from './CountsEditor'
import { OwnerPicker } from './OwnerPicker'

const idOf = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

export function DeckOwner({ deck, edit }: { deck: string; edit: CountsEdit }) {
  const legacy = idOf(edit.list.character)
  const owner = cleanDeckOwner(edit.list.owner) ?? (legacy ? { character: legacy } : null)
  const give = (next: Owner | null) => {
    edit.set((d) => ({ ...d, owner: next }))
    void engine('decks.setOwner', { deck, owner: next }).catch(failed('Could not change who owns the deck'))
  }
  return <OwnerPicker owner={owner} title="Change whose deck this is" menuTitle="Whose deck" nobody onPick={give} />
}
