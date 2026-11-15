import { useState } from 'react'
import { Zap, Plus } from 'lucide-react'
import { newTrigger, triggerTypes, type TriggerDef, type TriggerFires, type TriggerType } from '@shared/game/triggers'
import type { Point } from '@shared/shapes'
import { Button, Modal, Segmented } from '../ui'
import { ParamFields } from '../game/ParamFields'
import { FlagSelect } from '../game/FlagSelect'
import { ItemSelect } from '../game/ItemSelect'
import { triggerUi } from '../play/triggers/registry'
import { ObjectPlayManager } from './ObjectPlayManager'
import { cn } from '../../lib/cn'

interface Props {
  world?: string
  at: Point
  onClose: () => void
  onPlaced: (trigger: TriggerDef) => void
}

export function AddTriggerModal({ world = '', at, onClose, onPlaced }: Props) {
  const types = triggerTypes()
  const [selectedType, setSelectedType] = useState<TriggerType>(types[0] ?? { type: 'note', label: 'Note', icon: 'scroll-text', description: 'Note', fires: 'interact', params: {} })
  const [name, setName] = useState(selectedType.label)
  const [fires, setFires] = useState<TriggerFires>(selectedType.fires)
  const [once, setOnce] = useState(false)
  const [sizeW, setSizeW] = useState(64)
  const [sizeH, setSizeH] = useState(64)
  const [needsItem, setNeedsItem] = useState('')
  const [needsFlag, setNeedsFlag] = useState('')
  const [hiddenIfFlag, setHiddenIfFlag] = useState('')
  const [setsFlag, setSetsFlag] = useState('')
  const [params, setParams] = useState<Record<string, unknown>>({})

  const handleSelectType = (t: TriggerType) => {
    setSelectedType(t)
    setName(t.label)
    setFires(t.fires)
    setParams({})
  }

  const handlePlace = () => {
    const shape = {
      kind: 'box' as const,
      x: Math.round(at.x - sizeW / 2),
      y: Math.round(at.y - sizeH / 2),
      w: sizeW,
      h: sizeH
    }

    const trigger = newTrigger(selectedType, shape)
    trigger.name = name.trim() || selectedType.label
    trigger.fires = fires
    trigger.once = once
    trigger.needsItem = needsItem.trim()
    trigger.needsFlag = needsFlag.trim()
    trigger.hiddenIfFlag = hiddenIfFlag.trim()
    trigger.setsFlag = setsFlag.trim()
    trigger.values = { ...trigger.values, ...params }

    onPlaced(trigger)
    onClose()
  }

  return (
    <Modal open={true} title={`Place Trigger Zone at (${at.x}, ${at.y})`} onClose={onClose} wide>
      <div className="flex flex-col gap-4 font-mono select-none">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 min-h-[420px]">
          {/* TRIGGER TYPE SELECTION (LEFT 5 COLUMNS) */}
          <div className="flex flex-col gap-1.5 border border-line bg-black/40 p-2.5 lg:col-span-5 max-h-[440px] overflow-y-auto divide-y divide-line/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-dim px-1 pb-1">
              Select Trigger Behavior:
            </span>
            {types.map((t) => {
              const isSelected = selectedType.type === t.type
              return (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => handleSelectType(t)}
                  className={cn(
                    'flex flex-col gap-0.5 p-2 text-left transition-colors',
                    isSelected
                      ? 'border-l-2 border-l-cyan bg-cyan/10 text-white'
                      : 'text-dim hover:bg-panel hover:text-white'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-white flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-accent" />
                      {t.label}
                    </span>
                    <span className="text-[9px] uppercase font-bold text-cyan border border-cyan/40 px-1">
                      {t.fires}
                    </span>
                  </div>
                  <span className="text-[10px] text-faint line-clamp-2">{t.description}</span>
                </button>
              )
            })}
          </div>

          {/* TRIGGER CONFIGURATION FORM (RIGHT 7 COLUMNS) */}
          <div className="flex flex-col justify-between border border-line bg-black/60 p-4 lg:col-span-7">
            <div className="flex flex-col gap-3">
              {/* TRIGGER NAME */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-dim">Trigger Name:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={selectedType.label}
                  className="border border-line bg-panel px-3 py-1.5 text-[12px] text-white focus:border-cyan focus:outline-none"
                />
              </div>

              {/* ACTIVATION EVENT (ON ENTER / ON INTERACT) */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-cyan">Activation Event:</label>
                <Segmented
                  value={fires}
                  onChange={(v) => setFires(v as TriggerFires)}
                  options={[
                    { value: 'enter', label: 'On Enter (Walking into zone)' },
                    { value: 'interact', label: 'On Interact (Clicking / Examining)' }
                  ]}
                />
              </div>

              {/* ZONE BOUNDS / SIZE */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-dim">Zone Width (px):</label>
                  <input
                    type="number"
                    min={16}
                    step={16}
                    value={sizeW}
                    onChange={(e) => setSizeW(Math.max(16, Number(e.target.value)))}
                    className="border border-line bg-panel px-2 py-1 text-[11px] text-white focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-dim">Zone Height (px):</label>
                  <input
                    type="number"
                    min={16}
                    step={16}
                    value={sizeH}
                    onChange={(e) => setSizeH(Math.max(16, Number(e.target.value)))}
                    className="border border-line bg-panel px-2 py-1 text-[11px] text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* ONCE ONLY TOGGLE */}
              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-white">
                <input
                  type="checkbox"
                  checked={once}
                  onChange={(e) => setOnce(e.target.checked)}
                  className="h-3.5 w-3.5 accent-cyan"
                />
                <span>Trigger Once Only in Save (one-time event / trap / reward)</span>
              </label>

              {/* TYPE-SPECIFIC PARAMETERS */}
              {selectedType && (
                <div className="border border-line/40 bg-panel p-2.5 flex flex-col gap-2">
                  <span className="block text-[10px] font-bold uppercase text-accent">
                    {selectedType.label} Settings:
                  </span>
                  {selectedType.type === 'play' ? (
                    <ObjectPlayManager
                      actionsText={String(params.actions ?? '')}
                      decisionsText={String(params.decisions ?? '')}
                      onChangeActions={(actions) => setParams({ ...params, actions })}
                      onChangeDecisions={(decisions) => setParams({ ...params, decisions })}
                      world={world}
                    />
                  ) : triggerUi(selectedType.type)?.Editor ? (
                    (() => {
                      const Editor = triggerUi(selectedType.type)!.Editor!
                      return (
                        <Editor
                          trigger={{
                            id: '__temp',
                            name,
                            type: selectedType.type,
                            fires: fires as 'enter' | 'interact',
                            shape: { kind: 'box', x: at.x, y: at.y, w: sizeW, h: sizeH },
                            values: params,
                            once,
                            needsFlag,
                            hiddenIfFlag,
                            setsFlag,
                            needsItem,
                            comps: []
                          }}
                          world={world}
                          map=""
                          onValues={setParams}
                        />
                      )
                    })()
                  ) : (
                    Object.keys(selectedType.params).length > 0 && (
                      <ParamFields
                        dense
                        schema={selectedType.params}
                        values={params}
                        onChange={setParams}
                      />
                    )
                  )}
                </div>
              )}

              {/* CONDITIONS & FLAGS */}
              <div className="border border-line/40 bg-black/40 p-2.5">
                <span className="block text-[10px] font-bold uppercase text-dim mb-2">
                  Conditions &amp; World Flags:
                </span>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="flex flex-col gap-1">
                    <label className="text-dim uppercase">Needs World Flag:</label>
                    <FlagSelect
                      world={world ?? ''}
                      value={needsFlag}
                      onChange={(f) => setNeedsFlag(f ?? '')}
                      placeholder="None"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-dim uppercase">Hidden If Flag:</label>
                    <FlagSelect
                      world={world ?? ''}
                      value={hiddenIfFlag}
                      onChange={(f) => setHiddenIfFlag(f ?? '')}
                      placeholder="None"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-dim uppercase">Sets World Flag:</label>
                    <FlagSelect
                      world={world ?? ''}
                      value={setsFlag}
                      onChange={(f) => setSetsFlag(f ?? '')}
                      placeholder="None"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-dim uppercase">Needs Inventory Item:</label>
                    <ItemSelect
                      value={needsItem}
                      onChange={(it) => setNeedsItem(it ?? '')}
                      placeholder="None"
                    />
                  </div>
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
                onClick={handlePlace}
              >
                Place Trigger Zone on Map
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
