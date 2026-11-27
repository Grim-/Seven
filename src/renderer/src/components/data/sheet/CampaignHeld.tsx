import { Undo2 } from 'lucide-react'
import type { RelationshipEntry } from '@shared/relationships'
import { Eyebrow } from '../../ui'
import { useSheetHolds } from '../../../lib/campaignHold'
import { RelationshipsTable } from '../../relationships/RelationshipsTable'
import { campaignHolders } from './holders'

export function CampaignRelations({ sheet, campaign, compact, onMakeInnate }: { sheet: string; campaign: string | null; compact: boolean; onMakeInnate: (entry: RelationshipEntry) => void }) {
  const holders = campaignHolders(sheet, useSheetHolds(sheet, campaign))
  return (
    <>
      {holders.map((h) => (
        <section key={h.key} className="mx-auto flex w-full max-w-[1040px] flex-col gap-3 border border-line/40 tone-panel-25 p-4">
          <Eyebrow>Relations in {h.label}</Eyebrow>
          <RelationshipsTable
            compact={compact}
            items={h.hold.relationships}
            onChange={(relationships) => h.save({ ...h.hold, relationships })}
            emptyHint="No relations formed in this campaign yet."
            extra={(entry) => [
              {
                label: 'Make innate',
                icon: <Undo2 />,
                onSelect: () => {
                  onMakeInnate(entry)
                  h.save({ ...h.hold, relationships: h.hold.relationships.filter((x) => x.id !== entry.id) })
                }
              }
            ]}
          />
        </section>
      ))}
    </>
  )
}
