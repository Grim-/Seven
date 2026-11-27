import { FONT_NAMES, NUMERAL_NAMES, type FontRole, type LookFont } from '@shared/themeLook'
import { Input, SettingCard, TunableRow } from '../../ui'
import { PictureField } from '../../pictures/PictureField'
import { ChoiceTune } from './ChoiceTune'
import { withKey, type SectionProps } from './edit'

const FAMILY = /^[A-Za-z0-9 ,'"-]{0,200}$/

const SAMPLE = 'The quick brown fox jumps over the lazy dog · 0123456789'

function FontRow({ role, label, draft, set, defaults }: SectionProps & { role: FontRole; label: string }) {
  const font = draft.fonts[role]
  const change = (next: LookFont | null) => set({ fonts: withKey(draft.fonts, role, next) })
  return (
    <TunableRow label={label} changed={font !== undefined} onReset={() => change(null)} wide>
      <span className="flex w-full flex-col gap-2">
        <span className={`font-${role} truncate text-[17px] text-ink`}>{SAMPLE}</span>
        <span className="flex flex-wrap items-center gap-2">
          <Input
            value={font?.family ?? ''}
            placeholder={defaults.fonts?.[role]?.family}
            spellCheck={false}
            onChange={(e) => FAMILY.test(e.target.value) && change(e.target.value.trim() ? { family: e.target.value, file: font?.file ?? null } : null)}
            className="h-8 min-w-0 flex-1 font-mono text-[12px]"
          />
          <PictureField value={font?.file ?? null} options={{ kinds: ['file'], what: 'a font file' }} onChange={(file) => change({ family: font?.family || defaults.fonts?.[role]?.family || 'sans-serif', file })} />
        </span>
      </span>
    </TunableRow>
  )
}

export function FontsPage(props: SectionProps) {
  const { draft, set } = props
  return (
    <>
      <SettingCard title="Font families" intro="A list of fonts, first choice first. A font file goes in front of the list, so the look is the same on every machine.">
        {FONT_NAMES.map((f) => (
          <FontRow key={f.id} role={f.id} label={f.label} {...props} />
        ))}
      </SettingCard>
      <SettingCard title="Numbers">
        <ChoiceTune label="Figures" hint="Even width keeps columns of numbers lined up." value={draft.numerals ?? undefined} fallback="normal" options={NUMERAL_NAMES} onChange={(numerals) => set({ numerals: numerals ?? null })} />
      </SettingCard>
    </>
  )
}
