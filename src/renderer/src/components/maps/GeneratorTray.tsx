import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, ChevronRight, ChevronLeft, RefreshCw, Sliders, RotateCcw } from 'lucide-react'
import { generateDungeon, generateMap, renderMapToCanvas } from 'agent_map_gen'
import type { GenerateConfig } from './GenerateMapModal'
import { Button, Field, Input, MinMaxSlider, Segmented, Select, Toggle } from '../ui'
import { noteFailure } from '../../store/problems'

const DUNGEON_KINDS = [
  { value: 'standard', label: 'Standard (Balanced)' },
  { value: 'cavern', label: 'Cavern (Natural Caves)' },
  { value: 'crypt', label: 'Crypt (Burial Chambers)' },
  { value: 'labyrinth', label: 'Labyrinth (Dense Maze)' }
]

const OVERWORLD_KINDS = [
  { value: 'stamped', label: 'Continent (Solid Landmass)' },
  { value: 'archipelago', label: 'Archipelago (Island Clusters)' },
  { value: 'enclosed', label: 'Enclosed (Mountain Valley)' },
  { value: 'void', label: 'Void (Floating Astral Rocks)' }
]

const CORRIDOR_STYLES = [
  { value: 'straight', label: 'Orthogonal / Straight' },
  { value: 'lshaped', label: 'L-shaped' },
  { value: 'doublel', label: 'Double L' },
  { value: 'curved', label: 'Curved' },
  { value: 'organic', label: 'Organic / Rough' },
  { value: 'jagged', label: 'Jagged' },
  { value: 'zigzag', label: 'Zigzag' },
  { value: 'drunkwalk', label: 'Drunk walk' },
  { value: 'pathfinder', label: 'Direct' }
]

function makeSeed(): string {
  return Math.random().toString(36).slice(2, 9)
}

function getDungeonDefaults(kind: string, width = 64, height = 64) {
  const maxDim = Math.max(width, height)
  const scale = Math.max(1, Math.round(maxDim / 64))

  if (kind === 'cavern') {
    return {
      minRooms: Math.min(80, 4 * scale),
      maxRooms: Math.min(150, 10 * scale),
      minRoomSize: 10,
      maxRoomSize: 24,
      minSideRooms: Math.min(40, 2 * scale),
      maxSideRooms: Math.min(70, 5 * scale),
      corridorWidth: 3,
      corridorStyle: 'organic',
      allowHiddenRooms: true,
      hiddenRoomChance: 40,
      branchingChance: 60,
      smoothCorners: true,
      mapMargin: 4
    }
  }
  if (kind === 'crypt') {
    return {
      minRooms: Math.min(100, 8 * scale),
      maxRooms: Math.min(180, 16 * scale),
      minRoomSize: 6,
      maxRoomSize: 18,
      minSideRooms: Math.min(50, 3 * scale),
      maxSideRooms: Math.min(80, 6 * scale),
      corridorWidth: 2,
      corridorStyle: 'lshaped',
      allowHiddenRooms: true,
      hiddenRoomChance: 50,
      branchingChance: 75,
      smoothCorners: false,
      mapMargin: 4
    }
  }
  if (kind === 'labyrinth') {
    return {
      minRooms: Math.min(120, 10 * scale),
      maxRooms: Math.min(220, 22 * scale),
      minRoomSize: 5,
      maxRoomSize: 14,
      minSideRooms: Math.min(60, 4 * scale),
      maxSideRooms: Math.min(100, 8 * scale),
      corridorWidth: 2,
      corridorStyle: 'doublel',
      allowHiddenRooms: false,
      hiddenRoomChance: 20,
      branchingChance: 90,
      smoothCorners: false,
      mapMargin: 3
    }
  }
  return {
    minRooms: Math.min(80, 5 * scale),
    maxRooms: Math.min(150, 12 * scale),
    minRoomSize: 8,
    maxRoomSize: 22,
    minSideRooms: Math.min(40, 3 * scale),
    maxSideRooms: Math.min(70, 6 * scale),
    corridorWidth: 3,
    corridorStyle: 'straight',
    allowHiddenRooms: false,
    hiddenRoomChance: 30,
    branchingChance: 70,
    smoothCorners: true,
    mapMargin: 4
  }
}

