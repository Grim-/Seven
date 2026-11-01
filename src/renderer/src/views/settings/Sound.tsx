import { Button, Input, SettingCard, SettingRow, Toggle } from '../../components/ui'
import { main } from '../../lib/ipc'
import { useApp } from '../../store/app'
import { VoicePicker } from '../../components/voice/VoicePicker'

export function Sound() {
  const settings = useApp((s) => s.settings)
  const updateSettings = useApp((s) => s.updateSettings)
  if (!settings) return null
  const { audio, voice } = settings
  return (
    <>
      <SettingCard title="Sound">
        <SettingRow label="Music" hint="Themes and agents can play music. Turning it off here or on the bottom bar keeps it off until you turn it back on.">
          <Toggle checked={audio.music} onChange={(v) => void updateSettings({ audio: { ...audio, music: v } })} label={audio.music ? 'On' : 'Off'} />
        </SettingRow>
        <SettingRow label="Sounds" hint="One-off sounds from themes and agents (replies, reminders, cues).">
          <Toggle checked={audio.sounds} onChange={(v) => void updateSettings({ audio: { ...audio, sounds: v } })} label={audio.sounds ? 'On' : 'Off'} />
        </SettingRow>
      </SettingCard>
      <SettingCard title="Voice">
        <SettingRow label="Voices" hint="Agents that read aloud and scenes speak while this is on. Also on the bottom bar.">
          <Toggle checked={voice.on} onChange={(v) => void updateSettings({ voice: { ...voice, on: v } })} label={voice.on ? 'On' : 'Off'} />
        </SettingRow>
        <SettingRow label="Default voice" hint="For agents and characters without their own. Your system's voices work with nothing to install.">
          <div className="w-72">
            <VoicePicker value={voice.fallback} onChange={(fallback) => void updateSettings({ voice: { ...voice, fallback } })} inherit="System default" />
          </div>
        </SettingRow>
        <SettingRow wide label="Piper (optional, better voices)" hint="Piper is a free offline voice program: point to piper.exe and a folder of .onnx voices (each with its .onnx.json).">
          <div className="flex w-full flex-col gap-2">
            <div className="flex gap-2">
              <Input readOnly value={voice.piperPath} placeholder="piper.exe" className="font-mono text-[12px]" />
              <Button
                variant="badge"
                onClick={async () => {
                  const files = await main('dialog.openFiles')
                  if (files[0]) void updateSettings({ voice: { ...voice, piperPath: files[0] } })
                }}
              >
                Choose…
              </Button>
            </div>
            <div className="flex gap-2">
              <Input readOnly value={voice.piperVoices} placeholder="Voices folder" className="font-mono text-[12px]" />
              <Button
                variant="badge"
                onClick={async () => {
                  const folder = await main('dialog.openFolder')
                  if (folder) void updateSettings({ voice: { ...voice, piperVoices: folder } })
                }}
              >
                Choose…
              </Button>
            </div>
          </div>
        </SettingRow>
      </SettingCard>
    </>
  )
}
