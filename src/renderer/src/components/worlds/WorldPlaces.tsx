import { useMemo, useState } from 'react'
import { MapPin, Plus, Trash2, ArrowRight, Eye, UserPlus } from 'lucide-react'
import { localPlaceMermaid, placePath, placeTree, type PlaceNode } from '@shared/maps'
import { PLACE_TYPE_KEY, recordKey, type WorldEntity, type WorldEntry, type WorldMeta } from '@shared/world'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import { cn } from '../../lib/cn'
import { Button, EmptyState, Eyebrow, Field, Input, Popover, Select, askText, confirmDelete, openMenu } from '../ui'
import { PlayList } from '../play/PlayList'
import { placePlay } from '../play/playHolder'
import { useWorldPlayer } from '../play/useWorldPlayer'
import { CharacterRow } from '../maps/CharacterRow'
import { characterItems, setWhere } from '../maps/placeActions'
import { usePresence } from '../maps/usePresence'
import { EntryPicker } from '../library/EntryPicker'

interface Props {
  world: WorldMeta
  initialKey?: string
}

function normalizeExits(raw: unknown): WorldEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((e) => {
      if (typeof e === 'string') return { text: e, ref: null, locked: false }
      if (!e || typeof e !== 'object') return null
      const r = e as { text?: unknown; ref?: unknown; locked?: unknown }
      return {
        text: typeof r.text === 'string' ? r.text : '',
        ref: typeof r.ref === 'string' && r.ref ? r.ref : null,
        locked: r.locked === true
      }
    })
    .filter((e): e is WorldEntry => e !== null && (Boolean(e.text) || Boolean(e.ref)))
}

