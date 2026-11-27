import type { AvatarTreatmentInfo, TreatmentEntry } from '@shared/avatars'
import type { BaseTreatment } from './BaseTreatment'

export type TreatmentMaker = new (entry: TreatmentEntry, info: AvatarTreatmentInfo) => BaseTreatment

const makers = new Map<string, TreatmentMaker>()

export function registerTreatmentDrawer(id: string, maker: TreatmentMaker): void {
  makers.set(id, maker)
}

export function treatmentDrawer(id: string): TreatmentMaker | null {
  return makers.get(id) ?? null
}
