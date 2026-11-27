import type { Theme, ThemeInput } from '@shared/theme'

export type AssetUrl = (id: string) => string | null

export interface SkinReader {
  value(name: string): string
  number(name: string): number | undefined
  color(name: string): string | null
}

export interface SkinSection {
  assets?(theme: Theme): string[]
  load?(theme: Theme, url: AssetUrl): Promise<void>
  vars?(theme: Theme, url: AssetUrl): Record<string, string>
  attrs?(theme: Theme): Record<string, string>
  read?(read: SkinReader): ThemeInput
}

const sections: SkinSection[] = []

export function registerSkinSection(section: SkinSection): void {
  sections.push(section)
}

export function skinSections(): SkinSection[] {
  return sections
}

export function cssUrl(url: string | null): string | null {
  return url ? `url(${JSON.stringify(url)})` : null
}

export function present(values: Record<string, string | null | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter((e): e is [string, string] => typeof e[1] === 'string'))
}
