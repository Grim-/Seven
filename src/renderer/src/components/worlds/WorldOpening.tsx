import { useMemo } from 'react'
import { Compass, Sparkles, Zap } from 'lucide-react'
import { placePath } from '@shared/maps'
import { PLACE_TYPE_KEY, cleanWorldLaunch, type WorldLaunch, type WorldMeta } from '@shared/world'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { failed } from '../../lib/notify'
import { cn } from '../../lib/cn'
import { Eyebrow, Field, InlineNumber, Input, Select } from '../ui'
import { SheetSelect } from '../data/sheet/SheetSelect'

interface Props {
  world: WorldMeta
}

export function WorldOpening({ world }: Props) {
  const launch = useMemo(() => cleanWorldLaunch(world.launch), [world.launch])
  const places = useLive(() => engine('worlds.records', { id: world.id, type: PLACE_TYPE_KEY }), 'worlds.changed') ?? {}
  const mapUses = useLive(() => engine('worlds.maps', { id: world.id }), 'worlds.changed') ?? []
  const triggerActions = useLive(() => engine('triggerActions.list'), 'triggerActions.changed') ?? []

  const placeOptions = useMemo(() => {
    const entries = Object.keys(places)
      .map((key) => {
        const breadcrumb = placePath(places, key)
          .map((k) => String(places[k]?.Name || k))
          .join(' › ')
        return { value: key, label: `${breadcrumb} (@place:${key})` }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
    return [{ value: '', label: '— None (choose at start) —' }, ...entries]
  }, [places])

  const mapOptions = useMemo(
    () => [{ value: '', label: '— Auto / First map —' }, ...mapUses.map((u) => ({ value: u.map, label: u.map }))],
    [mapUses]
  )

  const totalMinutes = Math.floor(launch.startingTime / 60)
  const day = Math.floor(totalMinutes / (24 * 60)) + 1
  const hour = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minute = totalMinutes % 60

  const saveLaunch = (patch: Partial<WorldLaunch>) => {
    void engine('worlds.setLaunch', { id: world.id, launch: patch }).catch(failed('Could not save opening setup'))
  }

  const setClock = (d: number, h: number, m: number) => {
    const clampedDay = Math.max(1, d)
    const clampedHour = Math.max(0, Math.min(23, h))
    const clampedMin = Math.max(0, Math.min(59, m))
    saveLaunch({ startingTime: ((clampedDay - 1) * 24 * 60 + clampedHour * 60 + clampedMin) * 60 })
  }

  const toggleAction = (actionId: string) => {
    const has = launch.openingActionIds.includes(actionId)
    const next = has ? launch.openingActionIds.filter((id) => id !== actionId) : [...launch.openingActionIds, actionId]
    saveLaunch({ openingActionIds: next })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* LEFT: WHERE, WHEN & WHO */}
        <div className="flex flex-col gap-3 border border-line/60 bg-panel/60 p-3.5">
          <div className="flex items-center gap-2 border-b border-line/50 pb-2">
            <Compass className="h-4 w-4 text-accent" />
            <Eyebrow>Starting Place, Time &amp; Player</Eyebrow>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Setting">
              <Input
                value={launch.setting}
                onChange={(e) => saveLaunch({ setting: e.target.value })}
                placeholder="e.g. Low-magic borderlands"
              />
            </Field>
            <Field label="Time Period / Era">
              <Input
                value={launch.timePeriod}
                onChange={(e) => saveLaunch({ timePeriod: e.target.value })}
                placeholder="e.g. Late Autumn, Year 412"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Starting Place (Room-Scoped)">
              <Select
                value={launch.startingPlace ?? ''}
                options={placeOptions}
                onChange={(v) => saveLaunch({ startingPlace: v || null })}
              />
            </Field>
            <Field label="Starting Map">
              <Select
                value={launch.startingMap ?? ''}
                options={mapOptions}
                onChange={(v) => saveLaunch({ startingMap: v || null })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Default Player Character">
              <SheetSelect
                value={world.player}
                onChange={(sheet) => void engine('worlds.setPlayer', { id: world.id, sheet }).catch(failed('Could not set default player'))}
              />
            </Field>
            <Field label="Starting World Clock">
              <div className="flex h-8 items-center gap-2 border border-line/70 bg-black/50 px-2.5 font-mono text-[11.5px] text-white">
                <span className="text-faint">Day</span>
                <InlineNumber value={day} min={1} onSave={(v) => setClock(v, hour, minute)} />
                <span className="text-faint">·</span>
                <InlineNumber value={hour} min={0} max={23} onSave={(v) => setClock(day, v, minute)} />
                <span>:</span>
                <InlineNumber value={minute} min={0} max={59} onSave={(v) => setClock(day, hour, v)} />
              </div>
            </Field>
          </div>
        </div>

        {/* RIGHT: STORY OPENING & TRIGGER ACTIONS */}
        <div className="flex flex-col gap-3 border border-line/60 bg-panel/60 p-3.5">
          <div className="flex items-center gap-2 border-b border-line/50 pb-2">
            <Sparkles className="h-4 w-4 text-cyan" />
            <Eyebrow>Session 1 Opening &amp; Triggers</Eyebrow>
          </div>

          <Field label="Tone &amp; Stakes">
            <Input
              value={launch.tone}
              onChange={(e) => saveLaunch({ tone: e.target.value })}
              placeholder="e.g. Tense, investigative, low-clairvoyancy"
            />
          </Field>

          <Field label="World Premise">
            <textarea
              value={launch.premise}
              onChange={(e) => saveLaunch({ premise: e.target.value })}
              rows={2}
              placeholder="The overarching premise of this world's storyline..."
              className="w-full resize-y border border-line/70 bg-black/50 px-2.5 py-2 text-[12.5px] text-white outline-none focus:border-accent"
            />
          </Field>

          <Field label="Session 1 Opening Situation (Inciting Incident)">
            <textarea
              value={launch.incitingIncident}
              onChange={(e) => saveLaunch({ incitingIncident: e.target.value })}
              rows={3}
              placeholder="What is happening the moment a new save begins in the starting room?"
              className="w-full resize-y border border-line/70 bg-black/50 px-2.5 py-2 text-[12.5px] text-white outline-none focus:border-accent"
            />
          </Field>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-purple-300" />
              <Eyebrow>Opening Trigger Actions (Fire on New Save)</Eyebrow>
            </div>
            {!triggerActions.length ? (
              <p className="text-[11.5px] text-faint">No reusable Trigger Actions created yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {triggerActions.map((a) => {
                  const active = launch.openingActionIds.includes(a.id)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAction(a.id)}
                      className={cn(
                        'border px-2.5 py-1 font-mono text-[11px] transition-colors',
                        active
                          ? 'border-accent/60 bg-accent/15 text-accent'
                          : 'border-line/60 bg-black/40 text-dim hover:border-line hover:text-white'
                      )}
                      title={a.description || a.name}
                    >
                      {active ? '✓ ' : '+ '}
                      {a.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
