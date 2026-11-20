import { SettingCard, SettingRow, Toggle } from '../../components/ui'
import { useApp } from '../../store/app'

export function Startup() {
  const settings = useApp((s) => s.settings)
  const updateSettings = useApp((s) => s.updateSettings)
  return (
    <SettingCard title="Startup">
      <SettingRow label="Start with Windows" hint="Starts Seven hidden in the tray when you sign in. Only applies to the installed build.">
        <Toggle checked={settings?.startWithWindows ?? false} onChange={(v) => void updateSettings({ startWithWindows: v })} label={settings?.startWithWindows ? 'On' : 'Off'} />
      </SettingRow>
    </SettingCard>
  )
}
