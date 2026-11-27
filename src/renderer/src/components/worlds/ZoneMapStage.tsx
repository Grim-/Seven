import { useEffect, useState } from 'react'
import { Check, Crosshair, Layers, MapPin, PenLine, RotateCcw, X } from 'lucide-react'
import { mapArea, placePath, regionPath, type WorldMapUse } from '@shared/maps'
import { formHas, shapeBounds, type Point, type ShapeForm, type ShapeKind } from '@shared/shapes'
import { PLACE_TYPE_KEY, REGION_TYPE_KEY, recordKey, type WorldEntity } from '@shared/world'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import { Button, EmptyState, Field, Input, NumberField, Segmented, Select, StatusBadge } from '../ui'
import { ShapeEditor } from '../shapes/ShapeEditor'
import { MapCanvas } from '../maps/MapCanvas'
import { useMap } from '../maps/useMap'

const SHAPE_MODES: { value: ShapeKind; label: string }[] = [
  { value: 'box', label: 'Box' },
  { value: 'outline', label: 'Polygon' }
]

export function centerOfForm(form: ShapeForm): Point {
  const b = shapeBounds(form)
  return { x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) }
}

export function ZoneMapCanvas({
  world,
  use,
  places,
  regions,
  targetKind,
  targetKey,
  targetLabel,
  form,
  onFormChange,
  spawn,
  onSpawnChange,
  heightClass = 'h-[360px]'
}: {
  world: string
  use: WorldMapUse
  places: Record<string, WorldEntity>
  regions: Record<string, WorldEntity>
  targetKind: 'region' | 'place'
  targetKey: string
  targetLabel: string
  form: ShapeForm | null
  onFormChange: (next: ShapeForm) => void
  spawn?: Point | null
  onSpawnChange?: (next: Point) => void
  heightClass?: string
}) {
  const map = useMap(use.map)
  const [drawKind, setDrawKind] = useState<ShapeKind>('box')
  const [redrawing, setRedrawing] = useState(false)
  const [placingSpawn, setPlacingSpawn] = useState(false)

  useEffect(() => {
    setRedrawing(false)
    setPlacingSpawn(false)
  }, [targetKey, use.map])

  if (map === null) return <div className="border border-line/40 tone-panel-40 p-6 text-center text-[12px] text-dim">Loading map…</div>
  if (map === false) return <EmptyState title="Map not found">This map is no longer available.</EmptyState>

  const area = mapArea(map)
  const isDrawing = !form || redrawing
  const effectiveSpawn = spawn ?? (form ? centerOfForm(form) : null)

  const otherPlaceShapes =
    targetKind === 'place'
      ? Object.fromEntries(Object.entries(use.shapes).filter(([k]) => k !== targetKey))
      : use.shapes
  const otherRegionShapes =
    targetKind === 'region'
      ? Object.fromEntries(Object.entries(use.regionShapes ?? {}).filter(([k]) => k !== targetKey))
      : (use.regionShapes ?? {})

  const overlay = (
    <ShapeEditor
      size={area}
      shapes={form && !isDrawing ? [{ id: targetKey, label: targetLabel, form }] : []}
      onChange={(list) => {
        const next = list[list.length - 1]
        if (next) onFormChange(next.form)
      }}
      selected={targetKey}
      onSelect={() => undefined}
      drawing={isDrawing ? drawKind : null}
      onDrawn={(id) => {
        if (id) setRedrawing(false)
        else if (form) setRedrawing(false)
      }}
      newLabel={targetLabel}
      newId={() => targetKey}
      passThrough={!isDrawing && !placingSpawn}
      marks={() =>
        targetKind === 'place' && effectiveSpawn ? (
          <div
            style={{ left: effectiveSpawn.x, top: effectiveSpawn.y }}
            title={`Spawn point (${effectiveSpawn.x}, ${effectiveSpawn.y})`}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 border border-accent bg-bg/95 px-1.5 py-0.5 font-label text-[9px] caps-5 text-accent shadow"
          >
            <Crosshair className="h-3 w-3" />
            <span>Spawn</span>
          </div>
        ) : null
      }
      className="absolute left-0 top-0"
    >
      <div
        style={{ width: area.w, height: area.h }}
        onPointerDown={
          placingSpawn && targetKind === 'place' && onSpawnChange
            ? (e) => {
                if (e.button !== 0) return
                e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                const scale = rect.width / Math.max(1, area.w)
                const x = Math.round((e.clientX - rect.left) / scale)
                const y = Math.round((e.clientY - rect.top) / scale)
                onSpawnChange({ x, y })
                setPlacingSpawn(false)
              }
            : undefined
        }
        className={placingSpawn ? 'relative z-[20] pointer-events-auto cursor-crosshair' : undefined}
      />
    </ShapeEditor>
  )

  return (
    <div className="flex flex-col border border-line/50 tone-panel-50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/50 tone-well-50 px-3 py-1.5 font-ui text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          {isDrawing ? (
            <>
              <StatusBadge tone="warn">Draw zone required</StatusBadge>
              <Segmented value={drawKind} options={SHAPE_MODES} onChange={setDrawKind} />
              <span className="text-dim">
                {drawKind === 'box' ? 'Click and drag on the map to define the zone' : 'Click points on the map, double-click to close'}
              </span>
              {form && (
                <Button size="sm" variant="ghost" onClick={() => setRedrawing(false)}>
                  Keep current
                </Button>
              )}
            </>
          ) : (
            <>
              <StatusBadge tone="ok">Zone defined</StatusBadge>
              <Button size="sm" variant="secondary" icon={<PenLine />} onClick={() => setRedrawing(true)}>
                Redraw zone
              </Button>
              {targetKind === 'place' && onSpawnChange && effectiveSpawn && (
                <>
                  <Button
                    size="sm"
                    variant={placingSpawn ? 'primary' : 'secondary'}
                    icon={<Crosshair />}
                    onClick={() => setPlacingSpawn((v) => !v)}
                  >
                    {placingSpawn ? 'Click map to place spawn…' : 'Place spawn on map'}
                  </Button>
                  <div className="flex items-center gap-1.5">
                    <span className="text-faint">X</span>
                    <NumberField
                      value={effectiveSpawn.x}
                      onChange={(x) => onSpawnChange({ x: x ?? effectiveSpawn.x, y: effectiveSpawn.y })}
                      min={0}
                      className="w-20"
                    />
                    <span className="text-faint">Y</span>
                    <NumberField
                      value={effectiveSpawn.y}
                      onChange={(y) => onSpawnChange({ x: effectiveSpawn.x, y: y ?? effectiveSpawn.y })}
                      min={0}
                      className="w-20"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<RotateCcw />}
                      title="Center spawn in zone"
                      onClick={() => onSpawnChange(centerOfForm(form))}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className={`relative w-full overflow-hidden ${heightClass}`}>
        <MapCanvas
          map={map}
          shapes={otherPlaceShapes}
          regionShapes={otherRegionShapes}
          places={places}
          regions={regions}
          place={`zone.${world}.${use.map}.${targetKind}.${targetKey}`}
          suspendHits
          selected={targetKind === 'place' ? targetKey : null}
          selectedRegion={targetKind === 'region' ? targetKey : null}
          overlay={overlay}
          className="h-full w-full"
        />
      </div>
    </div>
  )
}

export function CreateZonePane({
  world,
  kind,
  mapUses,
  mapNameOf,
  places,
  regions,
  initialRegion = '',
  initialParent = '',
  onCreated,
  onCancel
}: {
  world: string
  kind: 'region' | 'place'
  mapUses: WorldMapUse[]
  mapNameOf: (id: string) => string
  places: Record<string, WorldEntity>
  regions: Record<string, WorldEntity>
  initialRegion?: string
  initialParent?: string
  onCreated: (key: string) => void
  onCancel: () => void
}) {
  const defaultMap =
    (kind === 'place' && initialParent ? mapUses.find((u) => Boolean(u.shapes[initialParent]))?.map : undefined) ??
    (initialRegion ? mapUses.find((u) => Boolean(u.regionShapes?.[initialRegion]))?.map : undefined) ??
    (kind === 'region' && initialParent ? mapUses.find((u) => Boolean(u.regionShapes?.[initialParent]))?.map : undefined) ??
    mapUses[0]?.map ??
    ''

  const [name, setName] = useState('')
  const [mapId, setMapId] = useState(defaultMap)
  const [regionKey, setRegionKey] = useState(initialRegion)
  const [parentKey, setParentKey] = useState(initialParent)
  const [draftForm, setDraftForm] = useState<ShapeForm | null>(null)
  const [draftSpawn, setDraftSpawn] = useState<Point | null>(null)
  const [saving, setSaving] = useState(false)

  const use = mapUses.find((u) => u.map === mapId) ?? mapUses[0] ?? null
  if (!use) {
    return (
      <EmptyState title="Attach a map first">
        {kind === 'region' ? 'Regions' : 'Places'} require a zone drawn on a map. Add a map to this world first, then create it here.
      </EmptyState>
    )
  }

  const cleanName = name.trim()
  const previewKey = recordKey(cleanName || `new_${kind}`) || `new_${kind}`
  const previewLabel = kind === 'region' ? `Region · ${cleanName || 'New Region'}` : cleanName || 'New Place'
  const canSave = Boolean(cleanName && recordKey(cleanName) && draftForm && !saving)

  const handleFormChange = (next: ShapeForm) => {
    setDraftForm(next)
    const c = centerOfForm(next)
    if (kind === 'place') {
      if (!draftSpawn) setDraftSpawn(c)
      if (!regionKey) {
        const hit = Object.entries(use.regionShapes ?? {}).find(([, rf]) => formHas(rf, c))
        if (hit) setRegionKey(hit[0])
      }
    }
  }

  const handleSave = async () => {
    const key = recordKey(cleanName)
    if (!key || !draftForm) return
    setSaving(true)
    try {
      if (kind === 'region') {
        await engine('worlds.put', {
          id: world,
          type: REGION_TYPE_KEY,
          key,
          entity: { Name: cleanName, ...(parentKey ? { Parent: parentKey } : {}) }
        })
        await engine('worlds.saveMapUse', {
          id: world,
          use: { ...use, regionShapes: { ...(use.regionShapes ?? {}), [key]: draftForm } }
        })
        toast.success('Region Created', `${cleanName} zoned on ${mapNameOf(use.map)}`)
      } else {
        const spawn = draftSpawn ?? centerOfForm(draftForm)
        await engine('worlds.put', {
          id: world,
          type: PLACE_TYPE_KEY,
          key,
          entity: {
            Name: cleanName,
            ...(regionKey ? { Region: regionKey } : {}),
            ...(parentKey ? { Inside: parentKey } : {})
          }
        })
        await engine('worlds.saveMapUse', {
          id: world,
          use: {
            ...use,
            shapes: { ...use.shapes, [key]: draftForm },
            spawns: { ...(use.spawns ?? {}), [key]: spawn }
          }
        })
        toast.success('Place Created', `${cleanName} zoned on ${mapNameOf(use.map)}`)
      }
      onCreated(key)
    } catch (err) {
      failed(`Could not create ${kind}`)(err)
    } finally {
      setSaving(false)
    }
  }

  const regionOptions = [
    { value: '', label: '— None —' },
    ...Object.keys(regions)
      .map((k) => ({
        value: k,
        label: regionPath(regions, k)
          .map((rk) => String(regions[rk]?.Name || rk))
          .join(' › ')
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  ]

  const placeParentOptions = [
    { value: '', label: '— None —' },
    ...Object.keys(places)
      .map((k) => ({
        value: k,
        label: placePath(places, k)
          .map((pk) => String(places[pk]?.Name || pk))
          .join(' › ')
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  ]

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/50 pb-2.5">
        <div className="flex items-center gap-2">
          {kind === 'region' ? <Layers className="h-4 w-4 text-accent" /> : <MapPin className="h-4 w-4 text-accent" />}
          <h2 className="text-[16px] font-semibold text-ink">
            {kind === 'region' ? 'New Region — Draw Zone on Map' : 'New Place — Draw Zone & Spawn on Map'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" icon={<X />} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Check />}
            disabled={!canSave}
            onClick={() => void handleSave()}
            title={!cleanName ? 'Enter a name first' : !draftForm ? 'Draw the zone on the map below first' : undefined}
          >
            {kind === 'region' ? 'Create Region' : 'Create Place'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label={kind === 'region' ? 'Region Name' : 'Place Name'} className="sm:col-span-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === 'region' ? 'e.g. Old Quarter, Harbour District' : 'e.g. The Rusty Anchor'}
          />
        </Field>
        <Field label="Map">
          <Select
            value={use.map}
            options={mapUses.map((u) => ({ value: u.map, label: mapNameOf(u.map) }))}
            onChange={(next) => {
              setMapId(next)
              setDraftForm(null)
              setDraftSpawn(null)
            }}
          />
        </Field>
        {kind === 'region' ? (
          <Field label="Parent Region (Optional)">
            <Select value={parentKey} options={regionOptions} onChange={setParentKey} />
          </Field>
        ) : (
          <Field label="Region / Area">
            <Select
              value={regionKey}
              options={regionOptions}
              onChange={(next) => {
                setRegionKey(next)
                const rMap = next ? mapUses.find((u) => Boolean(u.regionShapes?.[next]))?.map : undefined
                if (rMap && rMap !== use.map) {
                  setMapId(rMap)
                  setDraftForm(null)
                  setDraftSpawn(null)
                }
              }}
            />
          </Field>
        )}
      </div>

      {kind === 'place' && Object.keys(places).length > 0 && (
        <div className="max-w-xs">
          <Field label="Inside Parent Place (Optional)">
            <Select value={parentKey} options={placeParentOptions} onChange={setParentKey} />
          </Field>
        </div>
      )}

      <ZoneMapCanvas
        world={world}
        use={use}
        places={places}
        regions={regions}
        targetKind={kind}
        targetKey={previewKey}
        targetLabel={previewLabel}
        form={draftForm}
        onFormChange={handleFormChange}
        spawn={draftSpawn}
        onSpawnChange={kind === 'place' ? setDraftSpawn : undefined}
        heightClass="h-[460px]"
      />
    </div>
  )
}
