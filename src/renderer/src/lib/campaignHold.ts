import type { CharacterHold } from '@shared/characterHold'
import { engine } from './ipc'
import { useLive } from './useLive'
import { failed } from './notify'

export interface SheetHold {
  id: string
  title: string
  hold: CharacterHold
}

export function useSheetHolds(sheet: string, campaign: string | null): SheetHold[] | null {
  return useLive(() => engine('holds.ofSheet', { sheet, campaign }), 'almanacs.changed', [sheet, campaign])
}

export function saveCampaignHold(sheet: string, campaign: string, hold: CharacterHold): void {
  void engine('holds.save', { sheet, campaign, hold }).catch(failed('Could not save what this character holds in the campaign'))
}
