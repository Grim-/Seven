import { sheetFacets } from '../facets'
import { StoryTab } from './StoryTab'

sheetFacets.add({
  name: 'Story',
  module: 'story',
  id: 'story',
  label: () => 'Story',
  order: 30,
  Tab: ({ draft, change }) => <StoryTab story={draft.story} onChange={(story) => change({ ...draft, story })} />
})
