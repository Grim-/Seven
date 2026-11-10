import type { PackListing } from '@shared/types'
import { engine } from '../../../lib/ipc'
import { useLive } from '../../../lib/useLive'
import { failed } from '../../../lib/notify'

export function usePacks(modelId: string): { listing: PackListing | null; setOn: (on: string[]) => void } {
  const listing = useLive(() => engine('packs.list', { id: modelId }), 'packs.changed', [modelId])
  const setOn = (on: string[]) => void engine('packs.set', { id: modelId, on }).catch(failed('Could not change the packs'))
  return { listing, setOn }
}
