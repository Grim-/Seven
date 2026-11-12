import { X } from 'lucide-react'
import { agentSheets, type AgentProfile } from '@shared/types'
import { showName } from '@shared/ids'
import { Field } from '../ui'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { changeAgent } from './changeAgent'
import { useEntryPreview } from '../entries/entryPreview'
import { CharacterAvatar } from './CharacterAvatar'
import { openEntry } from '../../lib/library'

function CharacterCard({
  sheetId,
  label,
  onRemove
}: {
  sheetId: string
  label: string
  onRemove?: () => void
}) {
  const preview = useEntryPreview(`@sheet:${sheetId}`)
  const valid = preview && !('missing' in preview) ? preview : null

  return (
    <div className="flex items-center gap-2 border border-line bg-black/40 p-1.5 font-mono text-[11px]">
      <CharacterAvatar sheetId={sheetId} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-white">{valid ? showName(valid.title) : sheetId}</div>
        <div className="text-[9.5px] text-dim">{label}</div>
      </div>
      <button
        type="button"
        onClick={() => openEntry('sheet', sheetId)}
        className="notch-sm border border-line/60 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-dim hover:border-accent hover:text-white"
      >
        Open
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="Remove from roster"
          className="flex h-5 w-5 items-center justify-center text-dim hover:text-alert"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

export function CharacterPicker({ agent }: { agent: AgentProfile }) {
  const sheets = agentSheets(agent)

  const handleAddSheet = (sheet: string | null) => {
    if (!sheet || sheets.includes(sheet)) return
    const nextSheets = [...sheets, sheet]
    void changeAgent(agent, { sheets: nextSheets, sheet: nextSheets[0] ?? null }, 'agent characters')
  }

  const handleRemoveSheet = (sheetToRemove: string) => {
    const nextSheets = sheets.filter((s) => s !== sheetToRemove)
    void changeAgent(agent, { sheets: nextSheets, sheet: nextSheets[0] ?? null }, 'agent characters')
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line/60 pt-2 font-mono">
      <Field label={sheets.length > 1 ? `Agent Roster (${sheets.length})` : 'Agent Roster'}>
        <div className="flex flex-col gap-1.5">
          {sheets.map((sheetId, idx) => (
            <CharacterCard
              key={sheetId}
              sheetId={sheetId}
              label={idx === 0 && sheets.length > 1 ? 'Primary character' : 'In-character'}
              onRemove={() => handleRemoveSheet(sheetId)}
            />
          ))}
          <SheetSelect
            value=""
            noneLabel={sheets.length > 0 ? '+ Add another character…' : '+ Assign character…'}
            onChange={(sheet) => handleAddSheet(sheet)}
            className="h-8 text-[12px]"
          />
        </div>
      </Field>
    </div>
  )
}
