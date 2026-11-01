import type { ImageLayerData } from '@shared/maps'
import { ActionBar, Eyebrow, Input, type MenuItem } from '../ui'
import { PictureFields } from './PictureFields'

export function PicturePanel({ layer, actions, onChange }: { layer: ImageLayerData; actions: MenuItem[]; onChange: (next: ImageLayerData) => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <Eyebrow>Picture layer</Eyebrow>
        <Input value={layer.name} onChange={(e) => onChange({ ...layer, name: e.target.value })} />
        <PictureFields layer={layer} onChange={onChange} />
        <span className="text-[11.5px] text-faint">Pick it in the layer list to change it here. On the map it can't be clicked, so it never gets in the way of places, objects or characters.</span>
      </div>
      <ActionBar items={actions} className="shrink-0 border-t border-line/40 p-2.5" />
    </div>
  )
}
