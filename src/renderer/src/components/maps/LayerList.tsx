import { Fragment, useState } from 'react'
import { ArrowUpFromLine, Eye, EyeOff, FolderInput, GripVertical, Move, Pencil, Search, Trash2 } from 'lucide-react'
import { changeLayer, childLayers, groupsIn, moveInto, moveLayer, zoomLabel, type MapLayer, type ZoomRange } from '@shared/maps'
import { Button, InlineEdit, NumberField, RowAction, Slider, askText, confirmDelete, openMenu, type MenuItem } from '../ui'
import { useReorder } from '../ui/reorder'
import { cn } from '../../lib/cn'
import { layerTypeOf } from './layerTypes'

interface RowsProps {
  list: MapLayer[]
  all: MapLayer[]
  onChange: (layers: MapLayer[]) => void
  depth: number
  zoom: number
  zooming: string | null
  onZooming: (id: string | null) => void
  selected: string | null
  onSelect: (id: string) => void
}

export function removeLayer(all: MapLayer[], l: MapLayer, onChange: (layers: MapLayer[]) => void): void {
  confirmDelete(`Remove layer "${l.name}"?`, childLayers(l)?.length ? 'The layers inside it go too.' : 'Its picture stays in your files.', async () => onChange(changeLayer(all, l.id, () => null)))
}

function ZoomEditor({ range, zoom, onChange }: { range: ZoomRange; zoom: number; onChange: (range: ZoomRange) => void }) {
  const round = (n: number) => Math.round(n * 100) / 100
  const end = (key: keyof ZoomRange, label: string) => (
    <div className="flex items-center gap-1.5">
      <span className="w-14 font-label text-[10px] caps-10 text-faint">{label}</span>
      <NumberField value={range[key] ?? undefined} min={0.01} step={0.05} placeholder="any" allowEmpty onChange={(v) => onChange({ ...range, [key]: v ?? null })} className="h-7 w-20 text-[12px]" />
      <Button size="sm" variant="ghost" onClick={() => onChange({ ...range, [key]: round(zoom) })}>
        Use {round(zoom)}×
      </Button>
    </div>
  )
  return (
    <div className="flex flex-col gap-1 border-y border-tint-purple/30 bg-tint-purple/[0.04] px-2.5 py-2">
      <span className="text-[11.5px] text-dim">Shows only between these zooms. Empty means no limit.</span>
      {end('min', 'From')}
      {end('max', 'Up to')}
    </div>
  )
}

function LayerRows({ list, all, onChange, depth, zoom, zooming, onZooming, selected, onSelect }: RowsProps) {
  const shown = [...list].reverse()
  const reorder = useReorder((from, to) => onChange(moveLayer(all, shown[from].id, list.length - 1 - to)))
  const change = (id: string, patch: Partial<MapLayer>) => onChange(changeLayer(all, id, (l) => ({ ...l, ...patch }) as MapLayer))
  const remove = (l: MapLayer) => removeLayer(all, l, onChange)
  const items = (l: MapLayer): MenuItem[] => [
    ...('image' in l ? [{ label: 'Place, scale and turn', icon: <Move />, onSelect: () => onSelect(l.id) }] : []),
    { label: l.visible ? 'Hide' : 'Show', icon: l.visible ? <EyeOff /> : <Eye />, onSelect: () => change(l.id, { visible: !l.visible }) },
    { label: 'Rename', icon: <Pencil />, onSelect: () => askText('Rename layer', 'Name', l.name, async (name) => {
        if (name.trim()) change(l.id, { name: name.trim() })
      }) },
    { label: 'Shows at zoom…', icon: <Search />, onSelect: () => onZooming(l.id) },
    { label: 'Move into', icon: <FolderInput />, children: groupsIn(all).filter((g) => g.id !== l.id).map((g) => ({ label: g.name, onSelect: () => onChange(moveInto(all, l.id, g.id)) })) },
    ...(depth > 0 ? [{ label: 'Move out to the top', icon: <ArrowUpFromLine />, onSelect: () => onChange(moveInto(all, l.id, null)) }] : []),
    { label: 'Remove', icon: <Trash2 />, danger: true, onSelect: () => remove(l) }
  ]
  return (
    <>
      {shown.map((l, i) => {
        const children = childLayers(l)
        const range = zoomLabel(l.zoom)
        return (
          <Fragment key={l.id}>
            <div
              {...reorder.props(i)}
              onContextMenu={(e) => openMenu(e, l.name, items(l))}
              onClick={() => 'image' in l && onSelect(l.id)}
              className={cn('group grid grid-cols-[12px_20px_minmax(0,1fr)_auto_56px_24px] items-center gap-1.5 py-1 pr-1 text-[12.5px]', reorder.isOver(i) && 'bg-accent/10', selected === l.id && 'bg-secondary-ink/10')}
              style={{ paddingLeft: 8 + depth * 14 }}
            >
              <GripVertical className="h-3 w-3 cursor-grab text-faint" />
              <button type="button" title={l.visible ? 'Hide' : 'Show'} onClick={() => change(l.id, { visible: !l.visible })} className={l.visible ? 'text-secondary-ink' : 'text-faint'}>
                {l.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
              <span className="flex min-w-0 items-baseline gap-1.5">
                <InlineEdit value={l.name} onSave={(name) => change(l.id, { name })} className="min-w-0 truncate" />
                <span className="shrink-0 font-label text-[9px] caps-10 text-faint">{layerTypeOf(l)?.tag}</span>
              </span>
              <button type="button" title="Shows at zoom" onClick={() => onZooming(zooming === l.id ? null : l.id)} className={cn('whitespace-nowrap border px-1 font-ui text-[9.5px]', range ? 'border-tint-purple/45 text-tint-purple' : 'border-transparent text-faint opacity-0 group-hover:opacity-100')}>
                {range ?? 'any zoom'}
              </button>
              <span title={`Opacity ${Math.round(l.opacity * 100)}%`}>
                <Slider value={l.opacity} min={0} max={1} step={0.05} onChange={(opacity) => change(l.id, { opacity })} />
              </span>
              <span className="opacity-0 group-hover:opacity-100">
                <RowAction title="Remove this layer" danger icon={<Trash2 />} onClick={() => remove(l)} />
              </span>
            </div>
            {zooming === l.id && <ZoomEditor range={l.zoom} zoom={zoom} onChange={(zoomRange) => change(l.id, { zoom: zoomRange })} />}
            {children && <LayerRows list={children} all={all} onChange={onChange} depth={depth + 1} zoom={zoom} zooming={zooming} onZooming={onZooming} selected={selected} onSelect={onSelect} />}
          </Fragment>
        )
      })}
    </>
  )
}

export function LayerList({ layers, onChange, zoom, selected, onSelect }: { layers: MapLayer[]; onChange: (layers: MapLayer[]) => void; zoom: number; selected: string | null; onSelect: (id: string) => void }) {
  const [zooming, setZooming] = useState<string | null>(null)
  return (
    <div className="flex flex-col">
      <LayerRows list={layers} all={layers} onChange={onChange} depth={0} zoom={zoom} zooming={zooming} onZooming={setZooming} selected={selected} onSelect={onSelect} />
    </div>
  )
}
