import { placeRef } from '@shared/maps'
import type { KindScreenProps } from '../../registries/kinds'
import { PlaceEditor } from './PlaceEditor'

export function PlaceScreen({ id, select }: KindScreenProps) {
  if (!id) return null
  const { world, key } = placeRef(id)
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <PlaceEditor key={id} world={world} placeKey={key} onDeleted={() => select(null)} />
    </div>
  )
}
