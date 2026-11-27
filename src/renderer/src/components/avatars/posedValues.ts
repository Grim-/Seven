import { isThemeColor, type SettingValue, type SettingValues } from '@shared/settingSpec'
import type { AnimatedColors } from '../animated/Animated'

export function posedValue(settings: SettingValues, poses: Record<string, SettingValues>, name: string, key: string | null): SettingValue | undefined {
  const posed = key ? poses[key]?.[name] : undefined
  return posed !== undefined ? posed : settings[name]
}

export const asNumber = (v: SettingValue | undefined): number => (typeof v === 'number' ? v : 0)

export const asText = (v: SettingValue | undefined): string => (typeof v === 'string' ? v : '')

export const asFlag = (v: SettingValue | undefined): boolean => v === true

export function themedColor(v: string, colors: AnimatedColors): string {
  return isThemeColor(v) ? colors[v as 'accent' | 'secondary'] : v || colors.accent
}
