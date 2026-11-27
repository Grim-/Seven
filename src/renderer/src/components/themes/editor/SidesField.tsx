import { LabelledNumber } from './LabelledNumber'

export type Sides = [number, number, number, number]

const NAMES = ['Top', 'Right', 'Bottom', 'Left']

export function SidesField({ value, onChange, min, max, step = 1 }: { value: Sides; onChange: (next: Sides) => void; min?: number; max?: number; step?: number }) {
  return (
    <div className="grid grid-cols-4 gap-2 phone:grid-cols-2">
      {value.map((v, i) => (
        <LabelledNumber key={NAMES[i]} label={NAMES[i]} value={v} min={min} max={max} step={step} onChange={(n) => onChange(value.map((old, j) => (j === i ? n : old)) as Sides)} />
      ))}
    </div>
  )
}
