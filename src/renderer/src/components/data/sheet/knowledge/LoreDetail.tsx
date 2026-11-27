import type { WorldKnowledge } from '@shared/worldKnowledge'
import { showName } from '@shared/ids'
import { ActionBar, Eyebrow, type MenuItem } from '../../../ui'
import { Markdown } from '../../../chat/Markdown'
import { AssetMedia } from '../../../pictures/AssetMedia'

export function LoreDetail({ entry, note, items }: { entry: WorldKnowledge; note: string; items: MenuItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[17px] font-semibold text-ink">{showName(entry.name)}</h3>
        <span className="border border-line/50 px-1.5 font-label text-[10px] caps-12 text-dim">{note}</span>
      </div>
      {entry.image && (
        <div className="max-h-64 overflow-hidden border border-line/50">
          <AssetMedia id={entry.image} className="h-full w-full object-cover" />
        </div>
      )}
      {entry.text.trim() ? <Markdown text={entry.text} /> : <div className="text-[12.5px] text-faint">No text written yet.</div>}
      {entry.tags.length > 0 && <Eyebrow>#{entry.tags.join(' #')}</Eyebrow>}
      <ActionBar row items={items} />
    </div>
  )
}
