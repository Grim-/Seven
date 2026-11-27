import { useMemo } from 'react'
import { SEVEN_THEME, THEME_SOUNDS, type ThemeSoundEvent } from '@shared/theme'
import { Select, SettingCard, SliderNumber, TunableRow } from '../../ui'
import { useData } from '../../../store/data'
import type { SectionProps } from './edit'

const SOUND_LABELS: Record<ThemeSoundEvent, string> = { reply: 'A reply finishes', reminder: 'A reminder fires', ask: 'Seven asks you something' }

export function SoundPage({ draft, set }: SectionProps) {
  const assets = useData((s) => s.assets)
  const sounds = useMemo(() => assets.filter((a) => a.kind === 'audio'), [assets])
  const soundOptions = [{ value: '', label: 'None' }, ...sounds.map((a) => ({ value: a.id, label: a.name }))]
  return (
    <>
      <SettingCard title="Music">
        <TunableRow label="Tracks" hint="Loop in this order." changed={draft.music.length > 0} onReset={() => set({ music: [] })} wide>
          <div className="max-h-48 overflow-y-auto border border-line/40 p-1.5">
            {!sounds.length && <div className="px-1 text-[12px] text-faint">No sound files in Data yet.</div>}
            {sounds.map((a) => (
              <label key={a.id} className="flex items-center gap-2 px-1 py-0.5 text-[12.5px] text-ink/85">
                <input
                  type="checkbox"
                  checked={draft.music.includes(a.id)}
                  onChange={(e) => set({ music: e.target.checked ? [...draft.music, a.id] : draft.music.filter((m) => m !== a.id) })}
                  className="accent-[var(--color-accent)]"
                />
                <span className="truncate">{a.name}</span>
              </label>
            ))}
          </div>
        </TunableRow>
        <TunableRow label="Volume" hint="Relative to the volume on the bottom bar." changed={draft.volume !== SEVEN_THEME.volume} onReset={() => set({ volume: SEVEN_THEME.volume })}>
          <SliderNumber value={Math.round(draft.volume * 100)} min={0} max={100} onChange={(v) => set({ volume: v / 100 })} />
        </TunableRow>
      </SettingCard>
      <SettingCard title="Sounds">
        {THEME_SOUNDS.map((k) => (
          <TunableRow key={k} label={SOUND_LABELS[k]} changed={draft.sounds[k] !== null} onReset={() => set({ sounds: { ...draft.sounds, [k]: null } })}>
            <Select value={draft.sounds[k] ?? ''} options={soundOptions} onChange={(v) => set({ sounds: { ...draft.sounds, [k]: v || null } })} />
          </TunableRow>
        ))}
      </SettingCard>
    </>
  )
}
