import { useState } from 'react'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Boxes,
  Check,
  Copy,
  Flag,
  ImagePlus,
  Layers,
  Maximize2,
  Minimize2,
  Plus,
  RotateCw,
  Shield,
  Sliders,
  Sparkles,
  Swords,
  Trash2,
  X
} from 'lucide-react'
import type { ObjectLayerData, ObjectStateRule, PropCollision } from '@shared/maps'
import { ActionBar, Button, Eyebrow, Input, Segmented, Select, ShellTabs, SliderNumber, type MenuItem } from '../ui'
import { PictureFields } from './PictureFields'
import { ObjectPlayManager } from './ObjectPlayManager'
import { FlagSelect } from '../game/FlagSelect'
import { EntityPieces } from '../game/EntityPieces'
import { pickMapPicture } from './addImageLayer'
import { assetUrl, useAsset } from '../../store/data'

interface Props {
  object: ObjectLayerData
  world?: string
  isExpanded?: boolean
  onToggleExpand?: () => void
  onChange: (next: ObjectLayerData) => void
  onClose: () => void
  onDuplicate: () => void
  onDelete: () => void
  onBringToFront?: () => void
  onSendToBack?: () => void
}

const COLLISION_OPTIONS: { value: PropCollision; label: string; hint: string }[] = [
  { value: 'solid', label: 'Solid', hint: 'Blocks movement & line of sight' },
  { value: 'passable', label: 'Passable', hint: 'Walkable floor prop, rug, or debris' },
  { value: 'water', label: 'Water', hint: 'Blocks walking, requires flight/swim' }
]

type ObjectTab = 'attributes' | 'behaviors' | 'logic' | 'pieces'

function StateSpritePreview({ imageId }: { imageId?: string }) {
  const isDataUri = imageId?.startsWith('data:')
  const asset = useAsset(isDataUri ? '' : imageId ?? '')
  const src = isDataUri ? imageId : asset ? assetUrl(asset) : imageId

  if (!src) {
    return <div className="h-9 w-9 shrink-0 border border-line/40 tone-well-60 flex items-center justify-center text-[9px] text-faint">Base</div>
  }

  return (
    <div className="h-9 w-9 shrink-0 border border-line tone-well-80 p-0.5 flex items-center justify-center overflow-hidden">
      <img src={src} alt="State Sprite" className="max-h-full max-w-full object-contain" />
    </div>
  )
}

