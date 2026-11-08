import { triggerType, type TriggerDef } from '@shared/game/triggers'
import { ITEM_TEMPLATES } from '@shared/game/defs'
import type { ParamSchema } from '@shared/game/core'
import { shapeBounds, type ShapeForm } from '@shared/shapes'
import { Eyebrow, SaveState, useAutosavedState } from '../../ui'
import { ParamFields } from '../../game/ParamFields'
import { triggerUi } from './registry'

const COMMON: ParamSchema = {
  name: { label: 'Name', kind: 'text', default: '', description: 'Shown when the pointer is over it.' },
  fires: { label: 'Starts', kind: 'choice', choices: ['enter', 'interact'], default: 'interact', description: 'enter: when a character walks in. interact: when you click it.' },
  once: { label: 'Once only', kind: 'flag', default: false, description: 'After it has happened once in a save, it is gone.' },
  width: { label: 'Width', kind: 'number', default: 64, min: 4, description: 'Width of the area in map pixels.' },
  height: { label: 'Height', kind: 'number', default: 64, min: 4, description: 'Height of the area in map pixels.' },
  needsItem: { label: 'Needs an item', kind: 'template', templateKind: ITEM_TEMPLATES, default: '', description: 'The character must carry this item.' },
  needsFlag: { label: 'Needs a flag', kind: 'text', default: '', description: 'A flag another trigger set in this save.' },
  setsFlag: { label: 'Sets a flag', kind: 'text', default: '', description: 'A flag this sets in the save when it happens.' }
}

function resized(shape: ShapeForm, w: number, h: number): ShapeForm {
  const b = shapeBounds(shape)
  return { kind: 'box', x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h }
}

export function TriggerEditor({ start, world, onSave }: { start: TriggerDef; world: string; onSave: (next: TriggerDef) => Promise<unknown> }) {
  const state = useAutosavedState<TriggerDef>(start, onSave)
  const t = state.value
  const type = triggerType(t.type)
  const ui = triggerUi(t.type)
  const b = shapeBounds(t.shape)
  const common = { name: t.name, fires: t.fires, once: t.once, needsItem: t.needsItem, needsFlag: t.needsFlag, setsFlag: t.setsFlag, width: Math.round(b.w), height: Math.round(b.h) }
  const setCommon = (v: Record<string, unknown>) => state.set({ ...t, name: String(v.name), fires: v.fires === 'enter' ? 'enter' : 'interact', once: v.once === true, needsItem: String(v.needsItem), needsFlag: String(v.needsFlag), setsFlag: String(v.setsFlag), shape: Number(v.width) !== common.width || Number(v.height) !== common.height ? resized(t.shape, Number(v.width), Number(v.height)) : t.shape })
  const setValues = (values: Record<string, unknown>) => state.set({ ...t, values })
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Eyebrow>When it happens</Eyebrow>
          <span className="flex-1" />
          <SaveState status={state.status} error={state.error} />
        </div>
        <ParamFields dense schema={COMMON} values={common} onChange={setCommon} />
      </section>
      <section className="flex flex-col gap-3 border-t border-line/50 pt-4">
        <div className="flex items-baseline gap-3">
          <Eyebrow className="text-purple">{type?.label ?? t.type}</Eyebrow>
          <span className="text-[12px] text-dim">{type?.description}</span>
        </div>
        {ui?.Editor ? <ui.Editor trigger={t} world={world} onValues={setValues} /> : type && <ParamFields dense schema={type.params} values={t.values} onChange={setValues} />}
      </section>
    </div>
  )
}
