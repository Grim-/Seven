import { SEVEN_THEME, SKY_MODES, type SkyMode } from '@shared/theme'
import { glowStops } from '@shared/gradient'
import { GradientField, Select, SettingCard, SettingRow, SliderNumber, Toggle, TunableRow } from '../../ui'
import { useRoleColours } from '../../../lib/skins/useRoleColours'
import type { SectionProps } from './edit'

const SKY_LABELS: Record<SkyMode, string> = { off: 'No sky', clock: 'Follow the time of day', dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' }

export function SkyLightPage({ draft, set }: SectionProps) {
  const roles = useRoleColours()
  const light = draft.light
  const accent = (draft.colours.accent ?? roles.colours.accent).slice(0, 7)
  return (
    <SettingCard title="Sky and light">
      <TunableRow label="Sky" hint="A sun or moon and stars over the background picture. Their colours are on the Skies page." changed={draft.sky !== SEVEN_THEME.sky} onReset={() => set({ sky: SEVEN_THEME.sky })}>
        <Select value={draft.sky} options={SKY_MODES.map((m) => ({ value: m, label: SKY_LABELS[m] }))} onChange={(v) => set({ sky: v as SkyMode })} />
      </TunableRow>
      <TunableRow label="Mood light" hint="A large, soft glow from the bottom middle, over everything else. The left end of the gradient is the centre of the glow." changed={Boolean(light)} onReset={() => set({ light: null })}>
        <Toggle checked={Boolean(light)} onChange={(on) => set({ light: on ? { stops: glowStops([accent]), strength: 0.3 } : null })} label={light ? 'On' : 'Off'} />
      </TunableRow>
      {light && (
        <SettingRow label="Light colours" wide>
          <GradientField stops={light.stops} newColour={accent} onChange={(stops) => set({ light: stops.length ? { ...light, stops } : null })} />
        </SettingRow>
      )}
      {light && (
        <SettingRow label="Light strength">
          <SliderNumber value={Math.round(light.strength * 100)} min={0} max={100} step={1} onChange={(v) => set({ light: { ...light, strength: v / 100 } })} />
        </SettingRow>
      )}
    </SettingCard>
  )
}
