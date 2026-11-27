import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Cable,
  Layers,
  MapPin,
  MousePointer2,
  Skull,
  Stamp,
  UserPlus,
  X,
  Zap
} from 'lucide-react'
import { showName } from '@shared/ids'
import type { CreatureDisposition } from '@shared/maps'
import type { WorldNpc } from '@shared/worldNpcs'
import { cn } from '../../lib/cn'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { CanvasToolbar, useCanvasEditorStore, type CanvasToolDef } from '../canvasEditor'
import { useCompendiumList } from '../dnd/useCompendiumList'
import { FactionSelect } from '../factions/FactionSelect'
import { SheetPortrait } from '../data/SheetPortrait'
import { Button, CollapsibleSearch, CountStepper, Segmented } from '../ui'

export type AtlasCanvasTool =
  | 'select'
  | 'region'
  | 'place'
  | 'stamp'
  | 'character'
  | 'spawner'
  | 'trigger'
  | 'prop'
  | 'link'

export interface StampBrush {
  source: 'world-npc' | 'bestiary'
  id: string
  name: string
  count: number
  faction: string | null
  disposition: CreatureDisposition
}

const DISPOSITION_OPTS: { value: CreatureDisposition; label: string }[] = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'hostile', label: 'Hostile' }
]

/**
 * Compact, auto-search-focused Stamp picker used both in the horizontal toolbar popover
 * and directly inside the expanding right-click context menu.
 */
export function StampPickerPanel({
  worldId,
  value,
  onPick,
  actionHint
}: {
  worldId: string
  value: StampBrush | null
  onPick: (brush: StampBrush) => void
  actionHint?: string
}) {
  const [stampTab, setStampTab] = useState<'archetypes' | 'bestiary'>('archetypes')
  const [query, setQuery] = useState('')
  const [count, setCount] = useState(value?.count ?? 1)
  const [faction, setFaction] = useState<string | null>(value?.faction ?? null)
  const [disposition, setDisposition] = useState<CreatureDisposition>(value?.disposition ?? 'neutral')

  const templateNpcs: WorldNpc[] =
    useLive(() => engine('npcs.list', { world: worldId, layer: 'template' }), 'npcs.changed', [worldId]) ?? []
  const { refs: monsters } = useCompendiumList('monster')

  const shownNpcs = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...templateNpcs].sort(
      (a, b) => Number(Boolean(b.archetype)) - Number(Boolean(a.archetype)) || a.title.localeCompare(b.title)
    )
    return q ? sorted.filter((n) => n.title.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) : sorted
  }, [templateNpcs, query])

  const shownMonsters = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? monsters.filter((m) =>
          [m.name, String(m.facts?.type ?? ''), String(m.facts?.cr ?? '')].some((v) => v.toLowerCase().includes(q))
        )
      : monsters
    return filtered.slice(0, 40)
  }, [monsters, query])

  return (
    <div className="flex w-80 flex-col font-ui select-none">
      {/* TABS + AUTO-FOCUSED COLLAPSIBLE SEARCH */}
      <div className="flex items-center justify-between gap-2 border-b border-line/40 p-2.5">
        <Segmented
          value={stampTab}
          onChange={setStampTab}
          options={[
            { value: 'archetypes', label: `NPCs (${templateNpcs.length})` },
            { value: 'bestiary', label: `Bestiary (${monsters.length})` }
          ]}
        />
        <CollapsibleSearch
          value={query}
          onChange={setQuery}
          placeholder={stampTab === 'archetypes' ? 'Filter NPCs…' : 'Filter creatures…'}
          autoFocus
        />
      </div>

      {/* COMPACT PICK LIST */}
      <div className="max-h-56 min-h-24 overflow-y-auto divide-y divide-line/20">
        {stampTab === 'archetypes' ? (
          shownNpcs.length ? (
            shownNpcs.map((npc) => {
              const picked = value?.source === 'world-npc' && value.id === npc.id
              return (
                <button
                  key={npc.id}
                  type="button"
                  onClick={() =>
                    onPick({
                      source: 'world-npc',
                      id: npc.id,
                      name: showName(npc.title),
                      count,
                      faction: npc.faction ?? faction,
                      disposition: npc.disposition ?? disposition
                    })
                  }
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer',
                    picked ? 'bg-accent/15 text-ink' : 'text-dim hover:tone-card-40 hover:text-ink'
                  )}
                >
                  <SheetPortrait image={npc.image} className="h-7 w-7 shrink-0 border border-line/50" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold text-ink">{showName(npc.title)}</div>
                    <div className="truncate text-[10px] text-faint">
                      {npc.archetype ? 'Archetype' : 'World NPC'}
                    </div>
                  </div>
                </button>
              )
            })
          ) : (
            <div className="p-3 text-[11px] text-faint">No matching World NPCs or Archetypes.</div>
          )
        ) : shownMonsters.length ? (
          shownMonsters.map((m) => {
            const picked = value?.source === 'bestiary' && value.id === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  onPick({
                    source: 'bestiary',
                    id: m.id,
                    name: m.name,
                    count,
                    faction,
                    disposition: 'hostile'
                  })
                }
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left transition-colors cursor-pointer',
                  picked ? 'bg-accent/15 text-ink' : 'text-dim hover:tone-card-40 hover:text-ink'
                )}
              >
                <span className="truncate text-[12px] font-semibold text-ink">{m.name}</span>
                {m.facts?.cr !== undefined && (
                  <span className="shrink-0 font-data text-[10px] text-dim">CR {String(m.facts.cr)}</span>
                )}
              </button>
            )
          })
        ) : (
          <div className="p-3 text-[11px] text-faint">No bestiary match.</div>
        )}
      </div>

      {/* CLEAN NON-OVERLAPPING OPTIONS FOOTER */}
      <div className="flex flex-col gap-2.5 border-t border-line/40 tone-well-40 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-label text-[10px] font-bold caps-8 text-dim">Count</span>
          <CountStepper value={count} min={1} max={12} small onChange={setCount} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-label text-[10px] font-bold caps-8 text-dim">Posture</span>
          <Segmented value={disposition} onChange={setDisposition} options={DISPOSITION_OPTS} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label text-[10px] font-bold caps-8 text-dim">Faction</span>
          <FactionSelect worldId={worldId} value={faction} onChange={setFaction} />
        </div>
        {actionHint && <div className="pt-0.5 text-[10.5px] text-dim">{actionHint}</div>}
      </div>
    </div>
  )
}

