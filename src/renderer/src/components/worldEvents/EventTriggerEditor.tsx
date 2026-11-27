import { Clock, Flag, Plus, X } from 'lucide-react'
import { worldSecondsFromDayTime, worldTimeFromSeconds } from '@shared/almanac'
import type { WorldEventTrigger } from '@shared/game/worldEvents'
import { Button, Input, NumberField, Toggle } from '../ui'
import { FlagSelect } from '../game/FlagSelect'

export function EventTriggerEditor({ world, value, onChange }: { world: string; value: WorldEventTrigger; onChange: (next: WorldEventTrigger) => void }) {
  const t = value.at !== null ? worldTimeFromSeconds(value.at, 1) : null
  const setTime = (day: number, hour: number) => onChange({ ...value, at: worldSecondsFromDayTime(day, hour, 0) })
  const setFlag = (i: number, patch: Partial<WorldEventTrigger['flags'][number]>) => onChange({ ...value, flags: value.flags.map((f, j) => (j === i ? { ...f, ...patch } : f)) })
  return (
    <div className="flex flex-col gap-2 border border-line/40 p-2.5">
      <span className="text-[10px] font-bold caps-5 text-accent">Starts when</span>
      <div className="flex flex-wrap items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-secondary-ink" />
        <Toggle checked={t !== null} onChange={(on) => onChange({ ...value, at: on ? worldSecondsFromDayTime(1, 0, 0) : null })} label="World time reaches" />
        {t && (
          <>
            <span className="text-dim">day</span>
            <NumberField value={t.day} min={1} onChange={(d) => d !== undefined && setTime(d, t.hour)} className="w-20" />
            <span className="text-dim">hour</span>
            <NumberField value={t.hour} min={0} max={23} onChange={(h) => h !== undefined && setTime(t.day, h)} className="w-16" />
          </>
        )}
      </div>
      {value.flags.map((f, i) => (
        <div key={i} className="flex items-center gap-2">
          <Flag className="h-3.5 w-3.5 text-secondary-ink" />
          <FlagSelect world={world} value={f.flag} onChange={(flag) => setFlag(i, { flag })} className="w-56" />
          <Input value={f.value} onChange={(e) => setFlag(i, { value: e.target.value })} placeholder="any value" className="w-32" />
          <button type="button" title="Remove" onClick={() => onChange({ ...value, flags: value.flags.filter((_, j) => j !== i) })} className="text-dim hover:text-alert">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button size="sm" variant="ghost" icon={<Plus className="h-3 w-3" />} onClick={() => onChange({ ...value, flags: [...value.flags, { flag: '', value: '' }] })} className="self-start">
        Flag condition
      </Button>
    </div>
  )
}
