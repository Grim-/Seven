import { useContext } from 'react'
import { InsideSlateContext } from '../../../entries/EntryCard'
import { RelationshipsTable } from '../../../relationships/RelationshipsTable'
import { sheetFacets } from '../facets'

sheetFacets.add({
  name: 'Relations',
  module: 'core',
  id: 'relations',
  label: (draft) => {
    const count = draft.relationships?.length ?? 0
    return count > 0 ? `Relations (${count})` : 'Relations'
  },
  order: 25,
  Tab: ({ draft, change }) => {
    const compact = useContext(InsideSlateContext)
    return (
      <div className={compact ? 'flex flex-col gap-2' : 'mx-auto flex w-full max-w-[1040px] flex-col gap-4 p-5'}>
        <RelationshipsTable
          compact={compact}
          items={draft.relationships ?? []}
          onChange={(relationships) => change({ ...draft, relationships })}
        />
      </div>
    )
  }
})