const ATLAS_CANVAS_TOOLS: CanvasToolDef[] = [
  { id: 'select', label: 'Select', group: 'nav', shortcut: 'V', icon: <MousePointer2 /> },
  { id: 'region', label: 'Region', group: 'zones', shortcut: 'R', icon: <Layers /> },
  { id: 'place', label: 'Place', group: 'zones', shortcut: 'P', icon: <MapPin /> },
  { id: 'stamp', label: 'Stamp', group: 'place', shortcut: 'S', icon: <Stamp /> },
  { id: 'character', label: 'Actor', group: 'place', icon: <UserPlus /> },
  { id: 'spawner', label: 'Spawner', group: 'place', icon: <Skull /> },
  { id: 'trigger', label: 'Trigger', group: 'place', icon: <Zap /> },
  { id: 'prop', label: 'Prop', group: 'place', icon: <Box /> },
  {
    id: 'link',
    label: 'Link',
    group: 'wire',
    shortcut: 'L',
    icon: <Cable />,
    stages: [
      { id: 'pick-source', label: 'Pick Source', hint: 'Click a prop or trigger to start a link', cursor: 'crosshair' },
      { id: 'pick-target', label: 'Pick Target', hint: 'Click the destination prop or trigger', cursor: 'crosshair' }
    ]
  }
]

/**
 * Movable, Lockable, Hover-Reveal Horizontal Atlas Canvas Toolbar powered by `CanvasToolbar`.
 */
