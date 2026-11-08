import { Button } from '../ui'

export interface TerrainTileOption {
  gid: number
  label: string
  color: string
}

export const STANDARD_TILES: TerrainTileOption[] = [
  { gid: 1, label: 'Deep Ocean', color: '#1d4ed8' },
  { gid: 2, label: 'Shallow Water', color: '#38bdf8' },
  { gid: 3, label: 'Sand Coast', color: '#d97706' },
  { gid: 4, label: 'Grassland', color: '#16a34a' },
  { gid: 5, label: 'Dense Forest', color: '#14532d' },
  { gid: 6, label: 'Mountain Rock', color: '#78350f' },
  { gid: 7, label: 'Stone Cobble', color: '#64748b' },
  { gid: 8, label: 'Dungeon Wall', color: '#334155' },
  { gid: 9, label: 'Collision Blocker', color: '#ef4444' }
]

interface TilePaletteBarProps {
  selectedGid: number
  onSelectGid: (gid: number) => void
  brushSize: number
  onSetBrushSize: (size: number) => void
  activeLayerName?: string
}

export function TilePaletteBar({
  selectedGid,
  onSelectGid,
  brushSize,
  onSetBrushSize,
  activeLayerName = 'Ground'
}: TilePaletteBarProps) {
  return (
    <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 border border-line bg-black/95 px-3 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.9)] backdrop-blur-md">
      {/* Target Layer Indicator */}
      <div className="flex flex-col border-r border-line/40 pr-3">
        <span className="font-mono text-[9px] uppercase tracking-wider text-dim">Painting On</span>
        <span className="font-mono text-[11px] font-semibold text-cyan truncate max-w-[120px]">
          {activeLayerName}
        </span>
      </div>

      {/* Tile Swatches */}
      <div className="flex items-center gap-1.5">
        {STANDARD_TILES.map((t) => {
          const isSelected = selectedGid === t.gid
          return (
            <button
              key={t.gid}
              type="button"
              onClick={() => onSelectGid(t.gid)}
              className={`group relative h-7 w-7 border transition-all ${
                isSelected
                  ? 'scale-110 border-cyan shadow-[0_0_8px_var(--color-cyan)]'
                  : 'border-line hover:border-white'
              }`}
              style={{ backgroundColor: t.color }}
              title={`${t.label} (Tile GID ${t.gid})`}
            >
              <span className="pointer-events-none absolute -bottom-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap border border-line bg-black px-1.5 py-0.5 font-mono text-[9px] uppercase text-dim group-hover:block z-40">
                {t.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Brush Sizes */}
      <div className="flex items-center gap-1 border-l border-line/40 pl-3">
        {[1, 2, 3].map((size) => (
          <Button
            key={size}
            size="sm"
            variant={brushSize === size ? 'primary' : 'secondary'}
            onClick={() => onSetBrushSize(size)}
            className="h-7 w-7 p-0 font-mono text-[11px]"
            title={`Brush size ${size}×${size} tiles`}
          >
            {size}x
          </Button>
        ))}
      </div>
    </div>
  )
}
