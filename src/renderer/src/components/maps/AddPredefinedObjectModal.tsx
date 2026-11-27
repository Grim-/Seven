import { useState } from 'react'
import { Image, Plus, Shield } from 'lucide-react'
import type { MapData, ObjectLayerData, PropCollision } from '@shared/maps'
import type { Point } from '@shared/shapes'
import { newObject } from '@shared/maps'
import { PREDEFINED_OBJECTS, type PredefinedObject } from '@shared/game/predefinedObjects'
import type { StoredMapObject } from '@shared/game/mapObjects'
import { Button, Modal, Segmented } from '../ui'
import { pickMapPicture } from './addImageLayer'
import { ObjectPlayManager } from './ObjectPlayManager'
import { FlagSelect } from '../game/FlagSelect'
import { AssetMedia } from '../pictures/AssetMedia'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { cn } from '../../lib/cn'

interface Props {
  world?: string
  map?: MapData
  at: Point
  onClose: () => void
  onPlaced: (object: ObjectLayerData, gating?: { needsFlag?: string; hiddenIfFlag?: string }) => void
}

export function AddPredefinedObjectModal({ world = '', at, onClose, onPlaced }: Props) {
  const libraryObjects: StoredMapObject[] = useLive(() => engine('mapObjects.list'), 'mapObjects.changed') ?? []

  const [selectedTemplate, setSelectedTemplate] = useState<PredefinedObject | StoredMapObject>(PREDEFINED_OBJECTS[0])
  const [name, setName] = useState(PREDEFINED_OBJECTS[0].name)
  const [collision, setCollision] = useState<PropCollision>(PREDEFINED_OBJECTS[0].collision)
  const [actions, setActions] = useState(PREDEFINED_OBJECTS[0].actions)
  const [decisions, setDecisions] = useState(PREDEFINED_OBJECTS[0].decisions)
  const [needsFlag, setNeedsFlag] = useState('')
  const [hiddenIfFlag, setHiddenIfFlag] = useState('')
  const [category, setCategory] = useState<string>('All')

  const categories = libraryObjects.length > 0
    ? ['All', 'Library Objects', 'Containers', 'Doors & Portals', 'Interactables', 'Environment']
    : ['All', 'Containers', 'Doors & Portals', 'Interactables', 'Environment']

  const filtered = category === 'Library Objects'
    ? libraryObjects
    : category === 'All'
    ? [...libraryObjects, ...PREDEFINED_OBJECTS]
    : PREDEFINED_OBJECTS.filter((o) => o.category === category)

  const handleSelect = (tmpl: PredefinedObject | StoredMapObject) => {
    setSelectedTemplate(tmpl)
    setName(tmpl.name)
    setCollision(tmpl.collision)
    setActions(tmpl.actions)
    setDecisions(tmpl.decisions)
  }

  const handlePlacePredefined = () => {
    const object = newObject(name.trim() || selectedTemplate.name, selectedTemplate.image, selectedTemplate.size, at)
    object.collision = collision
    object.actions = actions.trim()
    object.decisions = decisions.trim()

    const gating = needsFlag.trim() || hiddenIfFlag.trim()
      ? { needsFlag: needsFlag.trim() || undefined, hiddenIfFlag: hiddenIfFlag.trim() || undefined }
      : undefined

    onPlaced(object, gating)
    onClose()
  }

  const handleCustomPicture = async () => {
    const picked = await pickMapPicture('a picture for the map object')
    if (!picked) return
    const customName = picked.asset.name.replace(/\.[^.]+$/, '')
    const object = newObject(customName, picked.asset.id, picked.size, at)
    object.collision = 'solid'
    onPlaced(object)
    onClose()
  }

  return (
    <Modal open={true} title={`Place Map Object at (${at.x}, ${at.y})`} onClose={onClose} wide>
      <div className="flex flex-col gap-4 font-ui select-none">
        {/* CATEGORY BAR */}
        <div className="flex items-center justify-between border-b border-line pb-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  'border px-2.5 py-1 text-[11px] font-bold caps transition-colors',
                  category === cat
                    ? 'border-secondary-ink bg-secondary-ink/15 text-ink'
                    : 'border-line/40 tone-well-40 text-dim hover:text-ink'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            variant="ghost"
            icon={<Image className="h-3.5 w-3.5 text-accent" />}
            onClick={() => void handleCustomPicture()}
          >
            Custom Asset Image
          </Button>
        </div>

        {/* TWO-COLUMN LAYOUT: TEMPLATE GALLERY & OBJECT CONFIG */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 min-h-[420px]">
          {/* GALLERY LIST */}
          <div className="flex flex-col gap-2 border border-line tone-panel-40 p-2.5 lg:col-span-5 max-h-[440px] overflow-y-auto divide-y divide-line/30">
            {filtered.map((tmpl) => {
              const isSelected = selectedTemplate.id === tmpl.id
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleSelect(tmpl)}
                  className={cn(
                    'flex items-center gap-3 p-2 text-left transition-colors',
                    isSelected
                      ? 'border-l-2 border-l-secondary-ink bg-secondary-ink/10 text-ink'
                      : 'text-dim hover:bg-ink/5 hover:text-ink'
                  )}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-line/60 tone-well-80 p-1">
                    {tmpl.image.startsWith('data:') || tmpl.image.includes('/') || tmpl.image.startsWith('http') ? (
                      <img src={tmpl.image} alt={tmpl.name} className="max-h-full max-w-full object-contain [image-rendering:pixelated]" />
                    ) : (
                      <AssetMedia id={tmpl.image} className="max-h-full max-w-full object-contain [image-rendering:pixelated]" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-[12px] font-bold text-ink">{tmpl.name}</span>
                      <span className="text-[9px] caps font-bold text-secondary-ink border border-secondary-ink/40 px-1">
                        {tmpl.collision}
                      </span>
                    </div>
                    <span className="text-[10px] text-faint truncate">
                      {'category' in tmpl ? tmpl.category : 'Library Object'}
                    </span>
                    <span className="text-[10px] text-dim truncate">{tmpl.description}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* OBJECT INSTANCE INSPECTOR & ACTIONS CONFIG */}
          <div className="flex flex-col justify-between border border-line tone-panel-60 p-4 lg:col-span-7">
            <div className="flex flex-col gap-3">
              {/* HEADER WITH PREVIEW */}
              <div className="flex items-center gap-3 border border-line/60 tone-surface-60 p-2.5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-line tone-panel-90 p-1.5">
                  {selectedTemplate.image.startsWith('data:') || selectedTemplate.image.includes('/') || selectedTemplate.image.startsWith('http') ? (
                    <img src={selectedTemplate.image} alt={name} className="max-h-full max-w-full object-contain [image-rendering:pixelated]" />
                  ) : (
                    <AssetMedia id={selectedTemplate.image} className="max-h-full max-w-full object-contain [image-rendering:pixelated]" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Object Name"
                    className="border border-line tone-panel-60 px-2 py-1 text-[13px] font-bold text-ink focus:border-secondary-ink focus:outline-none"
                  />
                  <div className="flex items-center gap-2 text-[10px] text-dim">
                    <span>Size: {selectedTemplate.size.w}×{selectedTemplate.size.h}px</span>
                    <span>·</span>
                    <span>At: ({at.x}, {at.y})</span>
                  </div>
                </div>
              </div>

              {/* COLLISION SELECTOR */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold caps text-dim flex items-center gap-1">
                  <Shield className="h-3 w-3 text-secondary-ink" /> Collision &amp; Passability:
                </label>
                <Segmented
                  value={collision}
                  onChange={(v) => setCollision(v as PropCollision)}
                  options={[
                    { value: 'solid', label: 'Solid (Blocks Movement)' },
                    { value: 'passable', label: 'Passable (Can Walk Through)' },
                    { value: 'water', label: 'Water' }
                  ]}
                />
              </div>

              {/* STRUCTURED ACTIONS & DECISIONS BUILDER */}
              <ObjectPlayManager
                actionsText={actions}
                decisionsText={decisions}
                onChangeActions={setActions}
                onChangeDecisions={setDecisions}
                world={world}
              />

              {/* CONDITION GATING */}
              <div className="grid grid-cols-2 gap-2 border-t border-line/40 pt-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold caps text-dim">Visible If Flag Set:</label>
                  <FlagSelect
                    world={world}
                    value={needsFlag}
                    onChange={(f) => setNeedsFlag(f ?? '')}
                    placeholder="None"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold caps text-dim">Hidden If Flag Set:</label>
                  <FlagSelect
                    world={world}
                    value={hiddenIfFlag}
                    onChange={(f) => setHiddenIfFlag(f ?? '')}
                    placeholder="None"
                  />
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-line/60 pt-3">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={handlePlacePredefined}
              >
                Place Object on World Map
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
