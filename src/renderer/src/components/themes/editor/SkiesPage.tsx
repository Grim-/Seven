import { DEFAULT_SKIES, SKY_PHASES } from '@shared/themeLook'
import { HexColor, SettingCard, SettingRow, Toggle, TunableRow } from '../../ui'
import type { SectionProps } from './edit'

export function SkiesPage({ draft, set }: SectionProps) {
  const skies = draft.skies
  return (
    <SettingCard title="Skies" intro="The sun and moon behind themes that show a sky, through the day.">
      <TunableRow label="Own sun and moon" hint="Off uses Seven's." changed={skies !== null} onReset={() => set({ skies: null })}>
        <Toggle checked={skies !== null} onChange={(on) => set({ skies: on ? DEFAULT_SKIES : null })} />
      </TunableRow>
      {skies &&
        SKY_PHASES.map((p) => (
          <SettingRow key={p} label={p[0].toUpperCase() + p.slice(1)}>
            <HexColor value={skies[p].orb} onChange={(orb) => set({ skies: { ...skies, [p]: { orb } } })} />
          </SettingRow>
        ))}
    </SettingCard>
  )
}
