import type { ComponentType } from 'react'
import type { SettingSpec, SettingValue } from '@shared/settingSpec'

export interface SettingControlProps {
  spec: SettingSpec
  value: SettingValue
  onChange: (value: SettingValue) => void
}

export interface SettingControl {
  Control: ComponentType<SettingControlProps>
  wide: boolean
}

const controls = new Map<string, SettingControl>()

export function registerSettingControl(type: string, Control: ComponentType<SettingControlProps>, options: { wide?: boolean } = {}): void {
  controls.set(type, { Control, wide: options.wide ?? false })
}

export function settingControl(type: string): SettingControl | null {
  return controls.get(type) ?? null
}
