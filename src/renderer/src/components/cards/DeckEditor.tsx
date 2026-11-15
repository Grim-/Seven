import { AddonPage } from '../data/AddonPage'
import { CountsEditor } from './CountsEditor'
import { DeckOwner } from './DeckOwner'
import { DeckRefill } from './DeckRefill'
import { SetPicker } from './SetPicker'
import { readCounts } from './model'

export function DeckEditor({ id, giving = true }: { id: string | null; giving?: boolean }) {
  return (
    <AddonPage
      id={id}
      what="card deck"
      read={readCounts}
      render={(page) => (
        <CountsEditor
          {...page}
          what="deck"
          extra={(edit) => (
            <div className="flex flex-wrap items-center gap-2">
              {giving && <DeckOwner deck={page.pageId} edit={edit} />}
              <div className="w-60">
                <SetPicker onAdd={edit.addSet} />
              </div>
              <DeckRefill edit={edit} />
            </div>
          )}
        />
      )}
    />
  )
}
