import type { PackListing } from '@shared/types'
import { ActionBar, EmptyState, Fold, SettingCard } from '../../ui'
import { PackRow } from './PackRow'
import { packFolderActions } from './packActions'

export function PacksPage({ listing, setOn }: { listing: PackListing; setOn: (on: string[]) => void }) {
  const on = listing.packs.filter((p) => p.on).map((p) => p.id)
  const turnedOn = listing.packs.filter((p) => p.on)
  const offer = listing.packs.filter((p) => !p.on && !p.invalid && !p.failed.length)
  const other = listing.packs.filter((p) => !p.on && !p.invalid && p.failed.length)
  const invalid = listing.packs.filter((p) => !p.on && p.invalid)
  const folderBar = <ActionBar row items={packFolderActions(listing.folder)} />
  if (!listing.packs.length)
    return (
      <EmptyState title="No packs" action={folderBar}>
        Packs Seven ships and the ones you import or put in your packs folder show here.
      </EmptyState>
    )
  const rows = (list: typeof listing.packs) => list.map((p) => <PackRow key={p.file} pack={p} on={on} setOn={setOn} />)
  return (
    <>
      <SettingCard title="On for this model" count={turnedOn.length} intro="Your own changes always win over a pack. A later pack wins over an earlier one.">
        {turnedOn.length ? rows(turnedOn) : <div className="px-3.5 py-3 text-[12.5px] text-faint">None yet. Turn on a pack below.</div>}
      </SettingCard>
      <SettingCard title="For this model" count={offer.length} actions={folderBar}>
        {offer.length ? rows(offer) : <div className="px-3.5 py-3 text-[12.5px] text-faint">No other pack matches this model, this PC and the active llama-server version.</div>}
        {other.length > 0 && (
          <Fold label="Don't match" count={other.length}>
            {rows(other)}
          </Fold>
        )}
        {invalid.length > 0 && (
          <Fold label="Files with problems" count={invalid.length}>
            {rows(invalid)}
          </Fold>
        )}
      </SettingCard>
    </>
  )
}
