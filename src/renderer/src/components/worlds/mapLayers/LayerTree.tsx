import { useState, type MouseEvent } from 'react'
import { ChevronDown, ChevronRight, GripVertical, Layers3, Plus, Trash2, Undo2 } from 'lucide-react'
import { layerChainOn, mapThingOf, type Flags, type MapUseLayer, type WorldMapUse } from '@shared/maps'
import { Button, EmptyState, InlineEdit, openMenu, type MenuItem } from '../../ui'
import { cn } from '../../../lib/cn'
import { mapThingType } from '../../maps/things'
import { GateChip } from './GateChip'
import { addLayer, changeUseLayer, deleteUseLayer, dropThing, nestLayer, putThings, type LayerPatch } from './layerOps'
import { dragProps, useThingDrop, type ThingDrag } from './thingDrag'

export interface ThingName {
  label: string
}

interface Props {
  world: string
  use: WorldMapUse
  names: Record<string, ThingName>
  flags: Flags
  active: string | null
  onActive: (layer: string | null) => void
  onChange: (patch: LayerPatch) => void
  selection: string[]
  onSelection: (keys: string[]) => void
}

function ThingRow({ thing, name, depth, picked, onPick, onRemove }: { thing: string; name: string; depth: number; picked: boolean; onPick: () => void; onRemove: () => void }) {
  const Icon = mapThingType(mapThingOf(thing).type)?.icon ?? Layers3
  return (
    <div
      {...dragProps({ things: [thing] })}
      onClick={onPick}
      onContextMenu={(e) => openMenu(e, name, [{ label: 'Remove from layer', icon: <Undo2 />, onSelect: onRemove }])}
      style={{ paddingLeft: 12 + depth * 14 }}
      className={cn('flex cursor-grab items-center gap-1.5 py-0.5 pr-2 text-[11.5px] active:cursor-grabbing', picked ? 'tone-panel-60 text-ink' : 'text-dim hover:text-ink')}
    >
      <Icon className="h-3 w-3 shrink-0 text-secondary-ink" />
      <span className="truncate">{name}</span>
    </div>
  )
}

interface TreeCtx {
  world: string
  use: WorldMapUse
  layers: MapUseLayer[]
  names: Record<string, ThingName>
  flags: Flags
  closed: Record<string, boolean>
  setClosed: (fn: (c: Record<string, boolean>) => Record<string, boolean>) => void
  active: string | null
  onActive: (layer: string | null) => void
  onChange: (patch: LayerPatch) => void
  selection: string[]
  onSelection: (keys: string[]) => void
  members: (id: string) => string[]
  accept: (target: string | null) => (drag: ThingDrag) => boolean
  drop: (target: string | null) => (drag: ThingDrag) => void
  layerMenu: (e: MouseEvent, layer: MapUseLayer) => void
}

