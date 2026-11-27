import { useState, Fragment, useMemo, type MouseEvent, type DragEvent } from 'react'
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
  MoreVertical,
  Box,
  Skull
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
import { pickWith } from '../../lib/picking'
import { cn } from '../../lib/cn'

interface LayerDeckProps {
  open: boolean
  onClose: () => void
  layers: MapLayer[]
  activeLayerId: string | null
  onSelectActiveLayer: (id: string) => void
  onChangeLayers: (layers: MapLayer[]) => void
  onAddTileLayer: () => void
  onAddImageLayer: () => void
  onAddObject?: () => void
  onAddSpawner?: () => void
  onAddGroup: () => void
  /** Render inline inside a CanvasEditorShell left drawer instead of a floating popup. */
  embedded?: boolean
}

function getLayerBadge(layer: MapLayer) {
  if (layer.kind === 'tiles') {
    const isCollision = layer.name.toLowerCase().includes('collision')
    return isCollision
      ? { label: 'COLLISION', color: 'border-alert/50 text-alert bg-alert/10' }
      : { label: 'TILES', color: 'border-secondary-ink/50 text-secondary-ink bg-secondary-ink/10' }
  }
  if (layer.kind === 'image') return { label: 'IMAGE', color: 'border-accent/50 text-accent bg-accent/10' }
  if (layer.kind === 'object') return { label: 'OBJECT', color: 'border-accent/50 text-accent bg-accent/10' }
  if (layer.kind === 'group') return { label: 'GROUP', color: 'border-ok/50 text-ok bg-ok/10' }
  return { label: 'LAYER', color: 'border-line text-dim' }
}

function flattenLayerIds(layers: MapLayer[]): string[] {
  const ids: string[] = []
  for (const l of layers) {
    ids.push(l.id)
    const kids = childLayers(l)
    if (kids) ids.push(...flattenLayerIds(kids))
  }
  return ids
}

interface DragTargetState {
  id: string
  position: 'into' | 'before' | 'after'
}

interface DeckRowsProps {
  list: MapLayer[]
  all: MapLayer[]
  depth: number
  activeLayerId: string | null
  selectedIds: Set<string>
  onRowClick: (e: MouseEvent, id: string) => void
  onSelectActiveLayer: (id: string) => void
  onChange: (layers: MapLayer[]) => void
  collapsedGroups: Record<string, boolean>
  onToggleGroup: (id: string) => void
  draggedIds: string[]
  setDraggedIds: (ids: string[]) => void
  dragTarget: DragTargetState | null
  setDragTarget: (target: DragTargetState | null) => void
  onExecuteDrop: (target: DragTargetState | null) => void
}

