import { LayoutTemplate } from 'lucide-react'
import { HEADING_MARK, ORNAMENT_BOUNDS, lookOptions, lookSlots, standardLook } from '@shared/themeLook'
import { Input, OptionTile, SettingCard, Toggle, TunableRow } from '../../ui'
import { RangeTune } from './RangeTune'
import { withKey, type SectionProps } from './edit'

const SLOT_TITLES = new Map([
  ['frame', 'Panel edges'],
  ['active', 'Active tab'],
  ['hover', 'Card hover'],
  ['heading', 'Document headings']
])

export function OrnamentsPage({ draft, set, defaults }: SectionProps) {
  const o = draft.ornament
  return (
    <>
      {lookSlots().map((slot) => {
        const chosen = draft.options[slot] ?? standardLook(slot)?.id
        return (
          <SettingCard key={slot} title={SLOT_TITLES.get(slot) ?? slot}>
            <TunableRow label="Style" changed={slot in draft.options} onReset={() => set({ options: withKey(draft.options, slot, null) })} wide>
              <span className="grid w-full grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
                {lookOptions(slot).map((opt) => (
                  <OptionTile key={opt.id} icon={<LayoutTemplate />} title={opt.name} hint={opt.description} checked={chosen === opt.id} onChange={(on) => on && set({ options: withKey(draft.options, slot, opt.standard ? null : opt.id) })} />
                ))}
              </span>
            </TunableRow>
          </SettingCard>
        )
      })}
      <SettingCard title="Marks and overlays">
        <TunableRow label="Heading mark" hint="Up to four characters before document headings, when headings use the mark." changed={o.headingMark !== undefined} onReset={() => set({ ornament: { ...o, headingMark: undefined } })}>
          <Input value={o.headingMark ?? ''} placeholder={defaults.ornament?.headingMark} maxLength={4} onChange={(e) => HEADING_MARK.test(e.target.value) && set({ ornament: { ...o, headingMark: e.target.value } })} className="h-8 w-24 font-mono text-[12px]" />
        </TunableRow>
        <RangeTune label="Scanlines" hint="Fine lines over records and screens." value={o.scanlines} fallback={defaults.ornament?.scanlines} bounds={ORNAMENT_BOUNDS.scanlines} step={0.05} onChange={(scanlines) => set({ ornament: { ...o, scanlines } })} />
        <RangeTune label="Vignette" hint="Darkened edges on full-window screens." value={o.vignette} fallback={defaults.ornament?.vignette} bounds={ORNAMENT_BOUNDS.vignette} step={0.05} onChange={(vignette) => set({ ornament: { ...o, vignette } })} />
      </SettingCard>
      <SettingCard title="Motion">
        <TunableRow label="Decoding text" hint="Titles scramble into place." changed={!draft.motion.decode} onReset={() => set({ motion: { ...draft.motion, decode: true } })}>
          <Toggle checked={draft.motion.decode} onChange={(decode) => set({ motion: { ...draft.motion, decode } })} />
        </TunableRow>
        <TunableRow label="Glitch effects" hint="Flickers and glitches on reveals and errors." changed={!draft.motion.glitch} onReset={() => set({ motion: { ...draft.motion, glitch: true } })}>
          <Toggle checked={draft.motion.glitch} onChange={(glitch) => set({ motion: { ...draft.motion, glitch } })} />
        </TunableRow>
      </SettingCard>
    </>
  )
}
