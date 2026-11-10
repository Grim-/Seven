import { registerTriggerActionHandler } from '../registry'
import { Field, Select, Input } from '../../../components/ui'
import { engine } from '../../../lib/ipc'
import { useLive } from '../../../lib/useLive'

interface RecruitPartyParams {
  sheet?: string
  joinMessage?: string
}

function RecruitPartyEditor({ params, onChange }: { params: RecruitPartyParams; onChange: (p: RecruitPartyParams) => void }) {
  const characters = useLive(() => engine('sheets.list'), 'page.changed') ?? []

  return (
    <div className="flex flex-col gap-3 font-mono text-[11px]">
      <Field label="CHARACTER SHEET TO RECRUIT">
        <Select
          value={params.sheet ?? ''}
          options={[
            { value: '', label: 'Select character to recruit...' },
            ...characters.map((c) => ({ value: c.id, label: `${c.title} (${c.id})` }))
          ]}
          onChange={(sheet) => onChange({ ...params, sheet })}
          className="h-8 text-[11.5px]"
        />
      </Field>

      <Field label="RECRUITMENT NOTICE (OPTIONAL)">
        <Input
          value={params.joinMessage ?? ''}
          placeholder="e.g. Ronald has joined your party!"
          onChange={(e) => onChange({ ...params, joinMessage: e.target.value })}
          className="h-8 text-[11.5px]"
        />
      </Field>
    </div>
  )
}

registerTriggerActionHandler<RecruitPartyParams>({
  type: 'recruit_party',
  label: 'Recruit Party Member',
  description: 'Brings an NPC or companion character sheet into the active party.',
  icon: 'user-plus',
  Editor: RecruitPartyEditor,
  execute: async (params, ctx) => {
    const sheetId = String(params.sheet ?? '').trim()
    if (!sheetId) return

    // If active save exists, bring sheet into active world party
    try {
      await ctx.engine('play.bring', { sheet: sheetId })
    } catch {
      // Fallback
    }

    const msg = params.joinMessage?.trim() || `${sheetId} joined the party!`
    ctx.notify(msg, 'accent')
  }
})
