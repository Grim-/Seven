import { settingsFor, type SettingSpec } from '../settingSpec'

export interface BackgroundReaction {
  name: string
  description: string
}

export type BackgroundSetting = SettingSpec

export interface BackgroundInfo {
  id: string
  name: string
  description: string
  reactions: BackgroundReaction[]
  settings: BackgroundSetting[]
}

export type EffectSettings = Record<string, number | string>

const infos = new Map<string, BackgroundInfo>()

export function registerBackgroundInfo(info: BackgroundInfo): void {
  infos.set(info.id, info)
}

export function backgroundList(): BackgroundInfo[] {
  return [...infos.values()]
}

export function backgroundInfo(id: string | null | undefined): BackgroundInfo | null {
  return (id && infos.get(id)) || null
}

export function effectSettingsFor(info: BackgroundInfo, saved: EffectSettings): EffectSettings {
  return settingsFor(info.settings, saved) as EffectSettings
}