export function ObjectPanel({
  object,
  world = '',
  isExpanded = false,
  onToggleExpand,
  onChange,
  onClose,
  onDuplicate,
  onDelete,
  onBringToFront,
  onSendToBack
}: Props) {
  const [activeTab, setActiveTab] = useState<ObjectTab>('attributes')

  const actions: MenuItem[] = [
    { label: 'Done', icon: <Check />, onSelect: onClose },
    { label: 'Duplicate', icon: <Copy />, onSelect: onDuplicate },
    { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: onDelete }
  ]

  const rotate90 = () => {
    onChange({ ...object, rotation: (object.rotation + 90) % 360 })
  }

  const states = object.states ?? []

  const handleAddState = () => {
    const newRule: ObjectStateRule = {
      id: crypto.randomUUID(),
      name: `State ${states.length + 1}`,
      priority: states.length > 0 ? Math.max(...states.map((s) => s.priority ?? 0)) + 10 : 10,
      flag: '',
      match: 'is_set',
      collision: object.collision ?? 'solid'
    }
    onChange({ ...object, states: [newRule, ...states] })
  }

  const handleUpdateRule = (ruleId: string, patch: Partial<ObjectStateRule>) => {
    const nextStates = states.map((s) => (s.id === ruleId ? { ...s, ...patch } : s))
    onChange({ ...object, states: nextStates })
  }

  const handleDeleteRule = (ruleId: string) => {
    const nextStates = states.filter((s) => s.id !== ruleId)
    onChange({ ...object, states: nextStates })
  }

  const handleMoveRule = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= states.length) return
    const nextStates = [...states]
    const temp = nextStates[index]
    nextStates[index] = nextStates[targetIndex]
    nextStates[targetIndex] = temp
    // Re-assign descending priorities to preserve exact visual list order
    const updated = nextStates.map((s, idx) => ({ ...s, priority: (nextStates.length - idx) * 10 }))
    onChange({ ...object, states: updated })
  }

  const handlePickAlternateSprite = async (ruleId: string) => {
    const picked = await pickMapPicture('an alternate sprite for this state')
    if (picked) {
      handleUpdateRule(ruleId, { image: picked.asset.id })
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col font-ui select-none tone-panel-95 text-[12px]">
      {/* HEADER BAR */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5 tone-panel-80">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="h-4 w-4 text-secondary-ink shrink-0" />
          <span className="font-bold caps-5 text-ink truncate max-w-[200px]">
            {object.name || 'Map Prop'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-dim hover:text-ink p-1 transition-colors"
              title={isExpanded ? 'Collapse panel (360px)' : 'Expand panel (680px)'}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-dim hover:text-ink p-1 transition-colors"
            title="Close Panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* SUB-TABS */}
      <ShellTabs
        value={activeTab}
        options={[
          { value: 'attributes' as const, label: 'Attributes', icon: <Sliders className="h-3 w-3" /> },
          { value: 'behaviors', label: 'States', icon: <Sparkles className="h-3 w-3" />, count: states.length },
          { value: 'logic', label: 'Actions & Decisions', icon: <Swords className="h-3 w-3" /> },
          { value: 'pieces', label: 'Pieces', icon: <Boxes className="h-3 w-3" />, count: (object.comps ?? []).length }
        ]}
        onChange={setActiveTab}
      />

      {/* BODY SCROLL CONTAINER */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {/* TAB 1: ATTRIBUTES */}
        {activeTab === 'attributes' && (
          <div className="flex flex-col gap-3">
            {/* PROP IDENTIFICATION */}
            <div className="flex flex-col gap-1.5">
              <Eyebrow>Map Prop Name</Eyebrow>
              <Input
                value={object.name}
                placeholder="Prop Name (e.g. Wooden Chest, Fallen Tree)"
                onChange={(e) => onChange({ ...object, name: e.target.value })}
                className="h-7 text-[12px]"
              />
            </div>

            {/* BASE COLLISION & PASSABILITY */}
            <div className="flex flex-col gap-1.5 border-t border-line/40 pt-2.5">
              <div className="flex items-center gap-1.5 text-faint">
                <Shield className="h-3 w-3 text-secondary-ink" />
                <span className="text-[10px] caps-5 ">Base Collision / Passability</span>
              </div>
              <Segmented
                value={object.collision ?? 'solid'}
                options={COLLISION_OPTIONS}
                onChange={(collision) => onChange({ ...object, collision })}
              />
            </div>

            {/* SPATIAL & VISUAL ATTRIBUTES */}
            <div className="flex flex-col gap-2 border-t border-line/40 pt-2.5">
              <PictureFields layer={object} onChange={onChange} />
            </div>

            {/* QUICK TRANSFORMS & LAYERING */}
            <div className="flex flex-col gap-1.5 border-t border-line/40 pt-2.5">
              <span className="text-[10px] caps-5 text-faint">Arrangement</span>
              <div className="grid grid-cols-3 gap-1">
                <Button size="sm" variant="ghost" icon={<RotateCw className="h-3 w-3" />} onClick={rotate90} title="Rotate 90 degrees clockwise">
                  +90°
                </Button>
                {onBringToFront && (
                  <Button size="sm" variant="ghost" icon={<ArrowUpToLine className="h-3 w-3" />} onClick={onBringToFront} title="Bring prop in front of other layers">
                    Top
                  </Button>
                )}
                {onSendToBack && (
                  <Button size="sm" variant="ghost" icon={<ArrowDownToLine className="h-3 w-3" />} onClick={onSendToBack} title="Send prop behind other layers">
                    Back
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STATE BEHAVIORS */}
        {activeTab === 'behaviors' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-ink caps-5 ">
                  State Variations
                </span>
                <span className="text-[10px] text-dim">
                  Evaluated top-to-bottom. First matching flag state wins.
                </span>
              </div>
              <Button size="sm" variant="secondary" icon={<Plus className="h-3 w-3" />} onClick={handleAddState}>
                Add State
              </Button>
            </div>

            {states.length === 0 ? (
              <div className="flex flex-col items-center justify-center border border-dashed border-line/60 tone-panel-40 p-6 text-center text-dim text-[11px] gap-2">
                <span>No state variations configured.</span>
                <span className="text-[10px] text-faint max-w-[280px]">
                  Add states to change this object's sprite (e.g. opened chest, burning torch, fallen log) or collision based on world flags.
                </span>
                <Button size="sm" variant="primary" icon={<Plus className="h-3 w-3" />} onClick={handleAddState} className="mt-2">
                  Create First State
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {states.map((rule, idx) => (
                  <div
                    key={rule.id}
                    className="border border-line/60 tone-well-60 p-2.5 flex flex-col gap-2.5 transition-colors hover:border-line"
                  >
                    {/* RULE HEADER */}
                    <div className="flex items-center justify-between border-b border-line/40 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-secondary-ink/20 border border-secondary-ink/40 px-1.5 py-0.5 text-[9px] font-bold text-secondary-ink">
                          #{idx + 1}
                        </span>
                        <input
                          type="text"
                          value={rule.name ?? ''}
                          placeholder={`State ${idx + 1}`}
                          onChange={(e) => handleUpdateRule(rule.id, { name: e.target.value })}
                          className="bg-transparent border-b border-transparent focus:border-secondary-ink text-[11px] font-bold text-ink px-1 outline-none max-w-[140px]"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveRule(idx, 'up')}
                          className="p-1 text-dim hover:text-ink disabled:opacity-20 transition-colors"
                          title="Move Up (Higher Priority)"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === states.length - 1}
                          onClick={() => handleMoveRule(idx, 'down')}
                          className="p-1 text-dim hover:text-ink disabled:opacity-20 transition-colors"
                          title="Move Down (Lower Priority)"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1 text-alert/70 hover:text-alert transition-colors ml-1"
                          title="Delete State Rule"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* FLAG CONDITION */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1 text-[10px] text-faint caps-5 ">
                        <Flag className="h-3 w-3 text-secondary-ink" /> Triggering World Flag:
                      </div>
                      <FlagSelect
                        world={world}
                        value={rule.flag}
                        onChange={(flag) => handleUpdateRule(rule.id, { flag: flag ?? '' })}
                        placeholder="Select or enter flag key..."
                      />
                      <div className="grid grid-cols-2 gap-1.5 mt-1">
                        <Select
                          value={rule.match ?? 'is_set'}
                          onChange={(match) => handleUpdateRule(rule.id, { match: match as any })}
                          options={[
                            { value: 'is_set', label: 'When Flag Is Set (True)' },
                            { value: 'is_not_set', label: 'When Flag Is Unset (False)' },
                            { value: 'equals', label: 'When Flag Equals...' }
                          ]}
                          className="h-7 text-[11px]"
                        />
                        {rule.match === 'equals' ? (
                          <Input
                            value={String(rule.value ?? '')}
                            placeholder="Target value..."
                            onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                            className="h-7 text-[11px]"
                          />
                        ) : (
                          <div className="text-[10px] text-dim flex items-center px-1">
                            {rule.match === 'is_not_set' ? 'Matches if false/unset' : 'Matches if truthy'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* STATE OVERRIDES (Sprite, Collision, Opacity, Hidden) */}
                    <div className="border-t border-line/30 pt-2 flex flex-col gap-2">
                      <span className="text-[10px] caps-5 text-faint">
                        State Overrides
                      </span>

                      {/* Alternate Sprite */}
                      <div className="flex items-center gap-2">
                        <StateSpritePreview imageId={rule.image} />
                        <div className="flex flex-col min-w-0 flex-1 gap-1">
                          <div className="flex items-center gap-1.5">
                            <Input
                              value={rule.image ?? ''}
                              placeholder="Base Sprite (No override)"
                              onChange={(e) => handleUpdateRule(rule.id, { image: e.target.value || undefined })}
                              className="h-7 flex-1 text-[11px]"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<ImagePlus className="h-3.5 w-3.5" />}
                              onClick={() => handlePickAlternateSprite(rule.id)}
                              title="Pick sprite asset"
                              className="h-7 px-2"
                            >
                              Pick
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Collision Override */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[9.5px] caps text-dim">Collision Override:</span>
                        <Segmented
                          value={rule.collision ?? object.collision ?? 'solid'}
                          options={[
                            { value: 'solid', label: 'Solid' },
                            { value: 'passable', label: 'Passable' },
                            { value: 'water', label: 'Water' }
                          ]}
                          onChange={(collision) => handleUpdateRule(rule.id, { collision })}
                        />
                      </div>

                      {/* Opacity & Visibility */}
                      <div className="grid grid-cols-[60px_1fr] items-center gap-2 pt-1">
                        <span className="text-[10px] caps text-faint">Opacity</span>
                        <SliderNumber
                          value={rule.opacity ?? 1}
                          min={0}
                          max={1}
                          step={0.05}
                          onChange={(opacity) => handleUpdateRule(rule.id, { opacity })}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ACTIONS & DECISIONS */}
        {activeTab === 'logic' && (
          <div className="flex flex-col gap-3">
            <div className="border border-secondary-ink/30 bg-secondary-ink/5 p-2 text-[11px] text-secondary-ink leading-relaxed">
              Actions and decisions configured here are saved directly to this map object and travel with it into any world.
            </div>
            <ObjectPlayManager
              actionsText={object.actions ?? ''}
              decisionsText={object.decisions ?? ''}
              onChangeActions={(actions) => onChange({ ...object, actions })}
              onChangeDecisions={(decisions) => onChange({ ...object, decisions })}
              world={world}
            />
          </div>
        )}

        {activeTab === 'pieces' && <EntityPieces value={object.comps ?? []} onChange={(comps) => onChange({ ...object, comps })} />}
      </div>

      {/* FOOTER ACTIONS */}
      <ActionBar items={actions} className="shrink-0 border-t border-line/40 p-2.5" />
    </div>
  )
}