interface OverworldParams {
  scale: number
  roughness: number
  minCount?: number
  maxCount?: number
  minSize?: number
  maxSize?: number
  minIslands?: number
  maxIslands?: number
  minIslandSize?: number
  islandMargin?: number
  mainIsland?: boolean
  minRivers?: number
  maxRivers?: number
  riverWidth?: number
  riverWander?: number
  elevationNoise?: number
  threshold?: number
  falloff?: number
  stretch?: number
  drunkenness?: number
  smoothing: number
  gaps: number
  edgeMargin: number
}

function getOverworldDefaults(kind: string): OverworldParams {
  if (kind === 'archipelago') {
    return {
      scale: 0.08,
      roughness: 0.35,
      minIslands: 3,
      maxIslands: 6,
      minIslandSize: 40,
      islandMargin: 8,
      mainIsland: true,
      minRivers: 0,
      maxRivers: 2,
      riverWidth: 3,
      riverWander: 0.35,
      elevationNoise: 3,
      threshold: 0.3,
      falloff: 0.4,
      stretch: 0.5,
      drunkenness: 0.3,
      smoothing: 2,
      gaps: 1,
      edgeMargin: 6
    }
  }
  if (kind === 'enclosed') {
    return {
      scale: 0.03,
      roughness: 0.3,
      minIslands: 1,
      maxIslands: 1,
      minIslandSize: 60,
      islandMargin: 8,
      mainIsland: false,
      minRivers: 1,
      maxRivers: 2,
      riverWidth: 2,
      riverWander: 0.3,
      elevationNoise: 4,
      threshold: 0.25,
      falloff: 0.4,
      stretch: 0.5,
      drunkenness: 0.3,
      smoothing: 2,
      gaps: 1,
      edgeMargin: 4
    }
  }
  if (kind === 'void') {
    return {
      scale: 0.06,
      roughness: 0.4,
      minIslands: 1,
      maxIslands: 1,
      minIslandSize: 16,
      islandMargin: 4,
      mainIsland: false,
      minRivers: 0,
      maxRivers: 0,
      riverWidth: 2,
      riverWander: 0.3,
      elevationNoise: 2,
      threshold: 0.38,
      falloff: 0.4,
      stretch: 0.5,
      drunkenness: 0.3,
      smoothing: 2,
      gaps: 1,
      edgeMargin: 4
    }
  }
  return {
    scale: 0.08,
    roughness: 0.35,
    minCount: 18,
    maxCount: 30,
    minSize: 16,
    maxSize: 48,
    minIslands: 1,
    maxIslands: 1,
    minIslandSize: 40,
    islandMargin: 8,
    mainIsland: false,
    minRivers: 1,
    maxRivers: 3,
    riverWidth: 3,
    riverWander: 0.35,
    elevationNoise: 3,
    threshold: 0.3,
    falloff: 0.4,
    stretch: 0.5,
    drunkenness: 0.3,
    smoothing: 2,
    gaps: 1,
    edgeMargin: 6
  }
}

interface GeneratorTrayProps {
  open: boolean
  onClose: () => void
  onGenerate: (config: GenerateConfig) => Promise<void>
}

