import { SHADOW_BOUNDS, SHAPE_BOUNDS, type LookShadow, type LookShape } from '@shared/themeLook'
import { SettingCard } from '../../ui'
import { RangeTune } from './RangeTune'
import { withKey, type SectionProps } from './edit'

type Plain = Exclude<keyof LookShape, 'shadow'>

const CORNERS: { key: Plain; label: string; hint: string; step: number }[] = [
  { key: 'notch', label: 'Corner cut', hint: 'The cut corner on panels and cards, when the frame is notched.', step: 1 },
  { key: 'notchSm', label: 'Small corner cut', hint: 'The same on small pieces such as chips and tiles.', step: 1 },
  { key: 'radiusPanel', label: 'Panel rounding', hint: 'Rounded corners on panels.', step: 1 },
  { key: 'radiusControl', label: 'Control rounding', hint: 'Rounded corners on buttons and fields.', step: 1 }
]

const SURFACE: { key: Plain; label: string; hint: string; step: number }[] = [
  { key: 'solidity', label: 'Solidity', hint: 'How solid see-through panels, cards and fields are. 0 keeps each one as built, 1 makes them all solid.', step: 0.05 },
  { key: 'blur', label: 'Panel blur', hint: 'How much of what is behind a panel or overlay shows through, blurred. 0 turns frosting off everywhere.', step: 1 },
  { key: 'glow', label: 'Glow', hint: 'The strength of glows around accents and active things.', step: 0.05 }
]

const SHADOW: { key: keyof LookShadow; label: string; step: number }[] = [
  { key: 'y', label: 'Drop', step: 1 },
  { key: 'blur', label: 'Softness', step: 1 },
  { key: 'inset', label: 'Inner shadow', step: 1 },
  { key: 'strength', label: 'Strength', step: 0.05 }
]

export function ShapePage({ draft, set, defaults }: SectionProps) {
  const shape = draft.shape
  const base = defaults.shape ?? {}
  const plain = (key: Plain, v: number | undefined) => set({ shape: withKey(shape, key, v) })
  const shadow = (key: keyof LookShadow, value: number | undefined) => {
    const from = shape.shadow ?? base.shadow
    set({ shape: { ...shape, shadow: value === undefined || !from ? undefined : { ...from, [key]: value } } })
  }
  return (
    <>
      <SettingCard title="Corners">
        {CORNERS.map((r) => (
          <RangeTune key={r.key} label={r.label} hint={r.hint} value={shape[r.key]} fallback={base[r.key]} bounds={SHAPE_BOUNDS[r.key]} step={r.step} onChange={(v) => plain(r.key, v)} />
        ))}
      </SettingCard>
      <SettingCard title="Surfaces">
        {SURFACE.map((r) => (
          <RangeTune key={r.key} label={r.label} hint={r.hint} value={shape[r.key]} fallback={base[r.key]} bounds={SHAPE_BOUNDS[r.key]} step={r.step} onChange={(v) => plain(r.key, v)} />
        ))}
      </SettingCard>
      <SettingCard title="Panel shadow" intro="The shadow under panels, in the shadow colour.">
        {SHADOW.map((r) => (
          <RangeTune key={r.key} label={r.label} value={shape.shadow?.[r.key]} fallback={base.shadow?.[r.key]} bounds={SHADOW_BOUNDS[r.key]} step={r.step} onChange={(v) => shadow(r.key, v)} />
        ))}
      </SettingCard>
    </>
  )
}
