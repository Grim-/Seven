import { Pencil, Trash2, Zap } from 'lucide-react'
import { GameEntity, type Catalog } from '@shared/game/core'
import { Inventory } from '@shared/game/components'
import { ITEM_TEMPLATES } from '@shared/game/defs'
import { newTrigger, triggerTypes, type TriggerDef, type TriggerType } from '@shared/game/triggers'
import type { GameSave } from '@shared/game/save'
import type { MapData, Standing, WorldMapUse } from '@shared/maps'
import { formHas, shapeBounds, type Point } from '@shared/shapes'
import { confirmDelete, type MenuItem } from '../../ui'
import { engine } from '../../../lib/ipc'
import { failed } from '../../../lib/notify'
import { toast } from '../../../store/toasts'
import { useLatest } from '../../../game/react/useLatest'
import type { MapToken } from '../../maps/TokenLayer'
import { setWhere } from '../../maps/placeActions'
import { closePlay, showPlay } from '../playStore'
import { triggerUi, type TriggerContext } from './registry'
import { TriggerEditor } from './TriggerEditor'

interface Options {
  world: string
  map: MapData
  use: WorldMapUse
  uses: WorldMapUse[]
  save: GameSave | null
  catalog: Catalog | null
  tokens: MapToken[]
  onGo: (map: string) => void
}

const centre = (b: { x: number; y: number; w: number; h: number }): Point => ({ x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) })

export function useTriggerPlay(options: Options) {
  const latest = useLatest(options)

  const saveUse = (use: WorldMapUse) => engine('worlds.saveMapUse', { id: latest.current.world, use })
  const saveTrigger = (next: TriggerDef) => {
    const use = latest.current.use
    return saveUse({ ...use, triggers: (use.triggers ?? []).map((t) => (t.id === next.id ? next : t)) })
  }

  const goTo = async (sheet: string, mapId: string, placeKey: string) => {
    const { use, uses, onGo } = latest.current
    const target = uses.find((u) => u.map === mapId)
    if (!target) return toast.error('Can\'t go there', 'That map is not used in this world.')
    const form = placeKey ? target.shapes[placeKey] : undefined
    const at = form ? centre(shapeBounds(form)) : await engine('maps.get', { id: mapId }).then((m) => ({ x: Math.round((m?.size.w ?? 0) / 2), y: Math.round((m?.size.h ?? 0) / 2) }))
    const before: Standing | undefined = use.stand[sheet]
    const standing: Standing = { actions: before?.actions ?? '', decisions: before?.decisions ?? '', at }
    if (target.map === use.map) await saveUse({ ...use, stand: { ...use.stand, [sheet]: standing } })
    else {
      const { [sheet]: _left, ...rest } = use.stand
      await saveUse({ ...use, stand: rest })
      await saveUse({ ...target, stand: { ...target.stand, [sheet]: standing } })
    }
    if (placeKey) await setWhere(sheet, placeKey)
    if (target.map !== use.map) onGo(mapId)
  }

  const stand = (token: string, at: Point) => {
    const use = latest.current.use
    const before: Standing | undefined = use.stand[token]
    return saveUse({ ...use, stand: { ...use.stand, [token]: { actions: before?.actions ?? '', decisions: before?.decisions ?? '', at } } })
  }

  const fire = (trigger: TriggerDef, sheet: string) => {
    const { world, map, save, catalog, tokens } = latest.current
    const visitor = tokens.find((t) => t.visitor.sheet === sheet)?.visitor
    if (trigger.needsItem) {
      const carried = visitor?.game && catalog ? (GameEntity.fromRecord(visitor.game, catalog).comp(Inventory)?.items.some((i) => i.id === trigger.needsItem) ?? false) : false
      if (!carried) return toast.info(trigger.name, `You need ${String(catalog?.template(ITEM_TEMPLATES, trigger.needsItem)?.label ?? trigger.needsItem)}.`)
    }
    if (trigger.needsFlag && !save?.flags[trigger.needsFlag]) return toast.info(trigger.name, 'Not yet.')
    if (trigger.hiddenIfFlag && Boolean(save?.flags[trigger.hiddenIfFlag])) return
    if (save && (trigger.once || trigger.setsFlag)) void engine('saves.markUsed', { id: save.id, trigger: trigger.id, flag: trigger.setsFlag }).catch(failed('Could not save it'))
    const party = tokens.flatMap((t) => (t.visitor.game ? [t.visitor] : []))
    const ctx: TriggerContext = { world, map: map.id, sheet, party, save, catalog, close: closePlay, goTo: (map, place) => void goTo(sheet, map, place).catch(failed('Could not go there')), update: (values) => saveTrigger({ ...trigger, values }) }
    const ui = triggerUi(trigger.type)
    if (ui?.run) ui.run(trigger, ctx)
    else if (ui?.Panel)
      showPlay(
        trigger.name,
        <ui.Panel trigger={trigger} ctx={ctx} />,
        { wide: ui.wide }
      )
  }

  const edit = (trigger: TriggerDef) =>
    showPlay(
      `Trigger · ${trigger.name}`,
      <TriggerEditor start={trigger} world={latest.current.world} map={latest.current.map.id} onSave={saveTrigger} />,
      { wide: true }
    )

  const add = (type: TriggerType, point: Point) => {
    const { use, map } = latest.current
    const w = map.tile.w * 2
    const h = map.tile.h * 2
    const made = newTrigger(type, { kind: 'box', x: Math.round(point.x - w / 2), y: Math.round(point.y - h / 2), w, h })
    void saveUse({ ...use, triggers: [...(use.triggers ?? []), made] })
      .then(() => edit(made))
      .catch(failed('Could not add the trigger'))
  }

  const remove = (trigger: TriggerDef) => {
    const use = latest.current.use
    return saveUse({ ...use, triggers: (use.triggers ?? []).filter((t) => t.id !== trigger.id) })
  }

  const menuItems = (point: Point): MenuItem[] => {
    const here = (latest.current.use.triggers ?? []).filter((t) => formHas(t.shape, point))
    return [
      ...here.flatMap((t) => [
        { label: `Edit ${t.name}`, icon: <Pencil />, onSelect: () => edit(t) },
        { label: `Delete ${t.name}`, icon: <Trash2 />, danger: true, onSelect: () => confirmDelete(`Delete ${t.name}?`, 'It comes off this map.', () => remove(t)) }
      ]),
      { label: 'Add a trigger here', icon: <Zap />, children: triggerTypes().map((type) => ({ label: type.label, onSelect: () => add(type, point) })) }
    ]
  }

  return { fire, menuItems, goTo, stand, triggers: options.use.triggers ?? [] }
}
