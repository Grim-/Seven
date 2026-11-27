import { Input, SettingCard, SettingRow } from '../../ui'
import type { SectionProps } from './edit'

export function AboutPage({ draft, set }: SectionProps) {
  return (
    <SettingCard title="Theme">
      <SettingRow label="Name" wide>
        <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
      </SettingRow>
      <SettingRow label="Description" hint="What this theme is like. Agents read it when they pick a theme." wide>
        <Input value={draft.description} onChange={(e) => set({ description: e.target.value })} />
      </SettingRow>
    </SettingCard>
  )
}
