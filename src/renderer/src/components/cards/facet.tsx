import { sheetFacets } from '../data/sheet/facets'
import { CharacterCards } from './CharacterCards'

sheetFacets.add({
  name: 'Cards',
  module: 'cards',
  id: 'cards',
  label: () => 'Cards',
  order: 40,
  Tab: ({ sheet }) => <CharacterCards sheet={sheet.id} />
})
