import { useRef, type MouseEvent, type PointerEvent } from 'react'
import { Skull, Compass } from 'lucide-react'
import type { CreatureSpawner } from '@shared/maps'
import type { Point } from '@shared/shapes'
import { cn } from '../../lib/cn'
import { useViewZoom } from '../space/viewZoom'
import { useSpaceDrag } from '../space/useSpaceDrag'

interface SpawnerLayerProps {
  spawners: CreatureSpawner[]
  selectedId: string | null
  onSelect: (spawner: CreatureSpawner) => void
  onMove: (id: string, at: Point) => void
  onMenu?: (spawner: CreatureSpawner, e: MouseEvent) => void
}

function SpawnerToken({
  spawner,
  selected,
  onSelect,
  onMove,
  onMenu
}: {
  spawner: CreatureSpawner
  selected: boolean
  onSelect: (s: CreatureSpawner) => void
  onMove: (id: string, at: Point) => void
  onMenu?: (s: CreatureSpawner, e: MouseEvent) => void
}) {
  const zoom = useViewZoom()
  const boxRef = useRef<HTMLDivElement>(null)

  const drag = useSpaceDrag<'move'>(
    true,
    (d) => {
      onSelect(spawner)
      onMove(spawner.id, {
        x: Math.round(spawner.at.x + d.delta.x / zoom),
        y: Math.round(spawner.at.y + d.delta.y / zoom)
      })
    },
    () => onSelect(spawner)
  )

  const shift = drag.live ? { x: drag.live.delta.x / zoom, y: drag.live.delta.y / zoom } : { x: 0, y: 0 }
  const posX = spawner.at.x + shift.x
  const posY = spawner.at.y + shift.y
  const radius = spawner.triggerRadius ?? 128

  const borderClass =
    spawner.disposition === 'friendly'
      ? 'border-tint-green shadow-[0_0_12px_color-mix(in_srgb,var(--color-tint-green)_calc(40%*var(--glow)),transparent)]'
      : spawner.disposition === 'neutral'
      ? 'border-tint-amber-ink shadow-[0_0_12px_color-mix(in_srgb,var(--color-tint-amber-ink)_calc(40%*var(--glow)),transparent)]'
      : 'border-alert shadow-[0_0_12px_color-mix(in_srgb,var(--color-alert)_calc(50%*var(--glow)),transparent)]'

  return (
    <>
      {/* PROXIMITY DETECTION RADIUS CIRCLE */}
      {spawner.spawnWhen === 'proximity' && selected && (
        <div
          className="pointer-events-none absolute rounded-full border-2 border-dashed border-secondary-ink/60 bg-secondary-ink/5 transition-all"
          style={{
            left: posX - radius,
            top: posY - radius,
            width: radius * 2,
            height: radius * 2
          }}
        >
          <span className="absolute top-1 left-1/2 -translate-x-1/2 tone-panel-85 px-1.5 py-0.5 font-label text-[9px] text-secondary-ink caps font-bold border border-secondary-ink/40">
            Ambush Radius: {radius}px
          </span>
        </div>
      )}

      {/* TOKEN BODY */}
      <div
        ref={boxRef}
        data-hit
        onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
          onSelect(spawner)
          drag.begin('move', boxRef)(e)
        }}
        onPointerMove={drag.move}
        onPointerUp={drag.end}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onMenu?.(spawner, e)
        }}
        style={{
          left: posX,
          top: posY,
          transform: `translate(-50%, -50%) rotate(${spawner.facing ?? 0}deg) scale(${spawner.scale ?? 1})`
        }}
        className={cn(
          'pointer-events-auto absolute flex flex-col items-center cursor-grab active:cursor-grabbing select-none group touch-none',
          selected ? 'z-30' : 'z-20'
        )}
        title={`${spawner.name} (${spawner.monsterId}) · ${spawner.disposition} · Spawn: ${spawner.spawnWhen}`}
      >
        {/* TOKEN CIRCLE */}
        <div
          className={cn(
            'relative h-11 w-11 rounded-full border-2 tone-well-90 flex items-center justify-center transition-all',
            borderClass,
            selected && 'ring-2 ring-ink ring-offset-1 ring-offset-shade scale-105'
          )}
        >
          <Skull
            className={cn(
              'h-5 w-5',
              spawner.disposition === 'friendly'
                ? 'text-tint-green-ink'
                : spawner.disposition === 'neutral'
                ? 'text-tint-amber-ink'
                : 'text-alert'
            )}
          />
          {spawner.facing !== undefined && spawner.facing !== 0 && (
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-ink rounded-full shadow-[0_0_4px_var(--color-ink)]" />
          )}
        </div>

        {/* LABEL PILL */}
        <div
          style={{ transform: `rotate(-${spawner.facing ?? 0}deg)` }}
          className="mt-1 flex items-center gap-1 tone-panel-90 border border-line px-1.5 py-0.5 font-ui text-[10px] text-ink whitespace-nowrap shadow-md pointer-events-none"
        >
          <span className="font-bold truncate max-w-[120px]">{spawner.name}</span>
          {spawner.spawnWhen === 'proximity' && <Compass className="h-2.5 w-2.5 text-secondary-ink" />}
        </div>
      </div>
    </>
  )
}

export function SpawnerLayer({
  spawners,
  selectedId,
  onSelect,
  onMove,
  onMenu
}: SpawnerLayerProps) {
  if (!spawners || spawners.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {spawners.map((spawner) => (
        <SpawnerToken
          key={spawner.id}
          spawner={spawner}
          selected={selectedId === spawner.id}
          onSelect={onSelect}
          onMove={onMove}
          onMenu={onMenu}
        />
      ))}
    </div>
  )
}
