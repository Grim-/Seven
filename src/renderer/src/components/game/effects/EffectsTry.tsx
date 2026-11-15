import { useState } from 'react'
import { Play } from 'lucide-react'
import type { ComponentDef } from '@shared/game/core'
import type { EffectLane } from '@shared/game/components'
import { engine } from '../../../lib/ipc'
import { failed } from '../../../lib/notify'
import { useLibraryData } from '../../../lib/useLive'
import { Button, Eyebrow, Segmented } from '../../ui'
import { BrowsePick } from '../../ui/BrowsePick'

export function EffectsTry({ defs, lanes }: { defs: ComponentDef[]; lanes: EffectLane[] }) {
  const sheets = useLibraryData(() => engine('sheets.list'), 'effects.try.sheets') ?? []
  const [user, setUser] = useState<string | null>(null)
  const [target, setTarget] = useState<string | null>(null)
  const [event, setEvent] = useState(lanes[0]?.event ?? 'OnUse')
  const [told, setTold] = useState<string[] | null>(null)
  const aimed = sheets.find((s) => s.id === target)
  const options = sheets.map((s) => ({ value: s.id, label: s.title, group: s.game ? 'Game characters' : 'No Game sheet: effects can’t touch them' }))
  const run = () =>
    void engine('effects.run', { defs, event, user: user ? { sheet: user } : null, target: target ? { sheet: target } : null, world: null, dry: true })
      .then((done) => setTold([...done.results.map((r) => r.line), ...done.lines]))
      .catch(failed('Could not try the effects'))
  return (
    <section className="flex flex-col gap-2.5">
      <Eyebrow>Try it</Eyebrow>
      {lanes.length > 1 && <Segmented value={event} onChange={setEvent} options={lanes.map((l) => ({ value: l.event, label: l.label }))} />}
      <BrowsePick value={user} options={options} placeholder="Used by" onChange={setUser} />
      <BrowsePick value={target} options={options} placeholder="On whom" onChange={setTarget} />
      <Button variant="primary" size="sm" icon={<Play className="h-3.5 w-3.5" />} onClick={run} disabled={!defs.length || !target} className="self-start">
        Roll it
      </Button>
      {aimed && !aimed.game && <span className="text-[12px] text-alert">{aimed.title} has no Game sheet, so the effects can’t touch them.</span>}
      <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-faint">What the agent is told · nothing is saved</span>
      <div className="min-h-[3.5rem] border-l-2 border-cyan bg-cyan/[0.05] px-2.5 py-2 font-mono text-[12px] leading-relaxed text-white/85">
        {told === null ? <span className="text-faint">Roll it to see the line each effect reports.</span> : told.length ? told.map((l, i) => <div key={i}>{l}</div>) : <span className="text-faint">Nothing happened.</span>}
      </div>
    </section>
  )
}
