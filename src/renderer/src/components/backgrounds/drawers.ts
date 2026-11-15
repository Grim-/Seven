import type { BackgroundColors, BackgroundSettings, BaseBackground } from './base'

export type BackgroundMaker = new (colors: BackgroundColors, settings: BackgroundSettings) => BaseBackground

const makers = new Map<string, BackgroundMaker>()

export function registerBackgroundDrawer(id: string, maker: BackgroundMaker): void {
  makers.set(id, maker)
}

export function backgroundDrawer(id: string): BackgroundMaker | null {
  return makers.get(id) ?? null
}
