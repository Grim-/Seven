import { useState, Fragment, type MouseEvent } from 'react'
import {
  Eye,
  EyeOff,
  Layers,
  X,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ImagePlus,
  FolderPlus,
  Folder,
  FolderOpen,
  FolderInput,
  ArrowUpFromLine,
  Grid,
  Trash2,
  ArrowUp,
  ArrowDown,
  Pencil,
  MoreVertical
} from 'lucide-react'
import {
  changeLayer,
  childLayers,
  groupsIn,
  moveInto,
  moveLayer,
  type MapLayer
} from '@shared/maps'
import { Button, Slider, openMenu, askText, confirmDelete, type MenuItem } from '../ui'

interface LayerDeckProps {
  open: boolean
  onClose: () => void
  layers: MapLayer[]
  activeLayerId: string | null
  onSelectActiveLayer: (id: string) => void
  onChangeLayers: (layers: MapLayer[]) => void
  onAddTileLayer: () => void
  onAddImageLayer: () => void
  onAddGroup: () => void
}

function getLayerBadge(layer: MapLayer) {
  if (layer.kind === 'tiles') {
    const isCollision = layer.name.toLowerCase().includes('collision')
    return isCollision
      ? { label: 'COLLISION', color: 'border-rose-500/50 text-rose-400 bg-rose-950/30' }
      : { label: 'TILES', color: 'border-cyan-500/50 text-cyan-400 bg-cyan-950/30' }
  }
  if (layer.kind === 'image') return { label: 'IMAGE', color: 'border-purple-500/50 text-purple-400 bg-purple-950/30' }
  if (layer.kind === 'object') return { label: 'OBJECT', color: 'border-amber-500/50 text-amber-400 bg-amber-950/30' }
  if (layer.kind === 'group') return { label: 'GROUP', color: 'border-emerald-500/50 text-emerald-400 bg-emerald-950/30' }
  return { label: 'LAYER', color: 'border-line text-dim' }
}

interface DeckRowsProps {
  list: MapLayer[]
  all: MapLayer[]
  depth: number
  activeLayerId: string | null
  onSelectActiveLayer: (id: string) => void
  onChange: (layers: MapLayer[]) => void
  collapsedGroups: Record<string, boolean>
  onToggleGroup: (id: string) => void
}

function DeckRows({
  list,
  all,
  depth,
  activeLayerId,
  onSelectActiveLayer,
  onChange,
  collapsedGroups,
  onToggleGroup
}: DeckRowsProps) {
  const change = (id: string, patch: Partial<MapLayer>) =>
    onChange(changeLayer(all, id, (l) => ({ ...l, ...patch }) as MapLayer))

  const remove = (l: MapLayer) => {
    const kids = childLayers(l)
    confirmDelete(
      `Remove layer "${l.name}"?`,
      kids?.length ? 'The layers inside this group will be deleted too.' : 'The layer will be deleted.',
      async () => onChange(changeLayer(all, l.id, () => null))
    )
  }

  const handleMoveSibling = (index: number, by: number) => {
    const to = index + by
    if (to < 0 || to >= list.length) return
    onChange(moveLayer(all, list[index].id, to))
  }

  const availableGroups = (currentId: string) =>
    groupsIn(all).filter((g) => g.id !== currentId)

  const openLayerMenu = (e: MouseEvent, layer: MapLayer) => {
    e.stopPropagation()
    const groups = availableGroups(layer.id)
    const items: MenuItem[] = [
      {
        label: layer.visible ? 'Hide' : 'Show',
        icon: layer.visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />,
        onSelect: () => change(layer.id, { visible: !layer.visible })
      },
      {
        label: 'Rename',
        icon: <Pencil className="h-3.5 w-3.5" />,
        onSelect: () =>
          askText('Rename layer', 'Name', layer.name, async (name) => {
            if (name.trim()) change(layer.id, { name: name.trim() })
          })
      }
    ]

    // ONLY Groups can receive layers - never nest under a tile layer!
    if (groups.length > 0) {
      items.push({
        label: 'Move into group',
        icon: <FolderInput className="h-3.5 w-3.5" />,
        children: groups.map((g) => ({
          label: g.name,
          onSelect: () => onChange(moveInto(all, layer.id, g.id))
        }))
      })
    }

    if (depth > 0) {
      items.push({
        label: 'Move out to top level',
        icon: <ArrowUpFromLine className="h-3.5 w-3.5" />,
        onSelect: () => onChange(moveInto(all, layer.id, null))
      })
    }

    items.push({
      label: 'Delete layer',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      danger: true,
      onSelect: () => remove(layer)
    })

    openMenu(e, layer.name, items)
  }

  return (
    <>
      {list.map((layer, index) => {
        const badge = getLayerBadge(layer)
        const isGroup = layer.kind === 'group'
        const children = childLayers(layer)
        const isCollapsed = Boolean(collapsedGroups[layer.id])
        const isTarget = activeLayerId === layer.id

        return (
          <Fragment key={layer.id}>
            <div
              onClick={() => {
                if (layer.kind === 'tiles') {
                  onSelectActiveLayer(layer.id)
                } else if (isGroup) {
                  onToggleGroup(layer.id)
                }
              }}
              onContextMenu={(e) => openLayerMenu(e, layer)}
              style={{ paddingLeft: `${8 + depth * 14}px` }}
              className={`group flex items-center gap-1.5 border-b border-line/30 py-1.5 pr-2 cursor-pointer transition-colors ${
                isTarget
                  ? 'border-l-2 border-l-cyan bg-cyan-950/30'
                  : 'bg-black/30 hover:bg-white/[0.04]'
              }`}
            >
              {/* Group Expand / Collapse Toggle */}
              {isGroup ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleGroup(layer.id)
                  }}
                  className="p-0.5 text-dim hover:text-white"
                  title={isCollapsed ? 'Expand group' : 'Collapse group'}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                </button>
              ) : (
                <span className="w-4 shrink-0" />
              )}

              {/* Visibility Toggle */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  change(layer.id, { visible: !layer.visible })
                }}
                className={`p-0.5 transition-colors ${
                  layer.visible ? 'text-cyan hover:text-white' : 'text-dim/40 hover:text-dim'
                }`}
                title={layer.visible ? 'Hide layer' : 'Show layer'}
              >
                {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>

              {/* Layer Type Badge */}
              <span className={`px-1 py-0.5 border text-[9px] font-mono tracking-wider shrink-0 ${badge.color}`}>
                {isGroup ? (
                  <span className="flex items-center gap-1">
                    {isCollapsed ? <Folder className="h-2.5 w-2.5" /> : <FolderOpen className="h-2.5 w-2.5" />}
                    {badge.label}
                  </span>
                ) : (
                  badge.label
                )}
              </span>

              {/* Layer Name */}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="truncate font-mono text-[11px] font-medium text-white group-hover:text-cyan transition-colors">
                  {layer.name}
                </span>
                {isTarget && (
                  <span className="font-mono text-[8.5px] uppercase tracking-wider text-cyan">
                    ACTIVE TARGET
                  </span>
                )}
              </div>

              {/* Opacity Slider */}
              <div
                className="w-12 shrink-0"
                onClick={(e) => e.stopPropagation()}
                title={`Opacity ${Math.round((typeof layer.opacity === 'number' ? layer.opacity : 1) * 100)}%`}
              >
                <Slider
                  value={typeof layer.opacity === 'number' ? layer.opacity : 1}
                  min={0.05}
                  max={1}
                  step={0.05}
                  onChange={(val) => change(layer.id, { opacity: Math.max(0.05, val) })}
                />
              </div>

              {/* Layer Actions Menu Button & Quick Sibling Reorder */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMoveSibling(index, -1)
                  }}
                  className="p-0.5 text-dim hover:text-white disabled:opacity-20"
                  title="Move up"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  disabled={index === list.length - 1}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMoveSibling(index, 1)
                  }}
                  className="p-0.5 text-dim hover:text-white disabled:opacity-20"
                  title="Move down"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => openLayerMenu(e, layer)}
                  className="p-0.5 text-dim hover:text-cyan"
                  title="Layer options"
                >
                  <MoreVertical className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Render child layers recursively if this is an expanded group */}
            {isGroup && children && children.length > 0 && !isCollapsed && (
              <DeckRows
                list={children}
                all={all}
                depth={depth + 1}
                activeLayerId={activeLayerId}
                onSelectActiveLayer={onSelectActiveLayer}
                onChange={onChange}
                collapsedGroups={collapsedGroups}
                onToggleGroup={onToggleGroup}
              />
            )}
          </Fragment>
        )
      })}
    </>
  )
}

