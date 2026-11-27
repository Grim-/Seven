import { sheetFacets } from '../facets'
import { KnowledgeTab } from './KnowledgeTab'

sheetFacets.add({
  name: 'Knowledge',
  module: 'core',
  id: 'knowledge',
  label: () => 'Knowledge',
  order: 15,
  Tab: ({ sheet, draft, change, campaign }) => <KnowledgeTab sheet={sheet} draft={draft} change={change} campaign={campaign} />
})
