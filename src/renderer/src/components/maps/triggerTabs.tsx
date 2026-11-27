import { Flag, SlidersHorizontal, Zap } from 'lucide-react'
import { triggerType, type TriggerDef, type TriggerFires } from '@shared/game/triggers'
import { shapeBounds, type ShapeForm } from '@shared/shapes'
import { Field, NumberField, Segmented, Toggle } from '../ui'
import { ParamFields } from '../game/ParamFields'
import { FlagSelect } from '../game/FlagSelect'
import { ItemSelect } from '../game/ItemSelect'
import { triggerUi } from '../play/triggers/registry'
import { ObjectPlayManager } from './ObjectPlayManager'
import type { InspectorTab } from './InspectorShell'

const FIRES: { value: TriggerFires; label: string }[] = [
  { value: 'enter', label: 'Step in' },
  { value: 'interact', label: 'Click' }
]

function movedTo(shape: ShapeForm, x: number, y: number): ShapeForm {
  const b = shapeBounds(shape)
  if (shape.kind === 'box') return { ...shape, x, y }
  const dx = x - b.x
  const dy = y - b.y
  return { kind: 'outline', points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
}

function resized(shape: ShapeForm, w: number, h: number): ShapeForm {
  const b = shapeBounds(shape)
  return { kind: 'box', x: Math.round(b.x + b.w / 2 - w / 2), y: Math.round(b.y + b.h / 2 - h / 2), w, h }
}

function TypeSettings({ trigger, world, onChange }: { trigger: TriggerDef; world: string; onChange: (next: TriggerDef) => void }) {
  const type = triggerType(trigger.type)
  const ui = triggerUi(trigger.type)
  const values = (v: Record<string, unknown>) => onChange({ ...trigger, values: v })
  if (!type) return null
  if (ui?.Editor) return <ui.Editor trigger={trigger} world={world} map="" onValues={values} />
  if (type.type === 'play')
    return (
      <ObjectPlayManager
        actionsText={String(trigger.values.actions ?? '')}
        decisionsText={String(trigger.values.decisions ?? '')}
        onChangeActions={(actions) => values({ ...trigger.values, actions })}
        onChangeDecisions={(decisions) => values({ ...trigger.values, decisions })}
        world={world}
      />
    )
  return <ParamFields dense schema={type.params} values={trigger.values} onChange={values} />
}

export function triggerTabs(trigger: TriggerDef, world: string, onChange: (next: TriggerDef) => void): InspectorTab[] {
  const type = triggerType(trigger.type)
  const b = shapeBounds(trigger.shape)
  const set = (patch: Partial<TriggerDef>) => onChange({ ...trigger, ...patch })
  const rules = [trigger.needsFlag, trigger.hiddenIfFlag, trigger.setsFlag, trigger.needsItem].filter(Boolean).length
  return [
    {
      id: 'trigger',
      label: 'Trigger',
      icon: <Zap />,
      body: (
        <div className="flex flex-col gap-3">
          <Field label="Fires on">
            <Segmented value={trigger.fires} options={FIRES} onChange={(fires) => set({ fires })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="X">
              <NumberField value={Math.round(b.x)} min={0} step={16} onChange={(x) => x !== undefined && set({ shape: movedTo(trigger.shape, Math.round(x), Math.round(b.y)) })} className="h-7 text-[12px]" />
            </Field>
            <Field label="Y">
              <NumberField value={Math.round(b.y)} min={0} step={16} onChange={(y) => y !== undefined && set({ shape: movedTo(trigger.shape, Math.round(b.x), Math.round(y)) })} className="h-7 text-[12px]" />
            </Field>
            <Field label="Width">
              <NumberField value={Math.round(b.w)} min={16} step={16} onChange={(w) => w && set({ shape: resized(trigger.shape, w, Math.round(b.h)) })} className="h-7 text-[12px]" />
            </Field>
            <Field label="Height">
              <NumberField value={Math.round(b.h)} min={16} step={16} onChange={(h) => h && set({ shape: resized(trigger.shape, Math.round(b.w), h) })} className="h-7 text-[12px]" />
            </Field>
          </div>
          <Toggle checked={trigger.once} onChange={(once) => set({ once })} label="Once per save" />
        </div>
      )
    },
    ...(type ? [{ id: 'settings', label: type.label, icon: <SlidersHorizontal />, body: <TypeSettings trigger={trigger} world={world} onChange={onChange} /> }] : []),
    {
      id: 'rules',
      label: 'Rules',
      icon: <Flag />,
      count: rules || undefined,
      body: (
        <div className="grid grid-cols-2 gap-2 phone:grid-cols-1">
          <Field label="Needs flag">
            <FlagSelect world={world} value={trigger.needsFlag} onChange={(f) => set({ needsFlag: f ?? '' })} placeholder="None" />
          </Field>
          <Field label="Hidden while flag set">
            <FlagSelect world={world} value={trigger.hiddenIfFlag ?? ''} onChange={(f) => set({ hiddenIfFlag: f ?? '' })} placeholder="None" />
          </Field>
          <Field label="Sets flag">
            <FlagSelect world={world} value={trigger.setsFlag} onChange={(f) => set({ setsFlag: f ?? '' })} placeholder="None" />
          </Field>
          <Field label="Needs item">
            <ItemSelect value={trigger.needsItem} onChange={(it) => set({ needsItem: it ?? '' })} placeholder="None" />
          </Field>
        </div>
      )
    }
  ]
}
