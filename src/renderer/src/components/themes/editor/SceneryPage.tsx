import { Play } from 'lucide-react'
import { SEVEN_THEME } from '@shared/theme'
import { DEFAULT_ANGLE } from '@shared/gradient'
import { BACKGROUND_MODULE, CORE_EFFECTS, backgroundInfo, backgroundList, effectSettingsFor } from '@shared/backgrounds'
import type { Backdrop } from '@shared/types'
import { Button, GradientField, Select, SettingCard, SettingRow, SliderNumber, TunableRow } from '../../ui'
import { PictureField } from '../../pictures/PictureField'
import { MEDIA_OPTIONS } from '../../pictures/mediaOptions'
import { SettingControls } from '../../settingSpec/SettingControls'
import { runCue } from '../../shell/ThemeStage'
import { useTools } from '../../../store/tools'
import { useRoleColours } from '../../../lib/skins/useRoleColours'
import type { SectionProps } from './edit'

function BackgroundCard({ draft, set }: SectionProps) {
  const backdrop = draft.backdrop
  const change = (patch: Partial<Backdrop>) => {
    const next: Backdrop = { colors: [], image: backdrop?.image ?? null, slideshow: backdrop?.slideshow ?? null, dim: backdrop?.dim ?? 0.55, ...patch }
    set({ backdrop: next.image || next.slideshow ? next : null })
  }
  return (
    <SettingCard title="Background">
      <TunableRow label="Picture or video" hint="Behind everything, under the sky." changed={Boolean(backdrop)} onReset={() => set({ backdrop: null })} wide>
        <PictureField value={backdrop?.image ?? null} options={MEDIA_OPTIONS} onChange={(image) => change({ image })} />
      </TunableRow>
      {backdrop && (
        <SettingRow label="Darken the picture">
          <SliderNumber value={Math.round(backdrop.dim * 100)} min={0} max={90} onChange={(v) => change({ dim: v / 100 })} />
        </SettingRow>
      )}
    </SettingCard>
  )
}

function GradientCard({ draft, set }: SectionProps) {
  const roles = useRoleColours()
  const gradient = draft.gradient
  const angle = gradient?.angle ?? DEFAULT_ANGLE
  return (
    <SettingCard title="Gradient">
      <TunableRow label="Colours" hint="Over the picture and the sky, under the mood light." changed={Boolean(gradient)} onReset={() => set({ gradient: null })} wide>
        <GradientField
          stops={gradient?.stops ?? []}
          newColour={(draft.colours.bg ?? roles.colours.bg).slice(0, 7)}
          angle={angle}
          onAngle={(next) => gradient && set({ gradient: { ...gradient, angle: next } })}
          onChange={(stops) => set({ gradient: stops.length ? { stops, angle } : null })}
        />
      </TunableRow>
    </SettingCard>
  )
}

function EffectCard({ draft, set }: SectionProps) {
  const addonOn = useTools((s) => s.list.some((m) => m.id === BACKGROUND_MODULE && m.state === 'on'))
  const info = backgroundInfo(draft.effect)
  const options = [...CORE_EFFECTS.map((e) => ({ value: e.id, label: e.name })), ...(addonOn || info ? backgroundList().map((b) => ({ value: b.id, label: b.name })) : [])]
  const values = info ? effectSettingsFor(info, draft.effectSettings) : {}
  const hint = info ? (addonOn ? info.description : 'The Backgrounds add-on is off, so this shows nothing until it is on.') : addonOn ? 'Off everywhere if animated backgrounds are off in Settings.' : 'Turn on the Backgrounds add-on in Tools for more.'
  return (
    <SettingCard title="Animated background">
      <TunableRow label="Background" hint={hint} changed={draft.effect !== SEVEN_THEME.effect} onReset={() => set({ effect: SEVEN_THEME.effect, effectSettings: {} })}>
        <Select value={draft.effect} options={options} onChange={(v) => set({ effect: v, effectSettings: v === draft.effect ? draft.effectSettings : {} })} />
      </TunableRow>
      {info && info.reactions.length > 0 && (
        <SettingRow label="Reactions" hint="The agent plays these with cue. Try one here.">
          <span className="flex flex-wrap gap-1.5">
            {info.reactions.map((r) => (
              <Button key={r.name} size="sm" variant="secondary" icon={<Play />} title={r.description} onClick={() => runCue({ sound: null, flash: null, shake: false, reaction: r.name })}>
                {r.name.replace(/_/g, ' ')}
              </Button>
            ))}
          </span>
        </SettingRow>
      )}
      {info && <SettingControls specs={info.settings} values={values} readOnly={false} onChange={(name, value) => set({ effectSettings: { ...draft.effectSettings, [name]: value as number | string } })} />}
    </SettingCard>
  )
}

function ChatFadeCard({ draft, set }: SectionProps) {
  return (
    <SettingCard title="Tabletop chat">
      <TunableRow label="Unpinned chat fade" hint="Opacity of the chat stream in Tabletop mode when unpinned and not hovered or focused." changed={draft.chatFadeOpacity !== SEVEN_THEME.chatFadeOpacity} onReset={() => set({ chatFadeOpacity: SEVEN_THEME.chatFadeOpacity })}>
        <SliderNumber value={Math.round(draft.chatFadeOpacity * 100)} min={0} max={100} onChange={(v) => set({ chatFadeOpacity: v / 100 })} />
      </TunableRow>
    </SettingCard>
  )
}

export function SceneryPage(props: SectionProps) {
  return (
    <>
      <BackgroundCard {...props} />
      <GradientCard {...props} />
      <EffectCard {...props} />
      <ChatFadeCard {...props} />
    </>
  )
}
