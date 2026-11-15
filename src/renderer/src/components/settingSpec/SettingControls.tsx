import { RotateCcw } from 'lucide-react'
import type { SettingSpec, SettingValue, SettingValues } from '@shared/settingSpec'
import { cn } from '../../lib/cn'
import { settingControl } from './controls'
import './register'

export function SettingControls({
  specs,
  values,
  onChange,
  readOnly = false,
  changed = [],
  onReset
}: {
  specs: SettingSpec[]
  values: SettingValues
  onChange: (name: string, value: SettingValue) => void
  readOnly?: boolean
  changed?: string[]
  onReset?: (name: string) => void
}) {
  return (
    <fieldset disabled={readOnly} className="contents">
      {specs.map((spec) => {
        const control = settingControl(spec.type)
        if (!control) return null
        const { Control } = control
        return (
          <div key={spec.name} className={cn('relative min-w-0', control.wide && 'col-span-full')}>
            <Control spec={spec} value={values[spec.name] ?? spec.default} onChange={(v) => onChange(spec.name, v)} />
            {onReset && changed.includes(spec.name) && (
              <button type="button" title="Back to the base look" onClick={() => onReset(spec.name)} className="absolute right-0 top-0 flex items-center gap-1 font-mono text-[10px] uppercase text-accent hover:text-white">
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
