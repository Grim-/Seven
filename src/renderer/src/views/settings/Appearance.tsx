import type { AvatarSize } from '@shared/types'
import { NumberField, Select, SettingCard, SettingRow, Toggle } from '../../components/ui'
import { useApp } from '../../store/app'
import { ThemePicker } from '../../components/themes/Themes'
import { saveTrayKinds, useKindList } from '../../lib/kinds'

const AVATAR_SIZES: { value: AvatarSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'xl', label: 'Extra Large' }
]

function SidePanelKinds() {
  const pinned = useApp((s) => s.settings?.trayKinds) ?? []
  const kinds = useKindList()
  return (
    <SettingRow wide label="Side panel tabs" hint="Which kinds get their own tab in the chat side panel. Also changed with the + on the panel's tab bar.">
      <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-4 gap-y-1">
        {kinds.map((k) => (
          <Toggle key={k.kind} checked={pinned.includes(k.kind)} onChange={(on) => saveTrayKinds(on ? [...pinned, k.kind] : pinned.filter((x) => x !== k.kind))} label={k.plural} />
        ))}
      </div>
    </SettingRow>
  )
}

export function Appearance() {
  const settings = useApp((s) => s.settings)
  const updateSettings = useApp((s) => s.updateSettings)
  return (
    <>
      <SettingCard title="Look">
        <SettingRow label="Default theme" hint="Used everywhere unless an agent has its own. Make and edit themes in Data.">
          <div className="w-64">
            <ThemePicker value={settings?.defaultTheme ?? 'seven'} onChange={(id) => void updateSettings({ defaultTheme: id ?? 'seven' })} inherit="Seven" />
          </div>
        </SettingRow>
        <SettingRow label="Animated backgrounds" hint="Lets themes use moving effects like the data feed. Off saves a little GPU for the model.">
          <Toggle checked={settings?.ambientBackground ?? true} onChange={(v) => void updateSettings({ ambientBackground: v })} label={settings?.ambientBackground ? 'On' : 'Off'} />
        </SettingRow>
      </SettingCard>
      <SettingCard title="Chat">
        <SettingRow label="Agent pictures in chat" hint="How big agents' pictures are next to their replies. Also changed by clicking the agent's picture at the top of a chat.">
          <Select value={settings?.avatarSize ?? 'medium'} options={AVATAR_SIZES} onChange={(v) => void updateSettings({ avatarSize: v as AvatarSize })} className="w-40" />
        </SettingRow>
        <SettingRow label="Pictures in chat" hint="The tallest a picture in a chat is shown, in pixels. It fills the width of the message up to this; Expand shows it full size.">
          <div className="flex items-center gap-2">
            <NumberField value={settings?.chatPictureHeight ?? 480} min={1} onChange={(v) => v !== undefined && void updateSettings({ chatPictureHeight: v })} className="w-24" />
            <span className="text-[12px] text-dim">px tall at most</span>
          </div>
        </SettingRow>
        <SidePanelKinds />
      </SettingCard>
    </>
  )
}
