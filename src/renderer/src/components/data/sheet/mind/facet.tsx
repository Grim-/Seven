import { sheetFacets } from '../facets'
import { MindTab } from './MindTab'

sheetFacets.add({
  name: 'Mind',
  module: 'core',
  id: 'mind',
  label: () => 'Mind',
  order: 20,
  Tab: ({ sheet, draft, change }) => (
    <MindTab sheet={sheet} mind={draft.mind ?? null} onChange={(mind) => change({ ...draft, mind })} />
  )
})
