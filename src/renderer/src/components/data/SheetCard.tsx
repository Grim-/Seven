import { useContext, useEffect, useState } from 'react'
import type { CharacterSheet } from '@shared/types'
import { actorEntry, splitNpcRef } from '@shared/worldNpcs'
import { engine, on } from '../../lib/ipc'
import { openSevenLink } from '../../lib/links'
import { InsideSlateContext } from '../entries/EntryCard'
import { SlateContainer } from '../entries/EntrySlate'
import { pinToChatTable } from '../chat/tabletopStore'
import { showInPanel } from './showInPanel'
import { SheetPortrait } from './SheetPortrait'
import { SheetEditor } from './sheet/SheetEditor'
import { MIND_SLATE, MindSlate, SHEET_SLATE_PARTS } from './sheet/MindSlate'
import { useFocusedConversation } from '../../lib/conversation'
import { useSessions } from '../../store/sessions'
import { noteFailure } from '../../store/problems'

export function SheetCard({ id, part }: { id: string; part?: string | null }) {
  const insideSlate = useContext(InsideSlateContext)
  const sessionId = useFocusedConversation()?.sessionId ?? null
  const campaign = useSessions((s) => (sessionId ? s.list.find((x) => x.id === sessionId)?.scene?.almanacId || null : null))
  const [sheet, setSheet] = useState<CharacterSheet | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    const load = () =>
      void engine('sheets.get', { id })
        .then((s) => alive && setSheet(s))
        .catch(noteFailure('sheets', 'Could not load the sheet', () => alive && setSheet(null)))
    load()
    const npcRef = splitNpcRef(id)
    const offs = npcRef
      ? [
          on('npcs.changed', ({ world }) => {
            if (!world || world === npcRef.world) load()
          }),
          on('saves.changed', ({ world }) => {
            if (!world || world === npcRef.world) load()
          })
        ]
      : [
          on('page.changed', ({ id: changedId }) => {
            if (changedId === id || changedId.endsWith(`/${id}`)) load()
          })
        ]
    return () => {
      alive = false
      offs.forEach((off) => off())
    }
  }, [id])
  if (sheet === undefined) return <div className="font-ui text-[11px] text-dim">Loading…</div>
  if (!sheet) return <div className="font-ui text-[11px] text-dim">This character sheet no longer exists.</div>
  const filled = sheet.fields.filter((f) => sheet.values[f]?.trim())
  const entry = actorEntry(sheet.id)
  const isWorldNpc = splitNpcRef(sheet.id) !== null

  const body =
    part === MIND_SLATE ? (
      <MindSlate sheet={sheet} />
    ) : part && SHEET_SLATE_PARTS.has(part) ? (
      <SheetEditor key={`${sheet.id}:${part}`} start={sheet} compact only={[part]} campaign={campaign} />
    ) : (
      <SheetEditor key={sheet.id} start={sheet} compact campaign={campaign} />
    )

  if (insideSlate) return body

  return (
    <SlateContainer
      title={sheet.title}
      tag={isWorldNpc ? 'World NPC' : 'Character'}
      subtitle={`${filled.length} of ${sheet.fields.length} fields`}
      thumb={<SheetPortrait image={sheet.image} className="h-full w-full" />}
      entryKey={`${entry.kind}/${entry.id}`}
      onPin={() => void pinToChatTable(entry.kind, entry.id, sheet.title)}
      onShowInPanel={() => void showInPanel(`${entry.kind}/${entry.id}`, null)}
      onOpenData={() => openSevenLink(`seven:${entry.kind}/${encodeURIComponent(entry.id)}`)}
    >
      {body}
    </SlateContainer>
  )
}
