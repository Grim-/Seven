import type { InstallChoice, InstallRelease } from '@shared/types'
import type { ParamSchema } from '@shared/game/core/params'

export interface ReleaseAsset {
  name: string
  size: number
  url: string
  sha256: string | null
}

export interface StoredRelease extends InstallRelease {
  assets: ReleaseAsset[]
}

export interface Choice extends InstallChoice {
  assets: ReleaseAsset[]
}

export interface Checked {
  ok: boolean
  version: string
  devices: string
  help: string
  flags: string[] | null
  error: string | null
}

export type Settings = Record<string, unknown>

export interface InstallHelper {
  id: string
  title: string
  about: string
  program: string
  schema: ParamSchema
  defaultRoot(): string
  source(settings: Settings): string
  releases(settings: Settings, signal: AbortSignal): Promise<StoredRelease[]>
  choices(release: StoredRelease, settings: Settings): Promise<Choice[]>
  unpack(files: string[], staging: string): Promise<string>
  verify(folder: string, settings: Settings): Promise<Checked>
  activeBefore?(root: string): string | null
}

export const SHARED_SCHEMA: ParamSchema = {
  updateCheckHours: { kind: 'number', default: 0, min: 0, section: 'Updates', label: 'Check for updates every (hours)', description: 'How often Seven looks for new releases on its own. 0 checks only when you press Check for updates.' }
}

const helpers = new Map<string, InstallHelper>()

export function registerHelper(helper: InstallHelper): void {
  helpers.set(helper.id, helper)
}

export function schemaOf(helper: InstallHelper): ParamSchema {
  return { ...SHARED_SCHEMA, ...helper.schema }
}

export function helperOf(id: string): InstallHelper {
  const helper = helpers.get(id)
  if (!helper) throw new Error(`Seven has no installer called ${id}.`)
  return helper
}

/** Return metadata for every registered helper installer. */
export function listHelpers(): { id: string; title: string; about: string }[] {
  return [...helpers.values()].map((h) => ({ id: h.id, title: h.title, about: h.about }))
}