export function AtlasToolDock({
  worldId,
  activeTool,
  linkingSourceLabel,
  onSelectTool,
  onCancelLink,
  stampBrush,
  onStampBrushChange
}: {
  worldId: string
  activeTool: AtlasCanvasTool
  linkingSourceLabel?: string | null
  onSelectTool: (tool: AtlasCanvasTool) => void
  onCancelLink?: () => void
  stampBrush: StampBrush | null
  onStampBrushChange: (brush: StampBrush | null) => void
}) {
  const store = useCanvasEditorStore()
  const [stampPickerOpen, setStampPickerOpen] = useState(false)

  // Keep stamp picker closed whenever tool leaves 'stamp'
  useEffect(() => {
    if (activeTool !== 'stamp') setStampPickerOpen(false)
  }, [activeTool])

  // Sync external tool + linking state into the shared CanvasEditor store so CanvasToolbar's
  // multi-stage banner and active indicator stay 100% authoritative.
  useEffect(() => {
    if (linkingSourceLabel) {
      store.getState().enterTool('link', 1, [undefined, { source: linkingSourceLabel }])
      return
    }
    if (activeTool === 'select') {
      store.getState().enterTool('select')
      return
    }
    store.getState().enterTool(activeTool, 0)
  }, [store, activeTool, linkingSourceLabel])

  // Propagate CanvasToolbar stage step-back / cancel effects back to WorldMapView cleanly
  useEffect(() => {
    return store.getState().subscribeEffects((eff) => {
      if (eff.type === 'tool_stage_changed' && eff.toolId === 'link' && eff.toStage === 0) {
        onCancelLink?.()
        return
      }
      if (eff.type === 'tool_cancelled') {
        setStampPickerOpen(false)
        onCancelLink?.()
        onSelectTool('select')
      }
    })
  }, [store, onCancelLink, onSelectTool])

  const tools = useMemo<CanvasToolDef[]>(
    () =>
      ATLAS_CANVAS_TOOLS.map((t) =>
        t.id === 'link' && linkingSourceLabel
          ? {
              ...t,
              stages: [
                t.stages![0],
                {
                  id: 'pick-target',
                  label: `Link from ${linkingSourceLabel}`,
                  hint: 'Click destination prop or trigger',
                  cursor: 'crosshair'
                }
              ]
            }
          : t
      ),
    [linkingSourceLabel]
  )

  const handleToolClick = (id: string) => {
    const tool = id as AtlasCanvasTool
    if (tool === 'stamp') {
      if (activeTool === 'stamp') {
        setStampPickerOpen((v) => !v)
      } else {
        onSelectTool('stamp')
        setStampPickerOpen(true)
      }
      return
    }
    if (tool !== 'link' && linkingSourceLabel) {
      onCancelLink?.()
    }
    setStampPickerOpen(false)
    onSelectTool(tool)
  }

  const optionsBar =
    activeTool === 'stamp' && stampBrush ? (
      <div className="flex items-center gap-2 text-[11px] text-accent">
        <button
          type="button"
          onClick={() => setStampPickerOpen((v) => !v)}
          className="max-w-44 truncate font-semibold hover:underline cursor-pointer"
          title="Click to change stamp brush"
        >
          {stampBrush.name} ×{stampBrush.count}
        </button>
        <span className="text-[10px] text-dim">Click map to stamp · Right-click cancels</span>
        <button
          type="button"
          onClick={() => {
            setStampPickerOpen(false)
            onSelectTool('select')
          }}
          title="Cancel Stamp (Esc or Right-click)"
          className="text-accent hover:text-ink cursor-pointer"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    ) : undefined

  const dropdown = (
    <div>
      <div className="flex items-center justify-between border-b border-line/50 px-2.5 py-1.5">
        <span className="font-label text-[10px] font-bold caps-10 text-accent-soft">Pick Stamp Brush</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setStampPickerOpen(false)}
          className="h-5 px-1 text-[10px]"
        >
          Hide
        </Button>
      </div>
      <StampPickerPanel
        worldId={worldId}
        value={stampBrush}
        onPick={(brush) => {
          onStampBrushChange(brush)
          setStampPickerOpen(false)
        }}
        actionHint="Pick one, then click map to stamp · Right-click cancels"
      />
    </div>
  )

  return (
    <CanvasToolbar
      toolbarId="atlas-tools"
      tools={tools}
      onSelectTool={handleToolClick}
      optionsBar={optionsBar}
      dropdown={dropdown}
      dropdownOpen={activeTool === 'stamp' && stampPickerOpen}
    />
  )
}
