import { CASE_NAMES, LETTERING_BOUNDS, TYPE_BOUNDS, TYPE_FONT_NAMES, TYPE_NAMES, VARIANT_NAMES, type LookType, type TypeFont, type TypeRole } from '@shared/themeLook'
import { Select, SettingCard, TunableRow } from '../../ui'
import { ChoiceTune } from './ChoiceTune'
import { RangeTune } from './RangeTune'
import { withKey, type SectionProps } from './edit'

function TypeCard({ role, label, draft, set, defaults }: SectionProps & { role: TypeRole; label: string }) {
  const style = draft.type[role] ?? {}
  const base = defaults.type?.[role] ?? {}
  const change = (patch: Partial<LookType>) => {
    const next: LookType = { ...style, ...patch }
    for (const k of Object.keys(next) as (keyof LookType)[]) if (next[k] === undefined) delete next[k]
    set({ type: withKey(draft.type, role, Object.keys(next).length ? next : null) })
  }
  return (
    <SettingCard title={label} intro={<span className={`type-${role} text-ink`}>{label} in this style</span>}>
      <TunableRow label="Font" changed={style.font !== undefined} onReset={() => change({ font: undefined })}>
        <Select value={style.font ?? base.font ?? 'inherit'} options={TYPE_FONT_NAMES.map((f) => ({ value: f.id, label: f.label }))} onChange={(v) => change({ font: v as TypeFont })} />
      </TunableRow>
      <RangeTune label="Size" value={style.size} fallback={base.size} bounds={TYPE_BOUNDS.size} step={0.5} onChange={(v) => change({ size: v })} />
      <RangeTune label="Weight" value={style.weight} fallback={base.weight} bounds={TYPE_BOUNDS.weight} step={100} onChange={(v) => change({ weight: v })} />
      <ChoiceTune label="Case" value={style.case} fallback={base.case} options={CASE_NAMES} onChange={(v) => change({ case: v })} />
      <RangeTune label="Letter spacing" value={style.tracking} fallback={base.tracking} bounds={TYPE_BOUNDS.tracking} step={0.01} onChange={(v) => change({ tracking: v })} />
      <ChoiceTune label="Capitals" value={style.variant} fallback={base.variant} options={VARIANT_NAMES} onChange={(v) => change({ variant: v })} />
    </SettingCard>
  )
}

function LetteringCard({ draft, set, defaults }: SectionProps) {
  const lettering = draft.lettering
  const base = defaults.lettering ?? {}
  return (
    <SettingCard title="Lettering" intro="Settings for all text at once.">
      <RangeTune label="Capitals spacing" hint="Letter spacing on labels shown in capitals, as a share of the spacing each one is built with. 0 for none." value={lettering.capsSpacing} fallback={base.capsSpacing ?? 1} bounds={LETTERING_BOUNDS.capsSpacing} step={0.05} onChange={(v) => set({ lettering: withKey(lettering, 'capsSpacing', v) })} />
      <RangeTune label="Text size balance" hint="Evens out fonts that look too big or too small, by giving every font the same height of small letters. Unset leaves each font as it is." value={lettering.sizeAdjust} fallback={base.sizeAdjust ?? 0.5} bounds={LETTERING_BOUNDS.sizeAdjust} step={0.01} onChange={(v) => set({ lettering: withKey(lettering, 'sizeAdjust', v) })} />
    </SettingCard>
  )
}

export function TypePage(props: SectionProps) {
  return (
    <>
      <LetteringCard {...props} />
      {TYPE_NAMES.map((t) => (
        <TypeCard key={t.id} role={t.id} label={t.label} {...props} />
      ))}
    </>
  )
}