export function GeneratorTray({ open, onClose, onGenerate }: GeneratorTrayProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [type, setType] = useState<'overworld' | 'dungeon'>('overworld')
  const [dungeonKind, setDungeonKind] = useState('standard')
  const [overworldKind, setOverworldKind] = useState('stamped')
  const [width, setWidth] = useState(64)
  const [height, setHeight] = useState(64)
  const [seed, setSeed] = useState(() => makeSeed())
  const [busy, setBusy] = useState(false)
  const [generatingPreview, setGeneratingPreview] = useState(false)
  const [previewStats, setPreviewStats] = useState<{ label: string; val: string }[]>([])

  const [dungeonParams, setDungeonParams] = useState(() => getDungeonDefaults('standard', 64, 64))
  const [overworldParams, setOverworldParams] = useState<OverworldParams>(() => getOverworldDefaults('stamped'))

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const activeKind = type === 'dungeon' ? dungeonKind : overworldKind

  const handleSelectDungeonKind = (val: string) => {
    setDungeonKind(val)
    setDungeonParams(getDungeonDefaults(val, width, height))
  }

  const handleSelectOverworldKind = (val: string) => {
    setOverworldKind(val)
    setOverworldParams(getOverworldDefaults(val))
  }

  const handleResetDefaults = () => {
    if (type === 'dungeon') setDungeonParams(getDungeonDefaults(dungeonKind, width, height))
    else setOverworldParams(getOverworldDefaults(overworldKind))
  }

  const buildActiveConfig = (): Record<string, unknown> => {
    if (type === 'dungeon') {
      return {
        roomamount: [dungeonParams.minRooms, dungeonParams.maxRooms],
        sideroomcount: [dungeonParams.minSideRooms, dungeonParams.maxSideRooms],
        roomsize: [dungeonParams.minRoomSize, dungeonParams.maxRoomSize],
        corridoorwidth: dungeonParams.corridorWidth,
        corridorstyles: [{ style: dungeonParams.corridorStyle, weight: 1 }],
        allowhiddensidepaths: dungeonParams.allowHiddenRooms,
        hiddensidepathchance: dungeonParams.hiddenRoomChance / 100,
        branchingchance: dungeonParams.branchingChance / 100,
        smoothcorridoorcorners: dungeonParams.smoothCorners,
        mapmargin: dungeonParams.mapMargin
      }
    }
    const c: Record<string, unknown> = {
      scale: overworldParams.scale,
      roughness: overworldParams.roughness,
      smooth: overworldParams.smoothing,
      gaps: overworldParams.gaps,
      edgemargin: overworldParams.edgeMargin
    }
    if (overworldKind === 'stamped') {
      c.mincount = overworldParams.minCount ?? 18
      c.maxcount = overworldParams.maxCount ?? 30
      c.minsize = overworldParams.minSize ?? 16
      c.maxsize = overworldParams.maxSize ?? 48
      c.minrivers = overworldParams.minRivers
      c.maxrivers = overworldParams.maxRivers
      c.riverwidth = overworldParams.riverWidth
      c.wander = overworldParams.riverWander
      c.elevationnoise = overworldParams.elevationNoise
    } else if (overworldKind === 'archipelago') {
      c.minislands = overworldParams.minIslands
      c.maxislands = overworldParams.maxIslands
      c.minislandsize = overworldParams.minIslandSize
      c.islandmargin = overworldParams.islandMargin
      c.mainisland = overworldParams.mainIsland
      c.minrivers = overworldParams.minRivers
      c.maxrivers = overworldParams.maxRivers
      c.riverwidth = overworldParams.riverWidth
      c.wander = overworldParams.riverWander
    } else if (overworldKind === 'enclosed') {
      c.threshold = overworldParams.threshold
      c.falloff = overworldParams.falloff
      c.stretch = overworldParams.stretch
      c.rings = 2
    } else if (overworldKind === 'void') {
      c.threshold = overworldParams.threshold
      c.drunkenness = overworldParams.drunkenness
      c.minregion = overworldParams.minIslandSize
    }
    return c
  }

  // REALTIME LIVE PREVIEW UPDATE ON ANY PARAMETER CHANGE
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setGeneratingPreview(true)

    const timer = setTimeout(async () => {
      try {
        const config = buildActiveConfig()
        const res =
          type === 'dungeon'
            ? await generateDungeon({
                kind: dungeonKind,
                width,
                height,
                seed,
                config
              })
            : await generateMap({
                shaper: overworldKind,
                width,
                height,
                seed,
                config
              })

        if (!cancelled && canvasRef.current) {
          renderMapToCanvas(canvasRef.current, res, {
            tileSize: Math.max(1, Math.floor(180 / Math.max(width, height)))
          })
          if (type === 'dungeon' && 'stats' in res) {
            setPreviewStats([
              { label: 'Rooms', val: `${(res as any).stats.totalRooms}` },
              { label: 'Floor', val: `${Math.round((res as any).stats.floorRatio * 100)}%` },
              { label: 'Paths', val: `${(res as any).stats.totalConnections}` }
            ])
          } else if ('stats' in res) {
            setPreviewStats([
              { label: 'Land', val: `${Math.round((res as any).stats.landRatio * 100)}%` },
              { label: 'Cells', val: `${(res as any).stats.landCells}` }
            ])
          }
        }
      } catch (err) {
        noteFailure('maps', 'Could not draw the preview')(err)
      } finally {
        if (!cancelled) setGeneratingPreview(false)
      }
    }, 120)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, type, dungeonKind, overworldKind, width, height, seed, dungeonParams, overworldParams])

  if (!open) return null

  const handleGenerate = async () => {
    setBusy(true)
    try {
      await onGenerate({
        type,
        kind: activeKind,
        width,
        height,
        seed,
        config: buildActiveConfig()
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`absolute right-3 top-3 z-30 flex flex-col border border-line bg-black/95 shadow-[-8px_12px_32px_rgba(0,0,0,0.85)] backdrop-blur-md transition-all ${
        collapsed ? 'w-[240px]' : 'w-[380px] max-h-[calc(100%-24px)]'
      }`}
    >
      {/* Tray Header */}
      <div className="flex items-center justify-between border-b border-line bg-black/90 px-3 py-2 shrink-0">
        <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-accent">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Map Generator</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCollapsed(!collapsed)}
            className="h-6 w-6 p-0"
            title={collapsed ? 'Expand generator' : 'Collapse generator'}
          >
            {collapsed ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-6 w-6 p-0 hover:text-alert"
            title="Close generator"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tray Content */}
      {!collapsed && (
        <>
          <div className="flex flex-1 min-h-0 flex-col gap-3.5 p-3 overflow-y-auto">
            {/* REALTIME LIVE PREVIEW CANVAS */}
            <div className="relative flex flex-col items-center justify-center border border-line bg-black/80 p-2 shrink-0">
              <canvas
                ref={canvasRef}
                width={180}
                height={180}
                className="border border-line/60 bg-[#06080c] [image-rendering:pixelated]"
              />
              {generatingPreview && (
                <span className="absolute bottom-3 left-3 bg-black/90 px-1.5 py-0.5 font-mono text-[9px] text-accent flex items-center gap-1 border border-line/60">
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Rendering...
                </span>
              )}
              {previewStats.length > 0 && !generatingPreview && (
                <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-dim">
                  {previewStats.map((s) => (
                    <span key={s.label}>
                      {s.label}: <strong className="text-white">{s.val}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ENVIRONMENT (OVERWORLD / DUNGEON) */}
            <Field label="Map Environment">
              <Segmented
                value={type}
                options={[
                  { value: 'overworld', label: 'Overworld' },
                  { value: 'dungeon', label: 'Dungeon' }
                ]}
                onChange={(v) => setType(v)}
              />
            </Field>

            {/* ARCHETYPE SELECTOR */}
            <Field label="Archetype">
              <Select
                value={activeKind}
                options={type === 'dungeon' ? DUNGEON_KINDS : OVERWORLD_KINDS}
                onChange={(val) => {
                  if (type === 'dungeon') handleSelectDungeonKind(val)
                  else handleSelectOverworldKind(val)
                }}
              />
            </Field>

            {/* DIMENSIONS */}
            <Field label="Dimensions (Tiles)">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-dim">W</span>
                  <Input
                    type="number"
                    min={16}
                    value={width}
                    onChange={(e) => {
                      const w = Math.max(16, Number(e.target.value) || 16)
                      setWidth(w)
                      if (type === 'dungeon') setDungeonParams(getDungeonDefaults(dungeonKind, w, height))
                    }}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-dim">H</span>
                  <Input
                    type="number"
                    min={16}
                    value={height}
                    onChange={(e) => {
                      const h = Math.max(16, Number(e.target.value) || 16)
                      setHeight(h)
                      if (type === 'dungeon') setDungeonParams(getDungeonDefaults(dungeonKind, width, h))
                    }}
                  />
                </div>
              </div>
            </Field>

            {/* SEED WITH RANDOMIZER */}
            <Field label="Seed">
              <div className="flex items-center gap-1.5">
                <Input
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  className="font-mono text-[12px]"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<RefreshCw />}
                  onClick={() => setSeed(makeSeed())}
                  title="Generate new random seed"
                >
                  New
                </Button>
              </div>
            </Field>

            {/* PARAMETERS SECTION HEADER */}
            <div className="flex items-center justify-between border-t border-line/40 pt-3">
              <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-accent">
                <Sliders className="h-3.5 w-3.5" />
                Parameters
              </span>
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw />}
                onClick={handleResetDefaults}
                title="Reset to archetype defaults"
              >
                Defaults
              </Button>
            </div>

            {/* ===================== OVERWORLD VARIABLES ===================== */}
            {type === 'overworld' && (
              <div className="flex flex-col gap-3">
                <Field label={`Noise Scale (${overworldParams.scale})`}>
                  <input
                    type="range"
                    min="0.01"
                    max="0.25"
                    step="0.01"
                    value={overworldParams.scale}
                    onChange={(e) => setOverworldParams({ ...overworldParams, scale: parseFloat(e.target.value) })}
                    className="h-1.5 w-full cursor-pointer bg-line/40 accent-accent"
                  />
                </Field>

                <Field label={`Coastline Roughness (${overworldParams.roughness})`}>
                  <input
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.02"
                    value={overworldParams.roughness}
                    onChange={(e) => setOverworldParams({ ...overworldParams, roughness: parseFloat(e.target.value) })}
                    className="h-1.5 w-full cursor-pointer bg-line/40 accent-accent"
                  />
                </Field>

                {overworldKind === 'stamped' && (
                  <>
                    <MinMaxSlider
                      label="Stamp Count"
                      minVal={overworldParams.minCount ?? 18}
                      maxVal={overworldParams.maxCount ?? 30}
                      minLimit={4}
                      maxLimit={100}
                      onChange={(min, max) =>
                        setOverworldParams({ ...overworldParams, minCount: min, maxCount: max })
                      }
                    />
                    <MinMaxSlider
                      label="Stamp Size"
                      minVal={overworldParams.minSize ?? 16}
                      maxVal={overworldParams.maxSize ?? 48}
                      minLimit={8}
                      maxLimit={128}
                      unit="px"
                      onChange={(min, max) =>
                        setOverworldParams({ ...overworldParams, minSize: min, maxSize: max })
                      }
                    />
                  </>
                )}

                {overworldKind === 'archipelago' && (
                  <>
                    <MinMaxSlider
                      label="Islands Count"
                      minVal={overworldParams.minIslands ?? 3}
                      maxVal={overworldParams.maxIslands ?? 6}
                      minLimit={1}
                      maxLimit={24}
                      onChange={(min, max) =>
                        setOverworldParams({ ...overworldParams, minIslands: min, maxIslands: max })
                      }
                    />
                    <div className="flex items-center justify-between py-1">
                      <Toggle
                        checked={overworldParams.mainIsland ?? true}
                        onChange={(checked) => setOverworldParams({ ...overworldParams, mainIsland: checked })}
                        label="Main Continent Island"
                      />
                    </div>
                  </>
                )}

                {/* RIVERS */}
                <div className="flex flex-col gap-2 border-t border-line/40 pt-2">
                  <MinMaxSlider
                    label="Rivers Count"
                    minVal={overworldParams.minRivers ?? 1}
                    maxVal={overworldParams.maxRivers ?? 3}
                    minLimit={0}
                    maxLimit={12}
                    onChange={(min, max) =>
                      setOverworldParams({ ...overworldParams, minRivers: min, maxRivers: max })
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="River Width">
                      <Input
                        type="number"
                        min={1}
                        max={6}
                        value={overworldParams.riverWidth ?? 3}
                        onChange={(e) => setOverworldParams({ ...overworldParams, riverWidth: parseInt(e.target.value, 10) || 1 })}
                      />
                    </Field>
                    <Field label="River Wander">
                      <Input
                        type="number"
                        step={0.05}
                        min={0.1}
                        max={0.8}
                        value={overworldParams.riverWander ?? 0.35}
                        onChange={(e) => setOverworldParams({ ...overworldParams, riverWander: parseFloat(e.target.value) || 0.1 })}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            )}

            {/* ===================== DUNGEON VARIABLES ===================== */}
            {type === 'dungeon' && (
              <div className="flex flex-col gap-3">
                <MinMaxSlider
                  label="Room Count"
                  minVal={dungeonParams.minRooms}
                  maxVal={dungeonParams.maxRooms}
                  minLimit={4}
                  maxLimit={200}
                  onChange={(min, max) =>
                    setDungeonParams({ ...dungeonParams, minRooms: min, maxRooms: max })
                  }
                />

                <MinMaxSlider
                  label="Room Size"
                  minVal={dungeonParams.minRoomSize}
                  maxVal={dungeonParams.maxRoomSize}
                  minLimit={4}
                  maxLimit={64}
                  unit="tiles"
                  onChange={(min, max) =>
                    setDungeonParams({ ...dungeonParams, minRoomSize: min, maxRoomSize: max })
                  }
                />

                <MinMaxSlider
                  label="Side Rooms"
                  minVal={dungeonParams.minSideRooms}
                  maxVal={dungeonParams.maxSideRooms}
                  minLimit={2}
                  maxLimit={100}
                  onChange={(min, max) =>
                    setDungeonParams({ ...dungeonParams, minSideRooms: min, maxSideRooms: max })
                  }
                />

                <Field label="Corridor Style">
                  <Select
                    value={dungeonParams.corridorStyle}
                    options={CORRIDOR_STYLES}
                    onChange={(v) => setDungeonParams({ ...dungeonParams, corridorStyle: v })}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Corridor Width">
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={dungeonParams.corridorWidth}
                      onChange={(e) => setDungeonParams({ ...dungeonParams, corridorWidth: parseInt(e.target.value, 10) || 1 })}
                    />
                  </Field>
                  <Field label="Branching %">
                    <Input
                      type="number"
                      min={10}
                      max={100}
                      step={5}
                      value={dungeonParams.branchingChance}
                      onChange={(e) => setDungeonParams({ ...dungeonParams, branchingChance: parseInt(e.target.value, 10) || 10 })}
                    />
                  </Field>
                </div>

                <div className="flex items-center justify-between py-1">
                  <Toggle
                    checked={dungeonParams.allowHiddenRooms}
                    onChange={(checked) => setDungeonParams({ ...dungeonParams, allowHiddenRooms: checked })}
                    label="Allow Hidden Rooms"
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <Toggle
                    checked={dungeonParams.smoothCorners}
                    onChange={(checked) => setDungeonParams({ ...dungeonParams, smoothCorners: checked })}
                    label="Smooth Corridor Corners"
                  />
                </div>
              </div>
            )}
          </div>

          {/* PINNED FOOTER (ALWAYS VISIBLE, AUTHENTIC SEVEN BUTTONS) */}
          <div className="flex items-center justify-end gap-2 border-t border-line/60 bg-black/95 p-3 shrink-0">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={<Sparkles />}
              disabled={busy}
              onClick={handleGenerate}
            >
              {busy ? 'Generating...' : 'Apply to Map'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
