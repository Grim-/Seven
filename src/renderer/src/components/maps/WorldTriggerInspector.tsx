import { useState } from 'react'
import { Flag, Maximize2, Minimize2, Trash2, X, Zap } from 'lucide-react'
import { triggerType, type TriggerDef, type TriggerFires } from '@shared/game/triggers'
import { shapeBounds, type ShapeForm } from '@shared/shapes'
import { Button, Segmented, confirmDelete } from '../ui'
import { ParamFields } from '../game/ParamFields'
import { FlagSelect } from '../game/FlagSelect'
import { ItemSelect } from '../game/ItemSelect'
import { triggerUi } from '../play/triggers/registry'
import { ObjectPlayManager } from './ObjectPlayManager'

interface Props {
  trigger: TriggerDef
  world?: string
  isExpanded?: boolean
  onToggleExpand?: () => void
  onChange: (next: TriggerDef) => void
  onDelete: () => void
  onClose: () => void
}

function resized(shape: ShapeForm, w: number, h: number): ShapeForm {
  const b = shapeBounds(shape)
  return { kind: 'box', x: Math.round(b.x + b.w / 2 - w / 2), y: Math.round(b.y + b.h / 2 - h / 2), w, h }
}

export function WorldTriggerInspector({ trigger, world = '', isExpanded, onToggleExpand, onChange, onDelete, onClose }: Props) {
  const [name, setName] = useState(trigger.name)
  const [fires, setFires] = useState<TriggerFires>(trigger.fires)
  const [once, setOnce] = useState(trigger.once)
  const [needsItem, setNeedsItem] = useState(trigger.needsItem)
  const [needsFlag, setNeedsFlag] = useState(trigger.needsFlag)
  const [hiddenIfFlag, setHiddenIfFlag] = useState(trigger.hiddenIfFlag ?? '')
  const [setsFlag, setSetsFlag] = useState(trigger.setsFlag)
  const [values, setValues] = useState<Record<string, unknown>>(trigger.values)

  const bounds = shapeBounds(trigger.shape)
  const [width, setWidth] = useState(Math.round(bounds.w))
  const [height, setHeight] = useState(Math.round(bounds.h))

  const type = triggerType(trigger.type)
  const ui = triggerUi(trigger.type)

  const handleSave = () => {
    const nextShape =
      width !== Math.round(bounds.w) || height !== Math.round(bounds.h)
        ? resized(trigger.shape, width, height)
        : trigger.shape

    onChange({
      ...trigger,
      name: name.trim() || trigger.name,
      fires,
      once,
      shape: nextShape,
      needsItem: needsItem.trim(),
      needsFlag: needsFlag.trim(),
      hiddenIfFlag: hiddenIfFlag.trim(),
      setsFlag: setsFlag.trim(),
      values
    })
  }

  const handleBlur = () => {
    handleSave()
  }

  return (
    <div className="flex h-full min-h-0 flex-col font-mono text-[12px] select-none bg-black/95">
      {/* HEADER BAR */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-accent" />
          <span className="font-bold uppercase tracking-wider text-white truncate max-w-[240px]">
            {trigger.name}
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

      {/* BODY SCROLL */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        {/* NAME & TYPE */}
        <div className="flex flex-col gap-1 border border-line/60 bg-panel p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-dim">Trigger Name:</span>
            <span className="text-[9px] uppercase font-bold text-accent border border-accent/40 px-1">
              {type?.label ?? trigger.type}
            </span>
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleBlur}
            className="border border-line bg-black/60 px-2 py-1 text-[12px] font-bold text-white focus:border-cyan focus:outline-none"
          />
        </div>

        {/* ACTIVATION EVENT */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase text-cyan">Activation Event:</label>
          <Segmented
            value={fires}
            onChange={(v) => {
              const nextFires = v as TriggerFires
              setFires(nextFires)
              onChange({ ...trigger, fires: nextFires })
            }}
            options={[
              { value: 'enter', label: 'On Enter (Step In)' },
              { value: 'interact', label: 'On Interact (Click)' }
            ]}
          />
        </div>

        {/* DIMENSIONS */}
        <div className="grid grid-cols-2 gap-2 border border-line/50 bg-black/40 p-2">
          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] uppercase text-dim">Width (px):</label>
            <input
              type="number"
              min={16}
              step={16}
              value={width}
              onChange={(e) => setWidth(Math.max(16, Number(e.target.value)))}
              onBlur={handleBlur}
              className="border border-line bg-panel px-2 py-0.5 text-[11px] text-white focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] uppercase text-dim">Height (px):</label>
            <input
              type="number"
              min={16}
              step={16}
              value={height}
              onChange={(e) => setHeight(Math.max(16, Number(e.target.value)))}
              onBlur={handleBlur}
              className="border border-line bg-panel px-2 py-0.5 text-[11px] text-white focus:outline-none"
            />
          </div>
        </div>

        {/* ONCE ONLY */}
        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-white">
          <input
            type="checkbox"
            checked={once}
            onChange={(e) => {
              const nextOnce = e.target.checked
              setOnce(nextOnce)
              onChange({ ...trigger, once: nextOnce })
            }}
            className="h-3.5 w-3.5 accent-cyan"
          />
          <span>Once Only (Single Use in Save)</span>
        </label>

        {/* TYPE SPECIFIC PARAMETERS */}
        {type && (
          <div className="border border-line/40 bg-panel p-2.5 flex flex-col gap-2">
            <span className="block text-[10px] font-bold uppercase text-accent">
              {type.label} Settings:
            </span>
            {ui?.Editor ? (
              <ui.Editor
                trigger={trigger}
                world={world}
                map=""
                onValues={(v) => {
                  setValues(v)
                  onChange({ ...trigger, values: v })
                }}
              />
            ) : type.type === 'play' ? (
              <ObjectPlayManager
                actionsText={String(values.actions ?? '')}
                decisionsText={String(values.decisions ?? '')}
                onChangeActions={(actions) => {
                  const nextValues = { ...values, actions }
                  setValues(nextValues)
                  onChange({ ...trigger, values: nextValues })
                }}
                onChangeDecisions={(decisions) => {
                  const nextValues = { ...values, decisions }
                  setValues(nextValues)
                  onChange({ ...trigger, values: nextValues })
                }}
                world={world}
              />
            ) : (
              Object.keys(type.params).length > 0 && (
                <ParamFields
                  dense
                  schema={type.params}
                  values={values}
                  onChange={(v) => {
                    setValues(v)
                    onChange({ ...trigger, values: v })
                  }}
                />
              )
            )}
          </div>
        )}

        {/* CONDITIONS & WORLD FLAGS */}
        <div className="border border-line/50 bg-black/40 p-2.5 flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan flex items-center gap-1">
            <Flag className="h-3 w-3" /> Conditions &amp; Flags:
          </span>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase text-dim">Needs World Flag:</label>
            <FlagSelect
              world={world}
              value={needsFlag}
              onChange={(f) => {
                const val = f ?? ''
                setNeedsFlag(val)
                onChange({ ...trigger, needsFlag: val })
              }}
              placeholder="None"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase text-dim">Hidden If Flag:</label>
            <FlagSelect
              world={world}
              value={hiddenIfFlag}
              onChange={(f) => {
                const val = f ?? ''
                setHiddenIfFlag(val)
                onChange({ ...trigger, hiddenIfFlag: val })
              }}
              placeholder="None"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase text-dim">Sets World Flag:</label>
            <FlagSelect
              world={world}
              value={setsFlag}
              onChange={(f) => {
                const val = f ?? ''
                setSetsFlag(val)
                onChange({ ...trigger, setsFlag: val })
              }}
              placeholder="None"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] uppercase text-dim">Needs Inventory Item:</label>
            <ItemSelect
              value={needsItem}
              onChange={(it) => {
                const val = it ?? ''
                setNeedsItem(val)
                onChange({ ...trigger, needsItem: val })
              }}
              placeholder="None"
            />
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="border-t border-line p-3 flex items-center justify-between">
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 className="h-3.5 w-3.5" />}
          onClick={() =>
            confirmDelete(`Delete ${trigger.name}?`, 'This removes it from this map.', async () => {
              onDelete()
            })
          }
          className="text-alert hover:text-alert/80"
        >
          Delete Trigger
        </Button>
        <Button size="sm" variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}
