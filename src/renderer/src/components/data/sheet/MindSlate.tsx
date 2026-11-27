import { useState } from 'react'
import type { CharacterSheet } from '@shared/types'
import { Field } from '../../ui'
import { useFocusedConversation } from '../../../lib/conversation'
import { useSessions } from '../../../store/sessions'
import { FactionSelect, assignFaction } from '../../factions/FactionSelect'
import { SheetEditor } from './SheetEditor'

export const MIND_SLATE = 'mind'
export const SHEET_SLATE_PARTS = new Set(['mind', 'knowledge', 'relations', 'story'])

const MIND_PARTS = ['mind', 'relations', 'knowledge']

export function MindSlate({ sheet }: { sheet: CharacterSheet }) {
  const sessionId = useFocusedConversation()?.sessionId ?? null
  const campaign = useSessions((s) => (sessionId ? s.list.find((x) => x.id === sessionId)?.scene?.almanacId || null : null))
  const [faction, setFaction] = useState(sheet.faction ?? null)
  return (
    <div className="flex flex-col gap-3">
      <Field label="Faction allegiance">
        <FactionSelect
          value={faction}
          onChange={(next) => {
            setFaction(next)
            void assignFaction(sheet.id, next)
          }}
          className="h-8 text-[12px]"
        />
      </Field>
      <SheetEditor key={sheet.id} start={sheet} compact only={MIND_PARTS} campaign={campaign} />
    </div>
  )
}
