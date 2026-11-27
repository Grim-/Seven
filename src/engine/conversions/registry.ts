import type { ConversionDecision, ConversionOption } from '@shared/conversions'
import type { ArchiveFileInput } from '../portability/archive'

export interface ConversionInspection {
  affects: string[]
  options?: ConversionOption[]
  decisions?: ConversionDecision[]
}

export interface ConversionSpec {
  id: string
  /** Logical data domain (e.g. 'world-events'). At most ONE converter may exist per domain so chains cannot form. */
  domain: string
  title: string
  description: string
  blocking?: boolean
  /** Inspects disk for legacy data. Return null when nothing needs converting. */
  inspect: () => ConversionInspection | null
  /** Returns decrypted raw files to include in the user's pre-conversion .zip backup. */
  collectBackup: () => ArchiveFileInput[]
  /** Writes and verifies new files first, removes superseded legacy files last, and emits store change events. */
  apply: (choices: Record<string, string[]>) => { summary?: string } | void
}

const byDomain = new Map<string, ConversionSpec>()
const byId = new Map<string, ConversionSpec>()

export function registerConversion(spec: ConversionSpec): void {
  const existingDomain = byDomain.get(spec.domain)
  if (existingDomain && existingDomain.id !== spec.id) {
    throw new Error(
      `Domain "${spec.domain}" already has converter "${existingDomain.id}". Replace it with one direct-to-current converter instead of chaining.`
    )
  }
  byDomain.set(spec.domain, spec)
  byId.set(spec.id, spec)
}

export function registeredConversions(): ConversionSpec[] {
  return [...byDomain.values()]
}

export function conversionById(id: string): ConversionSpec | undefined {
  return byId.get(id)
}
