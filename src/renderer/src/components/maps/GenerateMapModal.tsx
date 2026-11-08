import { useEffect, useRef, useState } from 'react'
import { Box, Compass, RefreshCw, RotateCcw, Sliders, Sparkles } from 'lucide-react'
import { generateDungeon, generateMap, renderMapToCanvas } from 'agent_map_gen'
import { Button, Field, Input, Modal, Segmented, Select, Toggle } from '../ui'

export interface GenerateConfig {
  type: 'dungeon' | 'overworld'
  kind: string
  width: number
  height: number
  seed: string
  config: Record<string, unknown>
}

interface GenerateMapModalProps {
  open: boolean
  onClose: () => void
  onGenerate: (config: GenerateConfig) => Promise<void>
}

const DUNGEON_KINDS = [
  { value: 'standard', label: 'Standard Dungeon (Balanced)' },
  { value: 'cavern', label: 'Cavern (Natural Caves)' },
  { value: 'crypt', label: 'Crypt (Burial Chambers)' },
  { value: 'labyrinth', label: 'Labyrinth (Dense Maze)' }
]

const OVERWORLD_KINDS = [
  { value: 'stamped', label: 'Continent (Stamped Landmass)' },
  { value: 'archipelago', label: 'Archipelago (Island Clusters)' },
  { value: 'enclosed', label: 'Enclosed (Mountain Ringed Valley)' },
  { value: 'void', label: 'Void (Floating Astral Islands)' }
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

const SIZE_PRESETS = [
  { label: '64×64', w: 64, h: 64 },
  { label: '128×128', w: 128, h: 128 },
  { label: '256×256', w: 256, h: 256 },
  { label: '512×512', w: 512, h: 512 },
  { label: '1024×1024', w: 1024, h: 1024 }
]

function makeSeed(): string {
  return Math.random().toString(36).slice(2, 10)
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

export function GenerateMapModal({ open, onClose, onGenerate }: GenerateMapModalProps) {
  const [type, setType] = useState<'dungeon' | 'overworld'>('dungeon')
  const [dungeonKind, setDungeonKind] = useState('standard')
  const [overworldKind, setOverworldKind] = useState('stamped')
  const [width, setWidth] = useState(64)
  const [height, setHeight] = useState(64)
  const [seed, setSeed] = useState(() => makeSeed())
  const [working, setWorking] = useState(false)
  const [previewResult, setPreviewResult] = useState<any>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [dungeonParams, setDungeonParams] = useState(() => getDungeonDefaults('standard'))
  const [overworldParams, setOverworldParams] = useState<OverworldParams>(() => getOverworldDefaults('stamped'))

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

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const run = async () => {
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
        if (!cancelled) {
          setPreviewResult(res)
          if (canvasRef.current) {
            renderMapToCanvas(canvasRef.current, res, { tileSize: Math.max(1, Math.floor(340 / Math.max(width, height))) })
          }
        }
      } catch {
      }
    }
    const timer = setTimeout(run, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, type, dungeonKind, overworldKind, width, height, seed, dungeonParams, overworldParams])

  const handleApplyPreset = (w: number, h: number) => {
    setWidth(w)
    setHeight(h)
    if (type === 'dungeon') setDungeonParams(getDungeonDefaults(dungeonKind, w, h))
  }

  const handleRandomSeed = () => {
    setSeed(makeSeed())
  }

  const handleGenerate = async () => {
    setWorking(true)
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
      setWorking(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Generate Procedural Map"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={working}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Sparkles />} onClick={handleGenerate} disabled={working}>
            {working ? 'Generating...' : 'Generate Tile Map'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[420px_minmax(0,1fr)]">
        <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-2">
          <Field label="Map Environment">
            <Segmented
              value={type}
              options={[
                { value: 'dungeon', label: 'Dungeon' },
                { value: 'overworld', label: 'Overworld' }
              ]}
              onChange={(next) => setType(next)}
            />
          </Field>

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

          <Field label="Dimensions (Tiles)">
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-dim">W</span>
                  <Input
                    type="number"
                    min={16}
                    max={4096}
                    value={width}
                    onChange={(e) => setWidth(Math.max(16, Math.min(4096, Number(e.target.value) || 16)))}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-dim">H</span>
                  <Input
                    type="number"
                    min={16}
                    max={4096}
                    value={height}
                    onChange={(e) => setHeight(Math.max(16, Math.min(4096, Number(e.target.value) || 16)))}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {SIZE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleApplyPreset(p.w, p.h)}
                    className="border border-line/60 bg-black/40 px-2 py-0.5 font-mono text-[10.5px] text-dim transition-colors hover:border-line-hover hover:text-white"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </Field>

          <Field label="Seed">
            <div className="flex items-center gap-1.5">
              <Input value={seed} onChange={(e) => setSeed(e.target.value)} className="font-mono text-[12px]" />
              <Button size="sm" variant="secondary" icon={<RefreshCw />} onClick={handleRandomSeed} title="Generate new random seed">
                New
              </Button>
            </div>
          </Field>

          <div className="flex items-center justify-between border-t border-line/40 pt-3">
            <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-accent-soft">
              <Sliders className="h-3.5 w-3.5" />
              Generator Parameters
            </span>
            <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={handleResetDefaults} title="Reset to archetype defaults">
              Defaults
            </Button>
          </div>

          {type === 'dungeon' ? (
            <div className="flex flex-col gap-3.5 text-[12.5px]">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Room Count Range">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={2}
                      max={500}
                      value={dungeonParams.minRooms}
                      onChange={(e) => setDungeonParams((p) => ({ ...p, minRooms: Number(e.target.value) || 2 }))}
                    />
                    <span className="text-dim">–</span>
                    <Input
                      type="number"
                      min={2}
                      max={500}
                      value={dungeonParams.maxRooms}
                      onChange={(e) => setDungeonParams((p) => ({ ...p, maxRooms: Number(e.target.value) || 2 }))}
                    />
                  </div>
                </Field>

                <Field label="Room Size (Tiles)">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={4}
                      max={120}
                      value={dungeonParams.minRoomSize}
                      onChange={(e) => setDungeonParams((p) => ({ ...p, minRoomSize: Number(e.target.value) || 4 }))}
                    />
                    <span className="text-dim">–</span>
                    <Input
                      type="number"
                      min={4}
                      max={120}
                      value={dungeonParams.maxRoomSize}
                      onChange={(e) => setDungeonParams((p) => ({ ...p, maxRoomSize: Number(e.target.value) || 4 }))}
                    />
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Side Branches">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={250}
                      value={dungeonParams.minSideRooms}
                      onChange={(e) => setDungeonParams((p) => ({ ...p, minSideRooms: Number(e.target.value) || 0 }))}
                    />
                    <span className="text-dim">–</span>
                    <Input
                      type="number"
                      min={0}
                      max={250}
                      value={dungeonParams.maxSideRooms}
                      onChange={(e) => setDungeonParams((p) => ({ ...p, maxSideRooms: Number(e.target.value) || 0 }))}
                    />
                  </div>
                </Field>

                <Field label="Corridor Width">
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={dungeonParams.corridorWidth}
                    onChange={(e) => setDungeonParams((p) => ({ ...p, corridorWidth: Number(e.target.value) || 1 }))}
                  />
                </Field>
              </div>

              <Field label="Corridor Routing Style">
                <Select
                  value={dungeonParams.corridorStyle}
                  options={CORRIDOR_STYLES}
                  onChange={(val) => setDungeonParams((p) => ({ ...p, corridorStyle: val }))}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Branching Chance (%)">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={dungeonParams.branchingChance}
                    onChange={(e) => setDungeonParams((p) => ({ ...p, branchingChance: Number(e.target.value) || 0 }))}
                  />
                </Field>

                <Field label="Map Margin (Tiles)">
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    value={dungeonParams.mapMargin}
                    onChange={(e) => setDungeonParams((p) => ({ ...p, mapMargin: Number(e.target.value) || 0 }))}
                  />
                </Field>
              </div>

              <div className="flex flex-col gap-2 rounded border border-line/40 bg-black/40 p-2.5">
                <Toggle
                  checked={dungeonParams.allowHiddenRooms}
                  onChange={(checked) => setDungeonParams((p) => ({ ...p, allowHiddenRooms: checked }))}
                  label="Allow Secret / Hidden Rooms"
                />
                {dungeonParams.allowHiddenRooms && (
                  <Field label="Hidden Room Chance (%)">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={dungeonParams.hiddenRoomChance}
                      onChange={(e) => setDungeonParams((p) => ({ ...p, hiddenRoomChance: Number(e.target.value) || 0 }))}
                    />
                  </Field>
                )}
                <Toggle
                  checked={dungeonParams.smoothCorners}
                  onChange={(checked) => setDungeonParams((p) => ({ ...p, smoothCorners: checked }))}
                  label="Smooth Corridor Corners"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5 text-[12.5px]">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Noise Scale / Frequency">
                  <Input
                    type="number"
                    step={0.01}
                    min={0.01}
                    max={0.5}
                    value={overworldParams.scale}
                    onChange={(e) => setOverworldParams((p) => ({ ...p, scale: Number(e.target.value) || 0.05 }))}
                  />
                </Field>

                <Field label="Coastline Roughness">
                  <Input
                    type="number"
                    step={0.05}
                    min={0.05}
                    max={1}
                    value={overworldParams.roughness}
                    onChange={(e) => setOverworldParams((p) => ({ ...p, roughness: Number(e.target.value) || 0.3 }))}
                  />
                </Field>
              </div>

              {overworldKind === 'stamped' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Stamp Count">
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={2}
                          max={100}
                          value={overworldParams.minCount}
                          onChange={(e) => setOverworldParams((p) => ({ ...p, minCount: Number(e.target.value) || 5 }))}
                        />
                        <span className="text-dim">–</span>
                        <Input
                          type="number"
                          min={2}
                          max={100}
                          value={overworldParams.maxCount}
                          onChange={(e) => setOverworldParams((p) => ({ ...p, maxCount: Number(e.target.value) || 10 }))}
                        />
                      </div>
                    </Field>

                    <Field label="Stamp Radius (Tiles)">
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={4}
                          max={160}
                          value={overworldParams.minSize}
                          onChange={(e) => setOverworldParams((p) => ({ ...p, minSize: Number(e.target.value) || 10 }))}
                        />
                        <span className="text-dim">–</span>
                        <Input
                          type="number"
                          min={4}
                          max={160}
                          value={overworldParams.maxSize}
                          onChange={(e) => setOverworldParams((p) => ({ ...p, maxSize: Number(e.target.value) || 20 }))}
                        />
                      </div>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="River Count">
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          value={overworldParams.minRivers}
                          onChange={(e) => setOverworldParams((p) => ({ ...p, minRivers: Number(e.target.value) || 0 }))}
                        />
                        <span className="text-dim">–</span>
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          value={overworldParams.maxRivers}
                          onChange={(e) => setOverworldParams((p) => ({ ...p, maxRivers: Number(e.target.value) || 0 }))}
                        />
                      </div>
                    </Field>

                    <Field label="River Width (Tiles)">
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={overworldParams.riverWidth}
                        onChange={(e) => setOverworldParams((p) => ({ ...p, riverWidth: Number(e.target.value) || 1 }))}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="River Wander (0–1)">
                      <Input
                        type="number"
                        step={0.05}
                        min={0}
                        max={1}
                        value={overworldParams.riverWander}
                        onChange={(e) => setOverworldParams((p) => ({ ...p, riverWander: Number(e.target.value) || 0.3 }))}
                      />
                    </Field>

                    <Field label="Elevation / Ridge Noise">
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        value={overworldParams.elevationNoise}
                        onChange={(e) => setOverworldParams((p) => ({ ...p, elevationNoise: Number(e.target.value) || 0 }))}
                      />
                    </Field>
                  </div>
                </>
              )}

              {overworldKind === 'archipelago' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Island Count">
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={overworldParams.minIslands}
                          onChange={(e) => setOverworldParams((p) => ({ ...p, minIslands: Number(e.target.value) || 1 }))}
                        />
                        <span className="text-dim">–</span>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={overworldParams.maxIslands}
                          onChange={(e) => setOverworldParams((p) => ({ ...p, maxIslands: Number(e.target.value) || 1 }))}
                        />
                      </div>
                    </Field>

                    <Field label="Min Island Span">
                      <Input
                        type="number"
                        min={10}
                        max={200}
                        value={overworldParams.minIslandSize}
                        onChange={(e) => setOverworldParams((p) => ({ ...p, minIslandSize: Number(e.target.value) || 20 }))}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Island Margin">
                      <Input
                        type="number"
                        min={2}
                        max={30}
                        value={overworldParams.islandMargin}
                        onChange={(e) => setOverworldParams((p) => ({ ...p, islandMargin: Number(e.target.value) || 4 }))}
                      />
                    </Field>

                    <Field label="Rivers per Island">
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={5}
                          value={overworldParams.minRivers}
                          onChange={(e) => setOverworldParams((p) => ({ ...p, minRivers: Number(e.target.value) || 0 }))}
                        />
                        <span className="text-dim">–</span>
                        <Input
                          type="number"
                          min={0}
                          max={5}
                          value={overworldParams.maxRivers}
                          onChange={(e) => setOverworldParams((p) => ({ ...p, maxRivers: Number(e.target.value) || 0 }))}
                        />
                      </div>
                    </Field>
                  </div>

                  <div className="rounded border border-line/40 bg-black/40 p-2.5">
                    <Toggle
                      checked={Boolean(overworldParams.mainIsland)}
                      onChange={(checked) => setOverworldParams((p) => ({ ...p, mainIsland: checked }))}
                      label="Include Dominant Main Island"
                    />
                  </div>
                </>
              )}

              {overworldKind === 'enclosed' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Opening Threshold">
                    <Input
                      type="number"
                      step={0.05}
                      min={0.1}
                      max={0.8}
                      value={overworldParams.threshold}
                      onChange={(e) => setOverworldParams((p) => ({ ...p, threshold: Number(e.target.value) || 0.25 }))}
                    />
                  </Field>

                  <Field label="Slope Falloff">
                    <Input
                      type="number"
                      step={0.05}
                      min={0.1}
                      max={1}
                      value={overworldParams.falloff}
                      onChange={(e) => setOverworldParams((p) => ({ ...p, falloff: Number(e.target.value) || 0.4 }))}
                    />
                  </Field>

                  <Field label="Valley Stretch">
                    <Input
                      type="number"
                      step={0.05}
                      min={0.1}
                      max={1.5}
                      value={overworldParams.stretch}
                      onChange={(e) => setOverworldParams((p) => ({ ...p, stretch: Number(e.target.value) || 0.5 }))}
                    />
                  </Field>
                </div>
              )}

              {overworldKind === 'void' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Island Density Threshold">
                    <Input
                      type="number"
                      step={0.02}
                      min={0.1}
                      max={0.7}
                      value={overworldParams.threshold}
                      onChange={(e) => setOverworldParams((p) => ({ ...p, threshold: Number(e.target.value) || 0.38 }))}
                    />
                  </Field>

                  <Field label="Void Drift / Wandering">
                    <Input
                      type="number"
                      step={0.05}
                      min={0}
                      max={1}
                      value={overworldParams.drunkenness}
                      onChange={(e) => setOverworldParams((p) => ({ ...p, drunkenness: Number(e.target.value) || 0.3 }))}
                    />
                  </Field>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 border-t border-line/40 pt-2">
                <Field label="Smoothing Passes">
                  <Input
                    type="number"
                    min={0}
                    max={6}
                    value={overworldParams.smoothing}
                    onChange={(e) => setOverworldParams((p) => ({ ...p, smoothing: Number(e.target.value) || 0 }))}
                  />
                </Field>

                <Field label="Gap Filling Passes">
                  <Input
                    type="number"
                    min={0}
                    max={6}
                    value={overworldParams.gaps}
                    onChange={(e) => setOverworldParams((p) => ({ ...p, gaps: Number(e.target.value) || 0 }))}
                  />
                </Field>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center gap-3 rounded border border-line/50 bg-black/60 p-4">
          <div className="flex w-full items-center justify-between border-b border-line/40 pb-2">
            <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-accent-soft">
              {type === 'dungeon' ? <Box className="h-3.5 w-3.5" /> : <Compass className="h-3.5 w-3.5" />}
              Live Preview ({width}×{height})
            </span>
            {previewResult?.stats && (
              <span className="font-mono text-[11px] text-dim">
                {type === 'dungeon'
                  ? `${previewResult.stats.rooms} rooms · ${Math.round(previewResult.stats.coverage * 100)}% floor`
                  : `${Math.round(previewResult.stats.landRatio * 100)}% land`}
              </span>
            )}
          </div>
          <div className="flex min-h-[360px] w-full flex-1 items-center justify-center overflow-hidden">
            <canvas ref={canvasRef} className="max-h-[420px] max-w-full rounded border border-line/30 [image-rendering:pixelated]" />
          </div>
        </div>
      </div>
    </Modal>
  )
}