function LayerNode({ layer, depth, tree }: { layer: MapUseLayer; depth: number; tree: TreeCtx }) {
  const { use, layers, closed, setClosed, active, onActive, onSelection, onChange, members, accept, drop, layerMenu, flags, world, names, selection } = tree
  const target = useThingDrop(accept(layer.id), drop(layer.id))
  const own = members(layer.id)
  const kids = layers.filter((l) => l.parent === layer.id)
  const open = !closed[layer.id]
  const on = layerChainOn(layers, layer.id, flags)
  return (
    <div className="flex flex-col">
      <div
        {...dragProps({ layer: layer.id })}
        {...target.props}
        onClick={() => {
          onActive(active === layer.id ? null : layer.id)
          onSelection(own)
        }}
        onContextMenu={(e) => layerMenu(e, layer)}
        style={{ paddingLeft: depth * 14 }}
        className={cn(
          'group flex cursor-pointer items-center gap-1 border-l-2 py-1 pr-1.5',
          active === layer.id ? 'border-accent tone-panel-60' : 'border-transparent hover:tone-panel-40',
          target.over && 'outline outline-1 -outline-offset-1 outline-accent'
        )}
      >
        <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-faint" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setClosed((c) => ({ ...c, [layer.id]: open }))
          }}
          className="p-0.5 text-dim hover:text-ink"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <span title={on ? 'On with the current flags' : 'Off with the current flags'} className={cn('h-2 w-2 shrink-0 rounded-full', on ? 'bg-ok' : 'bg-faint/50')} />
        <div className="min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
          <InlineEdit value={layer.name} required onSave={(name) => onChange(changeUseLayer(use, layer.id, { name }))} className="text-[12px] font-bold text-ink" />
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <GateChip world={world} gating={layer.gating} onChange={(gating) => onChange(changeUseLayer(use, layer.id, { gating }))} />
        </div>
        <span className="w-6 shrink-0 text-right font-data text-[10px] text-faint">{own.length}</span>
      </div>
      {open && (
        <>
          {kids.map((k) => (
            <LayerNode key={k.id} layer={k} depth={depth + 1} tree={tree} />
          ))}
          {own.map((key) => (
            <ThingRow
              key={key}
              thing={key}
              name={names[key].label}
              depth={depth + 1}
              picked={selection.includes(key)}
              onPick={() => onSelection([key])}
              onRemove={() => {
                const next = dropThing(use, key)
                if (next) onChange(next)
              }}
            />
          ))}
        </>
      )}
    </div>
  )
}

export function LayerTree({ world, use, names, flags, active, onActive, onChange, selection, onSelection }: Props) {
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const layers = use.layers ?? []
  const layerOf = use.layerOf ?? {}
  const members = (id: string) => Object.keys(layerOf).filter((k) => layerOf[k] === id && names[k])
  const accept = (target: string | null) => (drag: ThingDrag) => Boolean(drag.things?.length) || (drag.layer !== undefined && drag.layer !== target && nestLayer(use, drag.layer, target) !== null)
  const drop = (target: string | null) => (drag: ThingDrag) => {
    if (drag.things?.length) return onChange(putThings(use, drag.things, target))
    const next = drag.layer ? nestLayer(use, drag.layer, target) : null
    if (next) onChange(next)
  }
  const make = (parent: string | null) => {
    const made = addLayer(use, parent)
    onChange(made.patch)
    onActive(made.id)
  }
  const layerMenu = (e: MouseEvent, layer: MapUseLayer) => {
    const items: MenuItem[] = [
      { label: 'New layer inside', icon: <Plus />, onSelect: () => make(layer.id) },
      { label: 'Delete layer (keeps its things)', icon: <Trash2 />, danger: true, onSelect: () => onChange(deleteUseLayer(use, layer.id)) }
    ]
    openMenu(e, layer.name, items)
  }
  const root = useThingDrop(accept(null), drop(null))
  const tree: TreeCtx = { world, use, layers, names, flags, closed, setClosed, active, onActive, onChange, selection, onSelection, members, accept, drop, layerMenu }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 px-2">
        <Button size="sm" variant="secondary" icon={<Plus />} onClick={() => make(active)}>
          {active ? 'New layer inside' : 'New layer'}
        </Button>
        {selection.length > 0 && (
          <span {...dragProps({ things: selection })} title="Drag onto a layer" className="flex cursor-grab items-center gap-1 border border-accent/60 tone-panel-60 px-2 py-1 text-[11px] text-accent active:cursor-grabbing">
            <GripVertical className="h-3 w-3" />
            {selection.length} selected
          </span>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {layers.length ? (
          layers.filter((l) => !l.parent).map((l) => <LayerNode key={l.id} layer={l} depth={0} tree={tree} />)
        ) : (
          <EmptyState title="No layers" />
        )}
      </div>
      <div {...root.props} className={cn('mx-2 mb-2 border border-dashed px-2 py-2 text-center text-[11px]', root.over ? 'border-accent text-accent' : 'border-line/50 text-faint')}>
        Drop here to take off layers
      </div>
    </div>
  )
}