export function LayerDeck({
  open,
  onClose,
  layers,
  activeLayerId,
  onSelectActiveLayer,
  onChangeLayers,
  onAddTileLayer,
  onAddImageLayer,
  onAddGroup
}: LayerDeckProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  if (!open) return null

  const handleToggleGroup = (id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div
      className={`absolute left-3 top-3 z-30 flex flex-col border border-line bg-black/95 shadow-[0_16px_40px_rgba(0,0,0,0.9)] backdrop-blur-md transition-all ${
        collapsed ? 'w-[200px]' : 'w-[320px] max-h-[calc(100%-24px)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-black/90 px-3 py-2 shrink-0">
        <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-cyan">
          <Layers className="h-3.5 w-3.5" />
          <span>Layer Stack</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCollapsed(!collapsed)}
            className="h-6 w-6 p-0"
            title={collapsed ? 'Expand deck' : 'Collapse deck'}
          >
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-6 w-6 p-0 hover:text-alert"
            title="Close deck"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Action Add Buttons Bar */}
      {!collapsed && (
        <div className="flex items-center gap-1.5 border-b border-line/40 bg-black/60 p-2 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={onAddTileLayer}
            className="flex-1 font-mono text-[10px] tracking-wider"
            icon={<Grid className="h-3 w-3" />}
            title="Add a new blank tile layer"
          >
            +Tile
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onAddImageLayer}
            className="flex-1 font-mono text-[10px] tracking-wider"
            icon={<ImagePlus className="h-3 w-3" />}
            title="Add a picture overlay layer"
          >
            +Image
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onAddGroup}
            className="flex-1 font-mono text-[10px] tracking-wider"
            icon={<FolderPlus className="h-3 w-3" />}
            title="Create a new layer group"
          >
            +Group
          </Button>
        </div>
      )}

      {/* Hierarchical Layer List */}
      {!collapsed && (
        <div className="flex flex-1 min-h-0 flex-col overflow-y-auto">
          {layers.length > 0 ? (
            <DeckRows
              list={layers}
              all={layers}
              depth={0}
              activeLayerId={activeLayerId}
              onSelectActiveLayer={onSelectActiveLayer}
              onChange={onChangeLayers}
              collapsedGroups={collapsedGroups}
              onToggleGroup={handleToggleGroup}
            />
          ) : (
            <div className="p-4 text-center font-mono text-[11px] text-dim">
              No layers yet
            </div>
          )}
        </div>
      )}

      {/* Footer Info */}
      {!collapsed && (
        <div className="flex items-center justify-between border-t border-line/40 bg-black/90 px-3 py-1.5 font-mono text-[10px] text-dim shrink-0">
          <span>Click to select layer</span>
          <span>{layers.length} root items</span>
        </div>
      )}
    </div>
  )
}
