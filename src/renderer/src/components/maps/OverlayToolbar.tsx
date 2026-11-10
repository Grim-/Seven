import { Pointer, Paintbrush, Eraser, Square, Box, ImagePlus, Sparkles, Layers, Skull } from 'lucide-react'
import { Button } from '../ui'

export type MapTool = 'select' | 'paint' | 'erase' | 'shape' | 'object' | 'spawner'

interface OverlayToolbarProps {
  tool: MapTool
  onSelectTool: (tool: MapTool) => void
  onAddImage: () => void
  onToggleGenerator: () => void
  generatorOpen: boolean
  onToggleLayers: () => void
  layersOpen: boolean
  layerCount: number
}

export function OverlayToolbar({
  tool,
  onSelectTool,
  onAddImage,
  onToggleGenerator,
  generatorOpen,
  onToggleLayers,
  layersOpen,
  layerCount
}: OverlayToolbarProps) {
  return (
    <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-1.5 border border-line bg-black/90 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md">
      {/* Primary Interaction Tools */}
      <div className="flex items-center gap-1 border-r border-line/40 pr-2">
        <Button
          size="sm"
          variant="secondary"
          active={tool === 'select'}
          onClick={() => onSelectTool('select')}
          icon={<Pointer className="h-3.5 w-3.5" />}
          title="Select and inspect objects on the canvas (V)"
        >
          Select
        </Button>

        <Button
          size="sm"
          variant="secondary"
          active={tool === 'paint'}
          onClick={() => onSelectTool('paint')}
          icon={<Paintbrush className="h-3.5 w-3.5" />}
          title="Paint tiles onto active tile layer (B)"
        >
          Paint
        </Button>

        <Button
          size="sm"
          variant="secondary"
          active={tool === 'erase'}
          onClick={() => onSelectTool('erase')}
          icon={<Eraser className="h-3.5 w-3.5" />}
          title="Erase tiles from active tile layer (E)"
        >
          Erase
        </Button>
      </div>

      {/* Place & Object Tools */}
      <div className="flex items-center gap-1 border-r border-line/40 pr-2">
        <Button
          size="sm"
          variant="secondary"
          active={tool === 'shape'}
          onClick={() => onSelectTool('shape')}
          icon={<Square className="h-3.5 w-3.5" />}
          title="Draw a place / zone boundary shape (R)"
        >
          Zone / Place
        </Button>

        <Button
          size="sm"
          variant="secondary"
          active={tool === 'object'}
          onClick={() => onSelectTool('object')}
          icon={<Box className="h-3.5 w-3.5" />}
          title="Place an interactive object or prop (O)"
        >
          Object
        </Button>

        <Button
          size="sm"
          variant="secondary"
          active={tool === 'spawner'}
          onClick={() => onSelectTool('spawner')}
          icon={<Skull className="h-3.5 w-3.5 text-alert" />}
          title="Place a creature spawner template (C)"
        >
          Creature Spawner
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={onAddImage}
          icon={<ImagePlus className="h-3.5 w-3.5" />}
          title="Add a picture or reference layer"
        >
          +Image
        </Button>
      </div>

      {/* Tactile HUD Panels Toggle */}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant={generatorOpen ? 'primary' : 'badge'}
          onClick={onToggleGenerator}
          icon={<Sparkles className="h-3.5 w-3.5" />}
          title="Toggle In-Canvas Procedural Map Generator"
        >
          Generator
        </Button>

        <Button
          size="sm"
          variant={layersOpen ? 'primary' : 'secondary'}
          onClick={onToggleLayers}
          icon={<Layers className="h-3.5 w-3.5" />}
          title="Toggle Layers Stack"
        >
          Layers ({layerCount})
        </Button>
      </div>
    </div>
  )
}
