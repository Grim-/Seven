import { useContext, useEffect, useState } from 'react'
import type { CharacterSheet } from '@shared/types'
import { engine } from '../../lib/ipc'
import { openSevenLink } from '../../lib/links'
import { InsideSlateContext } from '../entries/EntryCard'
import { SlateContainer } from '../entries/EntrySlate'
import { pinToChatTable } from '../chat/tabletopStore'
import { showInPanel } from './showInPanel'
import { SheetPortrait } from './SheetPortrait'
import { SheetEditor } from './sheet/SheetEditor'
import { noteFailure } from '../../store/problems'

export function SheetCard({ id }: { id: string }) {
  const insideSlate = useContext(InsideSlateContext)
  const [sheet, setSheet] = useState<CharacterSheet | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    void engine('sheets.get', { id })
      .then((s) => alive && setSheet(s))
      .catch(noteFailure('sheets', 'Could not load the sheet', () => alive && setSheet(null)))
    return () => {
      alive = false
    }
  }, [id])
  if (sheet === undefined) return <div className="font-mono text-[11px] text-dim">Loading…</div>
  if (!sheet) return <div className="font-mono text-[11px] text-dim">This character sheet no longer exists.</div>
  const filled = sheet.fields.filter((f) => sheet.values[f]?.trim())

  const body = <SheetEditor key={sheet.id} start={sheet} compact />

  if (insideSlate) return body

  return (
    <SlateContainer
      title={sheet.title}
      tag="Character"
      subtitle={`${filled.length} of ${sheet.fields.length} fields`}
      thumb={<SheetPortrait image={sheet.image} className="h-full w-full" />}
      entryKey={`sheet/${sheet.id}`}
      onPin={() => void pinToChatTable('sheet', sheet.id, sheet.title)}
      onShowInPanel={() => void showInPanel(`sheet/${sheet.id}`, null)}
      onOpenData={() => openSevenLink(`seven:sheet/${encodeURIComponent(sheet.id)}`)}
    >
      {body}
    </SlateContainer>
  )
}