export function WorldPlaces({ world, initialKey }: Props) {
  const places = useLive(() => engine('worlds.records', { id: world.id, type: PLACE_TYPE_KEY }), 'worlds.changed') ?? {}
  const mapUses = useLive(() => engine('worlds.maps', { id: world.id }), 'worlds.changed') ?? []
  const hereMap = usePresence(world.id)
  const player = useWorldPlayer(world.id)
  const [selected, setSelected] = useState<string | null>(initialKey ?? null)
  const [newExitLabel, setNewExitLabel] = useState('')
  const [newExitTarget, setNewExitTarget] = useState('')

  const shaped = useMemo(() => {
    const out: Record<string, never> = {}
    for (const u of mapUses) for (const k of Object.keys(u.shapes)) out[k] = undefined as never
    return out
  }, [mapUses])

  const tree = useMemo(() => placeTree(places, shaped), [places, shaped])
  const keys = Object.keys(places)
  const activeKey = selected && selected in places ? selected : (keys[0] ?? null)
  const active = activeKey ? places[activeKey] : null

  const updateField = (key: string, patch: WorldEntity) => {
    void engine('worlds.put', { id: world.id, type: PLACE_TYPE_KEY, key, entity: patch }).catch(failed('Could not save place'))
  }

  const handleCreate = () => {
    askText('New Place', 'Place name (e.g. Room 12 (Valerius))', '', async (name) => {
      const clean = name.trim()
      if (!clean) return
      const key = recordKey(clean)
      if (!key) return
      try {
        await engine('worlds.put', {
          id: world.id,
          type: PLACE_TYPE_KEY,
          key,
          entity: { Name: clean, ...(activeKey ? { Inside: activeKey } : {}) }
        })
        setSelected(key)
        toast.success('Place Created', clean)
      } catch (err) {
        failed('Could not create place')(err)
      }
    })
  }

  const handleDelete = (key: string) => {
    const label = String(places[key]?.Name || key)
    confirmDelete(`Delete "${label}"?`, 'Places inside it will move up one level.', () =>
      engine('worlds.remove', { id: world.id, type: PLACE_TYPE_KEY, key }).then(() => {
        if (selected === key) setSelected(null)
      })
    )
  }

  const renderTreeNodes = (nodes: PlaceNode[], depth = 0) =>
    nodes.map((n) => (
      <div key={n.key}>
        <button
          type="button"
          onClick={() => setSelected(n.key)}
          style={{ paddingLeft: `${10 + depth * 14}px` }}
          className={cn(
            'flex w-full items-center justify-between border-l-2 py-1.5 pr-2 text-left text-[12px] transition-colors',
            activeKey === n.key
              ? 'border-l-accent bg-accent/10 font-semibold text-white'
              : 'border-l-transparent text-dim hover:bg-card/50 hover:text-white'
          )}
        >
          <span className="truncate">{n.name}</span>
          {n.shaped && <span className="font-mono text-[9px] text-cyan">MAP</span>}
        </button>
        {n.children.length > 0 && renderTreeNodes(n.children, depth + 1)}
      </div>
    ))

  const exits = active ? normalizeExits(active.Exits) : []
  const here = activeKey ? (hereMap[activeKey] ?? []) : []
  const mermaid = activeKey ? localPlaceMermaid(places, activeKey) : null
  const parentOptions = [
    { value: '', label: '— Top-level (not inside another place) —' },
    ...keys
      .filter((k) => k !== activeKey)
      .map((k) => ({
        value: k,
        label: placePath(places, k)
          .map((p) => String(places[p]?.Name || p))
          .join(' › ')
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  ]

  const addExit = () => {
    if (!activeKey) return
    const label = newExitLabel.trim() || 'door'
    const ref = newExitTarget.trim() || null
    const next: WorldEntry[] = [...exits, { text: label, ref, locked: false }]
    updateField(activeKey, { Exits: next })
    setNewExitLabel('')
    setNewExitTarget('')
  }

  const removeExit = (idx: number) => {
    if (!activeKey) return
    updateField(activeKey, { Exits: exits.filter((_, i) => i !== idx) })
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden border border-line/40 bg-bg">
      {/* LEFT PLACE HIERARCHY RAIL */}
      <div className="flex w-64 shrink-0 flex-col border-r border-line/40 bg-sidebar/40 select-none">
        <div className="flex items-center justify-between border-b border-line/40 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-accent" />
            <Eyebrow>Places ({keys.length})</Eyebrow>
          </div>
          <Button size="sm" variant="badge" icon={<Plus className="h-3 w-3" />} onClick={handleCreate}>
            New
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {!keys.length ? (
            <div className="p-3 text-[11.5px] text-faint">No places yet. Click New to add a room, building, or region.</div>
          ) : (
            renderTreeNodes(tree)
          )}
        </div>
      </div>

      {/* RIGHT PLACE INSPECTOR */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {!activeKey || !active ? (
          <EmptyState title="Select or create a place">
            Places form a nested hierarchy (`Inside`) with visual descriptions (`Looks`) and direct 1-hop `Exits` so agents reason about rooms without clairvoyancy.
          </EmptyState>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            <div className="flex items-start justify-between gap-3 border-b border-line/50 pb-3">
              <div>
                <div className="font-mono text-[10.5px] text-dim">
                  {placePath(places, activeKey)
                    .map((k) => String(places[k]?.Name || k))
                    .join(' › ')}{' '}
                  · <span className="text-cyan">@place:{activeKey}</span>
                </div>
                <h2 className="mt-0.5 text-[17px] font-semibold text-white">{String(active.Name || activeKey)}</h2>
              </div>
              <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => handleDelete(activeKey)}>
                Delete
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input
                  value={String(active.Name ?? '')}
                  onChange={(e) => updateField(activeKey, { Name: e.target.value })}
                />
              </Field>
              <Field label="Inside (Parent Place)">
                <Select
                  value={typeof active.Inside === 'string' ? active.Inside : ''}
                  options={parentOptions}
                  onChange={(v) => updateField(activeKey, { Inside: v || null })}
                />
              </Field>
            </div>

            <Field label="Looks (Visual Description)">
              <textarea
                value={String(active.Looks ?? '')}
                onChange={(e) => updateField(activeKey, { Looks: e.target.value })}
                rows={3}
                placeholder="What does this place look like at a glance? Lighting, layout, materials, atmosphere..."
                className="w-full resize-y border border-line/70 bg-black/50 px-2.5 py-2 text-[12.5px] text-white outline-none focus:border-accent"
              />
            </Field>

            {/* DIRECT EXITS + 1-HOP MERMAID PREVIEW */}
            <div className="flex flex-col gap-2 border border-line/60 bg-panel/60 p-3">
              <div className="flex items-center justify-between">
                <Eyebrow>Direct Exits (1-Hop Connections)</Eyebrow>
                <span className="font-mono text-[10px] text-faint">Agents only see exits from their current room</span>
              </div>

              {exits.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {exits.map((ex, i) => (
                    <div key={`${ex.text}-${i}`} className="flex items-center justify-between gap-2 border border-line/50 bg-black/40 px-2.5 py-1.5 font-mono text-[11.5px]">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-white">{ex.text}</span>
                        {ex.ref && (
                          <>
                            <ArrowRight className="h-3 w-3 text-faint" />
                            <span className="text-cyan">
                              {String(places[ex.ref]?.Name || ex.ref)} (@place:{ex.ref})
                            </span>
                          </>
                        )}
                      </div>
                      <button type="button" onClick={() => removeExit(i)} className="text-faint hover:text-alert">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Input
                  value={newExitLabel}
                  onChange={(e) => setNewExitLabel(e.target.value)}
                  placeholder="Exit description (e.g. oak door, stairs down)"
                  className="min-w-[200px] flex-1"
                />
                <Select
                  value={newExitTarget}
                  options={[
                    { value: '', label: '— Destination place —' },
                    ...keys
                      .filter((k) => k !== activeKey)
                      .map((k) => ({ value: k, label: `${String(places[k]?.Name || k)} (@place:${k})` }))
                  ]}
                  onChange={setNewExitTarget}
                  className="w-56"
                />
                <Button size="sm" variant="secondary" icon={<Plus className="h-3 w-3" />} onClick={addExit}>
                  Add Exit
                </Button>
              </div>

              {mermaid && (
                <div className="mt-2 border-t border-line/40 pt-2">
                  <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-cyan">
                    <Eye className="h-3 w-3" /> Agent 1-Hop View (Mermaid)
                  </div>
                  <pre className="overflow-x-auto border border-line/40 bg-black/60 p-2 font-mono text-[11px] text-dim">{mermaid}</pre>
                </div>
              )}
            </div>

            <Field label="Now (What is happening here)">
              <textarea
                value={String(active.Now ?? '')}
                onChange={(e) => updateField(activeKey, { Now: e.target.value })}
                rows={2}
                placeholder="Current state / scene activity in this room..."
                className="w-full resize-y border border-line/70 bg-black/50 px-2.5 py-2 text-[12.5px] text-white outline-none focus:border-accent"
              />
            </Field>

            <div className="flex flex-col gap-1.5 border border-line/60 bg-panel/60 p-3">
              <div className="flex items-center justify-between">
                <Eyebrow>Who is here ({here.length})</Eyebrow>
                <Popover trigger={<UserPlus className="h-3.5 w-3.5 text-accent" />} title="Put a character here">
                  {(close) => (
                    <EntryPicker
                      kind="sheet"
                      title="Put a character here"
                      inline
                      onClose={close}
                      onPick={(hit) => void setWhere(hit.id, activeKey).then(close, failed('Could not move them'))}
                    />
                  )}
                </Popover>
              </div>
              {here.length ? (
                here.map((v) => (
                  <CharacterRow
                    key={v.sheet}
                    visitor={v}
                    onRemove={() => void setWhere(v.sheet, null).catch(failed('Could not remove them'))}
                    onMenu={(e) => openMenu(e, v.name, characterItems(v, places, activeKey))}
                  />
                ))
              ) : (
                <span className="text-[12px] text-faint">Nobody is stationed here.</span>
              )}
            </div>

            <Field label="Files (Links belonging here)">
              <Input
                value={String(active.Files ?? '')}
                onChange={(e) => updateField(activeKey, { Files: e.target.value })}
                placeholder="e.g. @page:ledger @sheet:innkeeper"
              />
            </Field>

            <PlayList play={placePlay(world.id, activeKey, active, player, [])} />
          </div>
        )}
      </div>
    </div>
  )
}
