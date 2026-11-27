import { actorEntry } from '@shared/worldNpcs'
import { useSheetHolds } from '../../../../lib/campaignHold'
import { RelationsBoard } from '../../../relationships/RelationsBoard'
import { sheetFacets, type FacetProps } from '../facets'
import { campaignHolders, innateHolder } from '../holders'

function RelationsTab({ sheet, draft, change, campaign }: FacetProps) {
  const innate = innateHolder(draft, change)
  const campaigns = campaignHolders(sheet.id, useSheetHolds(sheet.id, campaign))
  const target = (campaign && campaigns.find((h) => h.key === campaign)) || innate
  const entry = actorEntry(sheet.id)
  return <RelationsBoard holders={[innate, ...campaigns]} target={target} owner={{ ref: `${entry.kind}/${entry.id}`, title: draft.title }} />
}

sheetFacets.add({
  name: 'Relations',
  module: 'core',
  id: 'relations',
  label: (draft) => {
    const count = draft.relationships?.length ?? 0
    return count > 0 ? `Relations (${count})` : 'Relations'
  },
  order: 25,
  Tab: RelationsTab
})
