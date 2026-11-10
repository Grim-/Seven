import { useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Box,
  Flag,
  Maximize2,
  Minimize2,
  RotateCw,
  Shield,
  Trash2,
  X
} from 'lucide-react'
import type { ConditionGating, ObjectLayerData, PropCollision } from '@shared/maps'
import { Button, Segmented, confirmDelete } from '../ui'
import { ObjectPlayManager } from './ObjectPlayManager'
import { FlagSelect } from '../game/FlagSelect'
import { EntrySelect } from '../game/EntrySelect'
import { PictureFields } from './PictureFields'

interface Props {
  object: ObjectLayerData
  world?: string
  gating?: ConditionGating
  isExpanded?: boolean
  onToggleExpand?: () => void
  onChange: (next: ObjectLayerData) => void
  onChangeGating: (gating: ConditionGating | null) => void
  onBringToFront: () => void
  onSendToBack: () => void
  onDelete: () => void
  onClose: () => void
}

export function WorldObjectInspector({
  object,
  world = '',
  gating,
  isExpanded,
  onToggleExpand,
  onChange,
  onChangeGating,
  onBringToFront,
  onSendToBack,
  onDelete,
  onClose
}: Props) {
  const [name, setName] = useState(object.name)
  const [actions, setActions] = useState(object.actions ?? '')
  const [decisions, setDecisions] = useState(object.decisions ?? '')
  const [entry, setEntry] = useState(object.entry ?? '')
  const [needsFlag, setNeedsFlag] = useState(gating?.needsFlag ?? '')
  const [hiddenIfFlag, setHiddenIfFlag] = useState(gating?.hiddenIfFlag ?? '')

  const handleBlurName = () => {
    if (name.trim() && name !== object.name) {
      onChange({ ...object, name: name.trim() })
    }
  }

  const rotate90 = () => {
    const nextRot = (object.rotation + 90) % 360
    onChange({ ...object, rotation: nextRot })
  }

  return (
    <div className="flex h-full min-h-0 flex-col font-mono text-[12px] select-none bg-black/95">
      {/* HEADER BAR */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Box className="h-4 w-4 text-cyan" />
          <span className="font-bold uppercase tracking-wider text-white truncate max-w-[240px]">
            {object.name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-dim hover:text-white p-1 transition-colors"
              title={isExpanded ? 'Collapse panel (360px)' : 'Expand panel outwards (680px)'}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-dim hover:text-white p-1 transition-colors"
            title="Close Inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* BODY SCROLL CONTAINER */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        {/* PREVIEW & NAME */}
        <div className="flex items-center gap-3 border border-line/60 bg-panel p-2.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-line bg-black/90 p-1">
            <img src={object.image} alt={object.name} className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleBlurName}
              placeholder="Object Name"
              className="border border-line bg-black/60 px-2 py-1 text-[12px] font-bold text-white focus:border-cyan focus:outline-none"
            />
            <div className="flex items-center gap-2 text-[10px] text-dim">
              <span>Pos: ({object.offset.x}, {object.offset.y})</span>
              <span>·</span>
              <span>Rot: {object.rotation}°</span>
              <span>·</span>
              <span>Scale: {object.scale}×</span>
            </div>
          </div>
        </div>

        {/* TRANSFORMS & POSITIONING */}
        <div className="flex flex-col gap-2 border-t border-line/40 pt-2.5">
          <PictureFields layer={object} onChange={onChange} />
        </div>

        {/* COLLISION MODE */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-dim flex items-center gap-1">
            <Shield className="h-3 w-3 text-cyan" /> Collision &amp; Physical Passability:
          </label>
          <Segmented
            value={object.collision ?? 'solid'}
            onChange={(v) => onChange({ ...object, collision: v as PropCollision })}
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'passable', label: 'Passable' },
              { value: 'water', label: 'Water' }
            ]}
          />
        </div>

        {/* LINKED ENTRY */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-dim">
            Linked Library Entry (Optional):
          </label>
          <EntrySelect
            value={entry || null}
            onChange={(val) => {
              setEntry(val ?? '')
              onChange({ ...object, entry: val })
            }}
          />
        </div>

        {/* STRUCTURED ACTIONS & DECISIONS BUILDER */}
        <ObjectPlayManager
          actionsText={actions}
          decisionsText={decisions}
          onChangeActions={(nextActions) => {
            setActions(nextActions)
            onChange({ ...object, actions: nextActions })
          }}
          onChangeDecisions={(nextDecisions) => {
            setDecisions(nextDecisions)
            onChange({ ...object, decisions: nextDecisions })
          }}
          world={world}
        />

        {/* FLAG GATING */}
        <div className="border border-line/50 bg-black/40 p-2.5 flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan flex items-center gap-1">
            <Flag className="h-3 w-3" /> World Flag Gating:
          </span>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase text-dim">Visible If Flag Set:</label>
            <FlagSelect
              world={world}
              value={needsFlag || undefined}
              onChange={(f) => {
                const nextVal = f ?? ''
                setNeedsFlag(nextVal)
                if (nextVal || hiddenIfFlag) {
                  onChangeGating({ needsFlag: nextVal || undefined, hiddenIfFlag: hiddenIfFlag || undefined })
                } else {
                  onChangeGating(null)
                }
              }}
              placeholder="None (Always Visible)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase text-dim">Hidden If Flag Set:</label>
            <FlagSelect
              world={world}
              value={hiddenIfFlag || undefined}
              onChange={(f) => {
                const nextVal = f ?? ''
                setHiddenIfFlag(nextVal)
                if (needsFlag || nextVal) {
                  onChangeGating({ needsFlag: needsFlag || undefined, hiddenIfFlag: nextVal || undefined })
                } else {
                  onChangeGating(null)
                }
              }}
              placeholder="None (Never Hidden)"
            />
          </div>
        </div>

        {/* LAYER ACTIONS */}
        <div className="grid grid-cols-3 gap-1.5 border-t border-line/40 pt-3">
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCw className="h-3 w-3" />}
            onClick={rotate90}
            className="text-[10px] px-1.5"
          >
            Rotate 90°
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<ArrowUpToLine className="h-3 w-3" />}
            onClick={onBringToFront}
            className="text-[10px] px-1.5"
          >
            To Front
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<ArrowDownToLine className="h-3 w-3" />}
            onClick={onSendToBack}
            className="text-[10px] px-1.5"
          >
            To Back
          </Button>
        </div>
      </div>

      {/* FOOTER */}
      <div className="border-t border-line p-3 flex items-center justify-between">
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 className="h-3.5 w-3.5" />}
          onClick={() =>
            confirmDelete(`Delete ${object.name}?`, 'This removes it from the map.', async () => {
              onDelete()
            })
          }
          className="text-alert hover:text-alert/80"
        >
          Delete Object
        </Button>
        <Button size="sm" variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}
