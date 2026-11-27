import type { WorldMeta } from '@shared/world'
import type { WorldMapUse } from '@shared/maps'
import { CreateOrBringCastModal } from './cast/CreateOrBringCastModal'

interface Props {
  world: WorldMeta
  uses: WorldMapUse[]
  onClose: () => void
  onAdded: (sheetId: string) => void
}

export function AddWorldCharacterModal({ world, uses, onClose, onAdded }: Props) {
  return <CreateOrBringCastModal world={world} uses={uses} onClose={onClose} onAdded={onAdded} />
}
