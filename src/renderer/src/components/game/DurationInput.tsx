import { useState } from 'react'
import { CountStepper, Segmented } from '../ui'
import { durationUnits, fittingUnit } from './duration'
import { useGameCatalog } from './useGameCatalog'

export function DurationInput({ value, onChange }: { value: number; onChange: (seconds: number) => void }) {
  const units = durationUnits(useGameCatalog())
  const [label, setLabel] = useState(() => fittingUnit(value, units).label)
  const unit = units.find((u) => u.label === label) ?? units[0]
  const amount = Math.round((value / unit.seconds) * 100) / 100
  return (
    <div className="flex items-center gap-2">
      <CountStepper value={amount} min={0} onChange={(n) => onChange(Math.max(0, n) * unit.seconds)} />
      <Segmented
        value={unit.label}
        options={units.map((u) => ({ value: u.label, label: u.label }))}
        onChange={(next) => {
          const to = units.find((u) => u.label === next) ?? unit
          setLabel(to.label)
          onChange(amount * to.seconds)
        }}
      />
    </div>
  )
}
