import { THEME_COLORS, isThemeColor } from '@shared/settingSpec'
import { ColorRow, Field } from '../../ui'
import { cn } from '../../../lib/cn'
import { registerSettingControl, type SettingControlProps } from '../controls'

function ColorControl({ spec, value, onChange }: SettingControlProps) {
  const text = String(value)
  return (
    <Field label={spec.label} hint={spec.hint}>
      <div className="flex flex-wrap items-center gap-1.5">
        {spec.themed &&
          THEME_COLORS.map((c) => (
            <button key={c.value} type="button" onClick={() => onChange(c.value)} className={cn('h-6 border px-1.5 font-mono text-[10px] uppercase', text === c.value ? 'border-white text-white' : 'border-line text-dim')}>
              {c.label}
            </button>
          ))}
        <ColorRow value={isThemeColor(text) ? null : text} onChange={(c) => c && onChange(c)} />
      </div>
    </Field>
  )
}

registerSettingControl('color', ColorControl)
