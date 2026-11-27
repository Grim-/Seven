import { useMemo } from 'react'
import { cleanWorldLaunch, type WorldLaunch, type WorldMeta } from '@shared/world'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useLive } from '../../lib/useLive'
import { CharacterAvatar } from '../chat/CharacterAvatar'
import { Chip } from '../chat/References'
import { LinkInlineEdit } from '../data/LinkInlineEdit'
import { MarkdownEditor } from '../data/MarkdownEditor'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { LinkFaceList } from '../entries/LinkFaces'
import { BrowsePick, Eyebrow, Field, InlineNumber } from '../ui'
import { WorldPlacePick } from './WorldPlacePick'

interface Props {
  world: WorldMeta
}

export function WorldOpening({ world }: Props) {
  const launch = useMemo(() => cleanWorldLaunch(world.launch), [world.launch])
  const mapUses = useLive(() => engine('worlds.maps', { id: world.id }), 'worlds.changed', [world.id]) ?? []
  const mapList = useLive(() => engine('maps.list'), 'maps.changed') ?? []
  const triggerActions = useLive(() => engine('triggerActions.list'), 'triggerActions.changed') ?? []

  const mapOptions = useMemo(
    () =>
      mapUses.map((u) => ({
        value: u.map,
        label: mapList.find((m) => m.id === u.map)?.name ?? u.map,
        group: 'World Maps',
        note: `${Object.keys(u.regionShapes ?? {}).length} regions · ${Object.keys(u.shapes).length} places`
      })),
    [mapUses, mapList]
  )

  const availableActionOptions = useMemo(
    () =>
      triggerActions
        .filter((a) => !launch.openingActionIds.includes(a.id))
        .map((a) => ({
          value: a.id,
          label: a.name,
          group: 'Trigger Actions',
          note: a.description || undefined
        })),
    [triggerActions, launch.openingActionIds]
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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-bg p-5 font-ui select-none">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        {/* CAMPAIGN HEADER BANNER */}
        <section className="flex flex-col gap-4 border border-accent/40 tone-panel-60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line/40 pb-4">
            <div className="flex flex-col gap-1">
              <Eyebrow className="text-accent">Campaign Opening &amp; Story Frame</Eyebrow>
              <h2 className="text-[22px] font-bold text-ink">{world.name}</h2>
            </div>

            {/* STARTING CLOCK */}
            <div className="flex flex-col items-end gap-1">
              <span className="font-label text-[9.5px] caps-8 text-faint">Starting World Clock</span>
              <div className="flex h-9 items-center gap-2 border border-line/70 tone-well-70 px-3 font-data text-[13px] text-ink">
                <span className="text-dim">Day</span>
                <InlineNumber value={day} min={1} onSave={(v) => setClock(v, hour, minute)} />
                <span className="text-faint">·</span>
                <InlineNumber value={hour} min={0} max={23} onSave={(v) => setClock(day, v, minute)} />
                <span>:</span>
                <InlineNumber value={minute} min={0} max={59} onSave={(v) => setClock(day, hour, v)} />
              </div>
            </div>
          </div>

          {/* SETTING / ERA / TONE STRIP */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Setting">
              <div className="border border-line/60 tone-well-50 px-3 py-2 text-[13px] text-ink">
                <LinkInlineEdit
                  value={launch.setting}
                  onSave={(setting) => saveLaunch({ setting })}
                  placeholder="e.g. Rain-slicked port city on the edge of the Rift"
                />
              </div>
            </Field>
            <Field label="Era &amp; Calendar">
              <div className="border border-line/60 tone-well-50 px-3 py-2 text-[13px] text-ink">
                <LinkInlineEdit
                  value={launch.timePeriod}
                  onSave={(timePeriod) => saveLaunch({ timePeriod })}
                  placeholder="e.g. Late Autumn, Year 412"
                />
              </div>
            </Field>
            <Field label="Tone &amp; Stakes">
              <div className="border border-line/60 tone-well-50 px-3 py-2 text-[13px] text-ink">
                <LinkInlineEdit
                  value={launch.tone}
                  onSave={(tone) => saveLaunch({ tone })}
                  placeholder="e.g. Tense, investigative, low-magic survival"
                />
              </div>
            </Field>
          </div>
        </section>

        {/* STORY PREMISE & INCITING INCIDENT (RICH MARKDOWN + LINK CHIPS) */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-2.5 border border-line/60 tone-surface-60 p-4">
            <div className="border-b border-line/40 pb-2">
              <Eyebrow>World Premise</Eyebrow>
            </div>
            <MarkdownEditor
              compact
              rolls={false}
              value={launch.premise}
              onValue={(premise) => saveLaunch({ premise })}
              placeholder="The overarching premise and tension driving this world — type @ to link factions, places, or lore…"
            />
            <LinkFaceList text={launch.premise} />
          </div>

          <div className="flex flex-col gap-2.5 border border-line/60 tone-surface-60 p-4">
            <div className="border-b border-line/40 pb-2">
              <Eyebrow className="text-secondary-ink">Session 1 · Opening Situation</Eyebrow>
            </div>
            <MarkdownEditor
              compact
              rolls={false}
              value={launch.incitingIncident}
              onValue={(incitingIncident) => saveLaunch({ incitingIncident })}
              placeholder="What is unfolding the moment a new playthrough opens in the starting place — type @ to link characters, places, or events…"
            />
            <LinkFaceList text={launch.incitingIncident} />
          </div>
        </section>

        {/* STARTING STAGE: PROTAGONIST, STARTING LOCATION, AND LAUNCH TRIGGERS */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* PROTAGONIST SPOTLIGHT */}
          <div className="flex flex-col gap-3 border border-line/60 tone-surface-60 p-4">
            <Eyebrow>Default Protagonist</Eyebrow>
            <div className="flex items-center gap-3 border border-line/40 tone-well-50 p-3">
              <CharacterAvatar sheetId={world.player} size={44} />
              <div className="min-w-0 flex-1">
                {world.player ? (
                  <Chip
                    kind="sheet"
                    refText={world.player}
                    onRemove={() =>
                      void engine('worlds.setPlayer', { id: world.id, sheet: null }).catch(
                        failed('Could not clear default player')
                      )
                    }
                  />
                ) : (
                  <span className="text-[12px] text-faint">No default protagonist chosen</span>
                )}
              </div>
            </div>
            <SheetSelect
              value={world.player}
              onChange={(sheet) =>
                void engine('worlds.setPlayer', { id: world.id, sheet }).catch(failed('Could not set default player'))
              }
            />
          </div>

          {/* STARTING PLACE & MAP */}
          <div className="flex flex-col gap-3 border border-line/60 tone-surface-60 p-4">
            <Eyebrow>Starting Stage</Eyebrow>
            <Field label="Starting Place">
              <div className="flex flex-col gap-1.5">
                {launch.startingPlace && (
                  <Chip
                    kind="world"
                    refText={`${world.id}/place/${launch.startingPlace}`}
                    onRemove={() => saveLaunch({ startingPlace: null })}
                  />
                )}
                <WorldPlacePick
                  world={world.id}
                  value={launch.startingPlace}
                  placeholder="Choose starting place…"
                  onChange={(startingPlace) => saveLaunch({ startingPlace })}
                />
              </div>
            </Field>
            <Field label="Starting Map">
              <div className="flex flex-col gap-1.5">
                {launch.startingMap && (
                  <Chip
                    kind="map"
                    refText={launch.startingMap}
                    onRemove={() => saveLaunch({ startingMap: null })}
                  />
                )}
                <BrowsePick
                  value={launch.startingMap}
                  options={mapOptions}
                  placeholder="Auto / First map"
                  onChange={(startingMap) => saveLaunch({ startingMap })}
                />
              </div>
            </Field>
          </div>

          {/* OPENING TRIGGER ACTIONS */}
          <div className="flex flex-col gap-3 border border-line/60 tone-surface-60 p-4">
            <Eyebrow>On New Save · Trigger Actions</Eyebrow>
            {launch.openingActionIds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {launch.openingActionIds.map((actionId) => (
                  <Chip
                    key={actionId}
                    kind="triggerAction"
                    refText={actionId}
                    onRemove={() =>
                      saveLaunch({ openingActionIds: launch.openingActionIds.filter((id) => id !== actionId) })
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-faint">
                Fire flags, starter items, or buffs automatically when a new save begins.
              </p>
            )}
            <BrowsePick
              value={null}
              options={availableActionOptions}
              placeholder={triggerActions.length ? 'Add opening trigger action…' : 'No trigger actions created yet'}
              onChange={(actionId) => {
                if (actionId && !launch.openingActionIds.includes(actionId)) {
                  saveLaunch({ openingActionIds: [...launch.openingActionIds, actionId] })
                }
              }}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
