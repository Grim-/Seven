import { useEffect, type ReactNode } from 'react'
import {
  Box,
  Eraser,
  ImagePlus,
  MapPin,
  MousePointer2,
  Paintbrush,
  Skull,
  Sparkles
} from 'lucide-react'
import { Button } from '../ui'
import { CanvasToolbar, useCanvasEditorStore, type CanvasToolDef } from '../canvasEditor'

export type MapTool = 'select' | 'paint' | 'erase' | 'shape' | 'object' | 'spawner'

const MAP_TEMPLATE_TOOLS: CanvasToolDef[] = [
  { id: 'select', label: 'Select', group: 'nav', shortcut: 'V', icon: <MousePointer2 /> },
  { id: 'paint', label: 'Paint', group: 'tiles', shortcut: 'B', icon: <Paintbrush />, cursor: 'crosshair' },
  { id: 'erase', label: 'Erase', group: 'tiles', shortcut: 'E', icon: <Eraser />, cursor: 'crosshair' },
  { id: 'shape', label: 'Zone Marker', group: 'templates', shortcut: 'R', icon: <MapPin />, cursor: 'crosshair' },
  { id: 'object', label: 'Prop Template', group: 'templates', shortcut: 'O', icon: <Box />, cursor: 'crosshair' },
  { id: 'spawner', label: 'Spawner Marker', group: 'templates', shortcut: 'C', icon: <Skull />, cursor: 'crosshair' }
]

interface OverlayToolbarProps {
  tool: MapTool
  onSelectTool: (tool: MapTool) => void
  onAddImage: () => void
  onToggleGenerator: () => void
  generatorOpen: boolean
  optionsBar?: ReactNode
}

/**
 * Movable, Lockable, Single-Icon Hover-Reveal Horizontal Map Template Toolbar,
 * matching World Atlas's exact `CanvasToolbar` interaction model.
 */
export function OverlayToolbar({
  tool,
  onSelectTool,
  onAddImage,
  onToggleGenerator,
  generatorOpen,
  optionsBar
}: OverlayToolbarProps) {
  const store = useCanvasEditorStore()

  useEffect(() => {
    store.getState().enterTool(tool, 0)
  }, [store, tool])

  useEffect(() => {
    return store.getState().subscribeEffects((eff) => {
      if (eff.type === 'tool_cancelled') {
        onSelectTool('select')
      }
    })
  }, [store, onSelectTool])

  const combinedOptions = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        size="sm"
        variant="ghost"
        onClick={onAddImage}
        icon={<ImagePlus className="h-3.5 w-3.5" />}
        title="Add a picture or background reference layer"
      >
        +Image
      </Button>
      <Button
        size="sm"
        variant={generatorOpen ? 'primary' : 'secondary'}
        onClick={onToggleGenerator}
        icon={<Sparkles className="h-3.5 w-3.5" />}
        title="Open procedural map template generator"
      >
        Generator
      </Button>
      {optionsBar && <div className="flex items-center gap-1.5 border-l border-line/40 pl-2">{optionsBar}</div>}
    </div>
  )

  return (
    <CanvasToolbar
      toolbarId="map-template-tools"
      tools={MAP_TEMPLATE_TOOLS}
      onSelectTool={(id) => onSelectTool(id as MapTool)}
      optionsBar={combinedOptions}
    />
  )
}
