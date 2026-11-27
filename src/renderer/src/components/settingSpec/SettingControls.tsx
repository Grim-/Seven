import { RotateCcw } from 'lucide-react'
import { specShown, type SettingSpec, type SettingValue, type SettingValues } from '@shared/settingSpec'
import { cn } from '../../lib/cn'
import { settingControl } from './controls'
import './register'

export function SettingControls({
  specs,
  values,
  onChange,
  readOnly = false,
  changed = [],
  onReset,
  itemClassName
}: {
  specs: SettingSpec[]
  values: SettingValues
  onChange: (name: string, value: SettingValue) => void
  readOnly?: boolean
  changed?: string[]
  onReset?: (name: string) => void
  itemClassName?: string
}) {
  return (
    <fieldset disabled={readOnly} className="contents">
      {specs.map((spec) => {
        const control = settingControl(spec.type)
        if (!control || !specShown(spec, values)) return null
        const { Control } = control
        return (
          <div key={spec.name} className={cn('relative min-w-0', control.wide ? 'col-span-full w-full' : itemClassName)}>
            <Control spec={spec} value={values[spec.name] ?? spec.default} onChange={(v) => onChange(spec.name, v)} />
            {onReset && changed.includes(spec.name) && (
              <button type="button" title="Back to the base look" onClick={() => onReset(spec.name)} className="absolute right-0 top-0 flex items-center gap-1 font-label text-[10px] caps text-accent hover:text-ink">
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>
        )
      })}
    </fieldset>
  )
}
