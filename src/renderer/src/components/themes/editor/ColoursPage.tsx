import { COLOUR_NAMES, MAIN_COLOURS, SCHEME_NAMES, TINT_NAMES, type SkinColour } from '@shared/themeLook'
import { SettingCard, SettingGrid } from '../../ui'
import { useRoleColours } from '../../../lib/skins/useRoleColours'
import { ChoiceTune } from './ChoiceTune'
import { ColorTune } from './ColorTune'
import { withKey, type SectionProps } from './edit'

const GROUPS: { title: string; intro: string; ids: SkinColour[] }[] = [
  { title: 'Surfaces', intro: 'The panels, cards and fields on the ground.', ids: ['sidebar', 'panel', 'card', 'card-hover', 'well'] },
  { title: 'Text', intro: 'Fainter text, and text drawn on a filled accent.', ids: ['dim', 'faint', 'on-accent'] },
  { title: 'Lines', intro: 'Borders, rules and dividers.', ids: ['line', 'line-strong', 'line-hover'] },
  { title: 'Accents', intro: 'Darker and text shades of the accents.', ids: ['accent-dark', 'secondary-ink'] },
  { title: 'Status', intro: 'Errors, warnings and things that went well.', ids: ['alert', 'warn', 'ok'] },
  { title: 'Shadow and dimming', intro: 'The colour of shadows, and the veil behind dialogs.', ids: ['shade', 'scrim'] }
]

const LABEL = new Map(COLOUR_NAMES.map((c) => [c.id, c.label]))

export function ColoursPage({ draft, set }: SectionProps) {
  const roles = useRoleColours()
  const colour = (id: SkinColour, v: string | null) => set({ colours: withKey(draft.colours, id, v) })
  const tune = (id: SkinColour) => <ColorTune key={id} label={LABEL.get(id) ?? id} value={draft.colours[id] ?? null} fallback={roles.colours[id]} alpha onChange={(v) => colour(id, v)} />
  return (
    <>
      <SettingCard title="Main colours" intro="Unset colours below follow from these.">
        <SettingGrid min="20rem">{MAIN_COLOURS.map(tune)}</SettingGrid>
      </SettingCard>
      <SettingCard title="Scheme">
        <ChoiceTune label="Light or dark" hint="Sets the look of native controls such as dropdown lists and scrollbars." value={draft.scheme ?? undefined} fallback="dark" options={SCHEME_NAMES} onChange={(scheme) => set({ scheme: scheme ?? null })} />
      </SettingCard>
      {GROUPS.map((g) => (
        <SettingCard key={g.title} title={g.title} intro={g.intro}>
          <SettingGrid min="20rem">{g.ids.map(tune)}</SettingGrid>
        </SettingCard>
      ))}
      <SettingCard title="Tints" intro="Colours for coloured pieces, tags and game categories (spell schools, combat choices, bars). Unset tints keep Seven's colours; cyan and teal follow the secondary colour.">
        <SettingGrid min="20rem">
          {TINT_NAMES.map((t) => (
            <ColorTune key={t.id} label={t.label} value={draft.tints[t.id] ?? null} alpha onChange={(v) => set({ tints: withKey(draft.tints, t.id, v) })} />
          ))}
        </SettingGrid>
      </SettingCard>
    </>
  )
}