function DeckRows({
  list,
  all,
  depth,
  activeLayerId,
  selectedIds,
  onRowClick,
  onSelectActiveLayer,
  onChange,
  collapsedGroups,
  onToggleGroup,
  draggedIds,
  setDraggedIds,
  dragTarget,
  setDragTarget,
  onExecuteDrop
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
    const isMulti = selectedIds.size > 1 && selectedIds.has(layer.id)

    const items: MenuItem[] = [
      {
        label: layer.visible ? 'Hide' : 'Show',
        icon: layer.visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />,
        onSelect: () => {
          if (isMulti) {
            let next = all
            for (const id of selectedIds) {
              next = changeLayer(next, id, (l) => ({ ...l, visible: !layer.visible }) as MapLayer)
            }
            onChange(next)
          } else {
            change(layer.id, { visible: !layer.visible })
          }
        }
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

    if (groups.length > 0) {
      items.push({
        label: isMulti ? `Move ${selectedIds.size} layers into group` : 'Move into group',
        icon: <FolderInput className="h-3.5 w-3.5" />,
        children: groups.map((g) => ({
          label: g.name,
          onSelect: () => {
            const idsToMove = isMulti ? Array.from(selectedIds) : [layer.id]
            let next = all
            for (const id of idsToMove) {
              next = moveInto(next, id, g.id)
            }
            onChange(next)
          }
        }))
      })
    }

    if (depth > 0) {
      items.push({
        label: isMulti ? `Move ${selectedIds.size} layers out to top level` : 'Move out to top level',
        icon: <ArrowUpFromLine className="h-3.5 w-3.5" />,
        onSelect: () => {
          const idsToMove = isMulti ? Array.from(selectedIds) : [layer.id]
          let next = all
          for (const id of idsToMove) {
            next = moveInto(next, id, null)
          }
          onChange(next)
        }
      })
    }

    items.push({
      label: isMulti ? `Delete ${selectedIds.size} layers` : 'Delete layer',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      danger: true,
      onSelect: () => {
        if (isMulti) {
          confirmDelete(
            `Delete ${selectedIds.size} selected layers?`,
            'Any child layers inside selected groups will also be deleted.',
            async () => {
              let next = all
              for (const id of selectedIds) {
                next = changeLayer(next, id, () => null)
              }
              onChange(next)
            }
          )
        } else {
          remove(layer)
        }
      }
    })

    openMenu(e, isMulti ? `${selectedIds.size} Layers` : layer.name, items)
  }

  // Drag event handlers
  const handleDragStart = (e: DragEvent, layer: MapLayer) => {
    e.stopPropagation()
    const ids = selectedIds.has(layer.id) ? Array.from(selectedIds) : [layer.id]
    setDraggedIds(ids)
    e.dataTransfer.setData('text/plain', JSON.stringify(ids))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: DragEvent, layer: MapLayer) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedIds.includes(layer.id)) return

    const rect = e.currentTarget.getBoundingClientRect()
    const relY = e.clientY - rect.top
    const height = rect.height

    if (layer.kind === 'group') {
      // In a group, center zone is "into", top is "before", bottom is "after"
      if (relY > height * 0.25 && relY < height * 0.75) {
        setDragTarget({ id: layer.id, position: 'into' })
      } else if (relY <= height * 0.25) {
        setDragTarget({ id: layer.id, position: 'before' })
      } else {
        setDragTarget({ id: layer.id, position: 'after' })
      }
    } else {
      if (relY < height * 0.5) {
        setDragTarget({ id: layer.id, position: 'before' })
      } else {
        setDragTarget({ id: layer.id, position: 'after' })
      }
    }
  }

  const handleDrop = (e: DragEvent, layer: MapLayer) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedIds.includes(layer.id)) return
    onExecuteDrop(dragTarget)
  }

  return (
    <>
      {list.map((layer, index) => {
        const badge = getLayerBadge(layer)
        const isGroup = layer.kind === 'group'
        const children = childLayers(layer)
        const isCollapsed = Boolean(collapsedGroups[layer.id])
        const isTarget = activeLayerId === layer.id
        const isSelected = selectedIds.has(layer.id)
        const isDragOver = dragTarget?.id === layer.id

        return (
          <Fragment key={layer.id}>
            <div
              draggable={true}
              onDragStart={(e) => handleDragStart(e, layer)}
              onDragOver={(e) => handleDragOver(e, layer)}
              onDrop={(e) => handleDrop(e, layer)}
              onClick={(e) => {
                onRowClick(e, layer.id)
                if (layer.kind === 'tiles') {
                  onSelectActiveLayer(layer.id)
                }
              }}
              onContextMenu={(e) => openLayerMenu(e, layer)}
              style={{ paddingLeft: `${8 + depth * 14}px` }}
              className={cn(
                'group relative flex items-center gap-1.5 border-b border-line/30 py-1.5 pr-2 cursor-pointer transition-colors select-none',
                isSelected
                  ? 'border-l-2 border-l-secondary-ink bg-secondary-ink/15 text-ink'
                  : isTarget
                  ? 'border-l-2 border-l-secondary-ink/60 bg-secondary/10'
                  : 'tone-well-30 hover:bg-ink/[0.04]',
                isDragOver && dragTarget?.position === 'into' && 'border-2 border-secondary-ink bg-secondary-ink/20',
                isDragOver && dragTarget?.position === 'before' && 'border-t-2 border-t-secondary-ink',
                isDragOver && dragTarget?.position === 'after' && 'border-b-2 border-b-secondary-ink'
              )}
            >
              {/* Group Expand / Collapse Toggle */}
              {isGroup ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleGroup(layer.id)
                  }}
                  className="p-0.5 text-dim hover:text-ink"
                  title={isCollapsed ? 'Expand group' : 'Collapse group'}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-ok" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-ok" />
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
                className={cn(
                  'p-0.5 transition-colors',
                  layer.visible ? 'text-secondary-ink hover:text-ink' : 'text-dim/40 hover:text-dim'
                )}
                title={layer.visible ? 'Hide layer' : 'Show layer'}
              >
                {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>

              {/* Layer Type Badge */}
              <span className={cn('px-1 py-0.5 border text-[9px] font-ui tracking-wider shrink-0', badge.color)}>
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
                <span className="truncate font-ui text-[11px] font-medium text-ink group-hover:text-secondary-ink transition-colors">
                  {layer.name}
                </span>
                {isTarget && (
                  <span className="font-label text-[8.5px] caps-5 text-secondary-ink">
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
                  className="p-0.5 text-dim hover:text-ink disabled:opacity-20"
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
                  className="p-0.5 text-dim hover:text-ink disabled:opacity-20"
                  title="Move down"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => openLayerMenu(e, layer)}
                  className="p-0.5 text-dim hover:text-secondary-ink"
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
                selectedIds={selectedIds}
                onRowClick={onRowClick}
                onSelectActiveLayer={onSelectActiveLayer}
                onChange={onChange}
                collapsedGroups={collapsedGroups}
                onToggleGroup={onToggleGroup}
                draggedIds={draggedIds}
                setDraggedIds={setDraggedIds}
                dragTarget={dragTarget}
                setDragTarget={setDragTarget}
                onExecuteDrop={onExecuteDrop}
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
  onAddObject,
  onAddSpawner,
  onAddGroup,
  embedded = false
}: LayerDeckProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [anchorId, setAnchorId] = useState<string | null>(null)
  const [draggedIds, setDraggedIds] = useState<string[]>([])
  const [dragTarget, setDragTarget] = useState<DragTargetState | null>(null)

  const allOrder = useMemo(() => flattenLayerIds(layers), [layers])

  if (!open) return null

  const handleToggleGroup = (id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleRowClick = (e: MouseEvent, id: string) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      const pickedResult = pickWith(
        { ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey },
        id,
        {
          picked: Array.from(selectedIds),
          anchor: anchorId,
          selected: activeLayerId,
          order: allOrder
        }
      )
      if (pickedResult) {
        setSelectedIds(new Set(pickedResult.picked))
        setAnchorId(pickedResult.anchor)
        return
      }
    }
    // Normal click selects just this row
    setSelectedIds(new Set([id]))
    setAnchorId(id)
  }

  const handleExecuteDrop = (target: DragTargetState | null) => {
    if (!target || draggedIds.length === 0) return
    let next = layers

    if (target.position === 'into') {
      // Move all dragged layers into the target group
      for (const id of draggedIds) {
        if (id !== target.id) {
          next = moveInto(next, id, target.id)
        }
      }
    } else {
      // Drop before or after a target layer
      // If target is inside a group, find which group it belongs to
      let targetGroup: string | null = null
      for (const g of groupsIn(layers)) {
        if (childLayers(g)?.some((c) => c.id === target.id)) {
          targetGroup = g.id
          break
        }
      }

      // First place all dragged items into the same parent container
      for (const id of draggedIds) {
        next = moveInto(next, id, targetGroup)
      }
    }

    onChangeLayers(next)
    setDraggedIds([])
    setDragTarget(null)
  }

  const handleDropOnRoot = (e: DragEvent) => {
    e.preventDefault()
    if (draggedIds.length === 0) return
    let next = layers
    for (const id of draggedIds) {
      next = moveInto(next, id, null)
    }
    onChangeLayers(next)
    setDraggedIds([])
    setDragTarget(null)
  }

  // Batch actions on multi-selection
  const handleBatchVisibility = (visible: boolean) => {
    let next = layers
    for (const id of selectedIds) {
      next = changeLayer(next, id, (l) => ({ ...l, visible }) as MapLayer)
    }
    onChangeLayers(next)
  }

  const handleBatchDelete = () => {
    confirmDelete(
      `Delete ${selectedIds.size} selected layers?`,
      'All child layers inside selected groups will also be deleted.',
      async () => {
        let next = layers
        for (const id of selectedIds) {
          next = changeLayer(next, id, () => null)
        }
        onChangeLayers(next)
        setSelectedIds(new Set())
      }
    )
  }

  const isMulti = selectedIds.size > 1

  const isCollapsed = embedded ? false : collapsed

  return (
    <div
      className={cn(
        embedded
          ? 'flex h-full min-h-0 flex-col'
          : cn(
              'absolute left-3 top-3 z-30 flex flex-col border border-line tone-panel-95 shadow-[0_16px_40px_color-mix(in_srgb,var(--color-shade)_90%,transparent)] backdrop-blur-[calc(var(--panel-blur)*1.5)] transition-all',
              isCollapsed ? 'w-[200px]' : 'w-[320px] max-h-[calc(100%-24px)]'
            )
      )}
    >
      {/* Header (floating mode only) */}
      {!embedded && (
        <div className="flex items-center justify-between border-b border-line tone-panel-90 px-3 py-2 shrink-0">
          <div className="flex items-center gap-1.5 font-label text-[11px] font-semibold caps-5 text-secondary-ink">
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
      )}

      {/* Multi-Select Action Bar (Shows when multiple layers are picked) */}
      {!isCollapsed && isMulti && (
        <div className="flex items-center justify-between border-b border-secondary-ink/40 bg-secondary-ink/10 px-2.5 py-1.5 shrink-0 font-ui text-[10px]">
          <span className="font-bold text-secondary-ink">{selectedIds.size} SELECTED</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleBatchVisibility(true)}
              className="border border-line/60 tone-well-40 px-1.5 py-0.5 text-ink hover:border-secondary-ink hover:text-secondary-ink"
            >
              Show
            </button>
            <button
              type="button"
              onClick={() => handleBatchVisibility(false)}
              className="border border-line/60 tone-well-40 px-1.5 py-0.5 text-ink hover:border-secondary-ink hover:text-secondary-ink"
            >
              Hide
            </button>
            <button
              type="button"
              onClick={handleBatchDelete}
              className="border border-alert/40 bg-alert/10 px-1.5 py-0.5 text-alert hover:bg-alert hover:text-on-accent"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="ml-1 p-0.5 text-dim hover:text-ink"
              title="Clear selection"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Action Add Buttons Bar */}
      {!isCollapsed && (
        <div className="flex flex-wrap items-center gap-1 border-b border-line/40 tone-panel-60 p-2 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={onAddTileLayer}
            className="flex-1 font-ui text-[10px] tracking-wider"
            icon={<Grid className="h-3 w-3" />}
            title="Add a new blank tile layer"
          >
            +Tile
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onAddImageLayer}
            className="flex-1 font-ui text-[10px] tracking-wider"
            icon={<ImagePlus className="h-3 w-3" />}
            title="Add a picture overlay layer"
          >
            +Image
          </Button>
          {onAddObject && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onAddObject}
              className="flex-1 font-ui text-[10px] tracking-wider text-secondary-ink border-secondary-ink/40 hover:bg-secondary-ink/15"
              icon={<Box className="h-3 w-3 text-secondary-ink" />}
              title="Place a predefined or custom prop template"
            >
              +Prop
            </Button>
          )}
          {onAddSpawner && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onAddSpawner}
              className="flex-1 font-ui text-[10px] tracking-wider text-alert border-alert/40 hover:bg-alert/15"
              icon={<Skull className="h-3 w-3 text-alert" />}
              title="Place a spawner marker template"
            >
              +Marker
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={onAddGroup}
            className="flex-1 font-ui text-[10px] tracking-wider"
            icon={<FolderPlus className="h-3 w-3" />}
            title="Create a new layer group"
          >
            +Group
          </Button>
        </div>
      )}

      {/* Hierarchical Layer List & Root Drop Zone */}
      {!isCollapsed && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
          }}
          onDrop={handleDropOnRoot}
          className="flex flex-1 min-h-[120px] flex-col overflow-y-auto"
        >
          {layers.length > 0 ? (
            <DeckRows
              list={layers}
              all={layers}
              depth={0}
              activeLayerId={activeLayerId}
              selectedIds={selectedIds}
              onRowClick={handleRowClick}
              onSelectActiveLayer={onSelectActiveLayer}
              onChange={onChangeLayers}
              collapsedGroups={collapsedGroups}
              onToggleGroup={handleToggleGroup}
              draggedIds={draggedIds}
              setDraggedIds={setDraggedIds}
              dragTarget={dragTarget}
              setDragTarget={setDragTarget}
              onExecuteDrop={handleExecuteDrop}
            />
          ) : (
            <div className="p-4 text-center font-ui text-[11px] text-dim">
              No layers yet
            </div>
          )}
        </div>
      )}

      {/* Footer Info & Root Drop Hint */}
      {!isCollapsed && (
        <div className="flex items-center justify-between border-t border-line/40 tone-panel-90 px-3 py-1.5 font-ui text-[10px] text-dim shrink-0">
          <span>{isMulti ? `${selectedIds.size} layers selected` : 'Shift/Ctrl to multi-select'}</span>
          <span>{layers.length} root items</span>
        </div>
      )}
    </div>
  )
}
