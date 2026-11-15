import { sheetFacets } from '../../data/sheet/facets'
import { CharacterGameTab } from './CharacterGameTab'

sheetFacets.add({
  name: 'Game',
  module: 'game',
  id: 'game',
  label: () => 'Game',
  order: 20,
  system: true,
  has: (sheet) => sheet.game !== null && sheet.game !== undefined,
  Tab: ({ sheet }) => <CharacterGameTab sheet={sheet} />
})
