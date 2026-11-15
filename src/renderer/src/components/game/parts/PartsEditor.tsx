import { componentClass, resolveParams, type ComponentDef } from '@shared/game/core'
import { PartCard } from './PartCard'
import { PartPicker } from './PartPicker'

export function PartsEditor({ host, value, onChange }: { host: string; value: ComponentDef[]; onChange: (next: ComponentDef[]) => void }) {
  const at = (i: number, def: ComponentDef) => onChange(value.map((d, j) => (j === i ? def : d)))
  const move = (i: number, by: number) => {
    const to = i + by
    if (to < 0 || to >= value.length) return
    const next = [...value]
    ;[next[i], next[to]] = [next[to], next[i]]
    onChange(next)
  }
  const add = (type: string) => {
    const Class = componentClass(type)
    if (Class) onChange([...value, { type, ...resolveParams(Class.PARAMS, {}), comps: [] }])
  }
  return (
    <div className="flex flex-col gap-2">
      {value.map((def, i) => (
        <PartCard
          key={i}
          def={def}
          index={i}
          size={value.length}
          onChange={(next) => at(i, next)}
          handlers={{
            duplicate: () => onChange([...value.slice(0, i + 1), structuredClone(def), ...value.slice(i + 1)]),
            move: (by) => move(i, by),
            remove: () => onChange(value.filter((_, j) => j !== i))
          }}
        />
      ))}
      <PartPicker host={host} onPick={add} />
    </div>
  )
}
