import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Play, Plus, Sparkles, UserPlus, X } from 'lucide-react'
import { placePath } from '@shared/maps'
import { PLACE_TYPE_KEY, cleanWorldLaunch, type WorldMeta } from '@shared/world'
import type { SaveCreateOptions, SaveLoadoutOverride, SaveMeta } from '@shared/game/save'
import { ABILITY_TEMPLATES, BUFF_TEMPLATES, CLASS_TEMPLATES, ITEM_TEMPLATES } from '@shared/game/defs'
import { formatAlmanacClock } from '@shared/almanac'
import { renderSentenceTemplate } from '@shared/game/effectWords'
import { cleanDnd } from '@shared/dnd'
import { ModelReadyControl } from './ModelReadyControl'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import { cn } from '../../lib/cn'
import { Button, InlineEdit, InlineNumber, Popover, Select } from '../ui'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { useGameCatalog } from '../game/useGameCatalog'
import { useKindEntries } from '../../views/data/useKindEntries'
import { LinkTextarea } from '../data/LinkTextarea'

interface Props {
  world: WorldMeta
  latestSave: SaveMeta | null
  saveCount: number
  onContinueSave: (saveId: string) => void
  onStarted: (saveId: string) => void
}

interface TemplateOption {
  id: string
  label: string
}

function listTemplates(catalog: ReturnType<typeof useGameCatalog>, kind: string): TemplateOption[] {
  const raw = catalog?.templates?.(kind) ?? {}
  return Object.entries(raw)
    .map(([id, def]) => {
      const r = def && typeof def === 'object' ? (def as Record<string, unknown>) : {}
      const label = typeof r.label === 'string' && r.label.trim() ? r.label.trim() : typeof r.name === 'string' && r.name.trim() ? r.name.trim() : id
      return { id, label }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function AdventureIntro({ world, latestSave, saveCount, onContinueSave, onStarted }: Props) {
  const launch = useMemo(() => cleanWorldLaunch(world.launch), [world.launch])
  const catalog = useGameCatalog()
  const sheets = useKindEntries('sheet') ?? []
  const places = useLive(() => engine('worlds.records', { id: world.id, type: PLACE_TYPE_KEY }), 'worlds.changed') ?? {}
  const mapUses = useLive(() => engine('worlds.maps', { id: world.id }), 'worlds.changed') ?? []
  const triggerActions = useLive(() => engine('triggerActions.list'), 'triggerActions.changed') ?? []

  const [saveName, setSaveName] = useState(`Save ${saveCount + 1}`)
  const [playerId, setPlayerId] = useState<string | null>(world.player ?? sheets[0]?.id ?? null)

  useEffect(() => {
    if (!sheets.length) return
    if (playerId && sheets.some((s) => s.id === playerId)) return
    const validWorldPlayer = world.player && sheets.some((s) => s.id === world.player) ? world.player : null
    setPlayerId(validWorldPlayer ?? sheets[0]?.id ?? null)
  }, [sheets, world.player, playerId])
  const [companions, setCompanions] = useState<string[]>([])
  const [startingPlace, setStartingPlace] = useState<string | null>(launch.startingPlace)
  const [startingMap, setStartingMap] = useState<string | null>(launch.startingMap ?? mapUses[0]?.map ?? null)
  const [startingTime, setStartingTime] = useState<number>(launch.startingTime)
  const [premise, setPremise] = useState<string>(launch.incitingIncident || launch.premise)
  const [openingActionIds, setOpeningActionIds] = useState<string[]>(launch.openingActionIds)
  const [loadout, setLoadout] = useState<Record<string, SaveLoadoutOverride>>({})
  const [openDrawer, setOpenDrawer] = useState<Record<string, boolean>>({})
  const [editingOpening, setEditingOpening] = useState(false)
  const [starting, setStarting] = useState(false)

  const classOptions = useMemo(() => listTemplates(catalog, CLASS_TEMPLATES), [catalog])
  const abilityOptions = useMemo(() => listTemplates(catalog, ABILITY_TEMPLATES), [catalog])
  const itemOptions = useMemo(() => listTemplates(catalog, ITEM_TEMPLATES), [catalog])
  const buffOptions = useMemo(() => listTemplates(catalog, BUFF_TEMPLATES), [catalog])

  const placeBreadcrumb = (key: string | null) => {
    if (!key) return 'No starting place'
    if (!(key in places)) return key
    return placePath(places, key)
      .map((k) => String(places[k]?.Name || k))
      .join(' › ')
  }

  const totalMinutes = Math.floor(startingTime / 60)
  const day = Math.floor(totalMinutes / (24 * 60)) + 1
  const hour = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minute = totalMinutes % 60
  const setClock = (d: number, h: number, m: number) => {
    const cd = Math.max(1, d)
    const ch = Math.max(0, Math.min(23, h))
    const cm = Math.max(0, Math.min(59, m))
    setStartingTime(((cd - 1) * 24 * 60 + ch * 60 + cm) * 60)
  }

  const patchLoadout = (sheetId: string, patch: Partial<SaveLoadoutOverride>) => {
    setLoadout((prev) => ({
      ...prev,
      [sheetId]: { ...(prev[sheetId] ?? {}), ...patch }
    }))
  }

  const togglePiece = (sheetId: string, kind: 'abilities' | 'items' | 'buffs', id: string) => {
    const current = loadout[sheetId]?.[kind] ?? []
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    patchLoadout(sheetId, { [kind]: next })
  }

  const playerSheet = sheets.find((s) => s.id === playerId)
  const availableCompanions = sheets.filter((s) => s.id !== playerId && !companions.includes(s.id))
  const labelOf = (opts: TemplateOption[], id: string) => opts.find((o) => o.id === id)?.label ?? id

  const handleQuickCreatePlayer = async () => {
    try {
      const s = await engine('sheets.save', { id: null, title: 'Adventurer', fields: [], values: {}, dnd: cleanDnd({}) })
      setPlayerId(s.id)
      toast.success('Character Created', s.title)
    } catch (err) {
      failed('Could not create character')(err)
    }
  }

  const handleBegin = async () => {
    if (!playerId) {
      toast.info('Select a Character', 'Choose who you are playing as first.')
      return
    }
    setStarting(true)
    try {
      await engine('worlds.setPlayer', { id: world.id, sheet: playerId })
      const options: SaveCreateOptions = {
        player: playerId,
        companions,
        startingMap,
        startingPlace,
        startingTime,
        premise,
        incitingIncident: premise,
        tone: launch.tone,
        openingActionIds,
        loadout
      }
      const created = await engine('saves.create', { world: world.id, name: saveName.trim() || `Save ${saveCount + 1}`, copy: false, options })
      toast.success('Adventure Started', `${created.name} + Almanac created`)
      onStarted(created.id)
    } catch (err) {
      failed('Could not start adventure')(err)
    } finally {
      setStarting(false)
    }
  }

  const renderMemberCard = (sheetId: string, isPlayer: boolean) => {
    const sheet = sheets.find((s) => s.id === sheetId)
    const name = sheet?.title ?? sheetId
    const ov = loadout[sheetId] ?? {}
    const cls = ov.classId ? labelOf(classOptions, ov.classId) : 'Sheet default'
    const abilities = ov.abilities ?? []
    const items = ov.items ?? []
    const buffs = ov.buffs ?? []
    const isOpen = Boolean(openDrawer[sheetId])

    return (
      <div key={sheetId} className={cn('border tone-card-90 p-3', isPlayer ? 'border-line-strong' : 'border-line/70')}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                'grid h-8 w-8 shrink-0 place-items-center border font-ui text-[12px] font-bold',
                isPlayer ? 'border-accent/50 bg-accent/10 text-accent' : 'border-secondary-ink/40 bg-secondary-ink/10 text-secondary-ink'
              )}
            >
              {name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13.5px] font-semibold text-ink">{name}</span>
                <span
                  className={cn(
                    'border px-1.5 py-0.5 font-label text-[9px] caps-12 ',
                    isPlayer ? 'border-accent/45 bg-accent/10 text-accent' : 'border-secondary-ink/35 bg-secondary-ink/10 text-secondary-ink'
                  )}
                >
                  {isPlayer ? 'YOU' : 'PARTY'}
                </span>
              </div>
              <div className="font-ui text-[10.5px] text-dim">
                {cls} · {items.length} item{items.length === 1 ? '' : 's'} · {abilities.length} abilit{abilities.length === 1 ? 'y' : 'ies'} · {buffs.length} buff{buffs.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!isPlayer && (
              <button
                type="button"
                onClick={() => setCompanions((prev) => prev.filter((id) => id !== sheetId))}
                className="border border-line/70 tone-well-50 px-2 py-1 font-ui text-[10px] text-dim hover:border-alert/60 hover:text-alert"
              >
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpenDrawer((prev) => ({ ...prev, [sheetId]: !prev[sheetId] }))}
              className={cn(
                'inline-flex items-center gap-1 border px-2 py-1 font-ui text-[10.5px]',
                isOpen ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line/70 tone-well-50 text-dim hover:text-ink'
              )}
            >
              Customize {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="mt-2.5 flex flex-col gap-2 border-t border-dashed border-line pt-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 font-label text-[10px] caps-10 text-faint">Class</span>
              <Select
                value={ov.classId ?? ''}
                options={[{ value: '', label: 'Keep sheet class' }, ...classOptions.map((c) => ({ value: c.id, label: c.label }))]}
                onChange={(v) => patchLoadout(sheetId, { classId: v || null })}
                className="h-7 w-48 text-[11px]"
              />
            </div>

            {(
              [
                { kind: 'abilities', label: 'ABILITIES', opts: abilityOptions, list: abilities, cls: 'border-tint-purple-ink/40 bg-tint-purple/10 text-tint-purple-ink' },
                { kind: 'items', label: 'ITEMS', opts: itemOptions, list: items, cls: 'border-secondary-ink/35 bg-secondary-ink/10 text-secondary-ink' },
                { kind: 'buffs', label: 'BUFFS', opts: buffOptions, list: buffs, cls: 'border-accent/40 bg-accent/10 text-accent' }
              ] as const
            ).map((row) => (
              <div key={row.kind} className="flex flex-wrap items-center gap-1.5">
                <span className="w-16 shrink-0 font-label text-[10px] caps-10 text-faint">{row.label}</span>
                {row.list.map((id) => (
                  <span key={id} className={cn('inline-flex items-center gap-1 border px-2 py-0.5 font-ui text-[10.5px]', row.cls)}>
                    {labelOf(row.opts, id)}
                    <button type="button" onClick={() => togglePiece(sheetId, row.kind, id)} className="text-faint hover:text-alert">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {row.opts.length > 0 && (
                  <Popover
                    align="start"
                    trigger={
                      <span className="border border-dashed border-line px-2 py-0.5 font-ui text-[10.5px] text-dim hover:border-accent/50 hover:text-accent">
                        + {row.label === 'ABILITIES' ? 'Ability' : row.label === 'ITEMS' ? 'Item' : 'Buff'}
                      </span>
                    }
                    className="max-h-56 w-60 overflow-y-auto p-1.5"
                  >
                    {row.opts.map((opt) => {
                      const active = row.list.includes(opt.id)
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => togglePiece(sheetId, row.kind, opt.id)}
                          className={cn(
                            'flex w-full items-center justify-between px-2 py-1 text-left font-ui text-[11px]',
                            active ? 'bg-accent/15 text-accent' : 'text-dim hover:bg-ink/5 hover:text-ink'
                          )}
                        >
                          <span className="truncate">{opt.label}</span>
                          {active && <span>✓</span>}
                        </button>
                      )
                    })}
                  </Popover>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const placeSummary = startingPlace ? placeBreadcrumb(startingPlace) : 'No place selected'
  const placeTitle = startingPlace ? String(places[startingPlace]?.Name || startingPlace) : ''
  const companionNames = companions.map((id) => sheets.find((s) => s.id === id)?.title ?? id)
  const playerName = playerSheet?.title ?? 'You'
  const partyNames = [playerName, ...companionNames].join(' and ')
  const openingVars: Record<string, string> = {
    player: playerName,
    party: partyNames,
    companions: companionNames.join(' and '),
    place: placeTitle,
    world: world.name
  }
  const resolvedPremise = renderSentenceTemplate(premise, openingVars)
  const triggerLabels = openingActionIds.map((id) => triggerActions.find((a) => a.id === id)?.name ?? id)

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-bg p-5">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        {/* TOP HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[18px] font-semibold tracking-tight text-ink">{world.name}</h1>
            <span className="border border-accent/45 bg-accent/10 px-2 py-0.5 font-label text-[10px] caps-12 text-accent">
              NEW ADVENTURE
            </span>
            <span className="border border-line-strong bg-card px-2 py-0.5 font-ui text-[10.5px] text-dim">
              SAVE: <InlineEdit value={saveName} onSave={setSaveName} className="text-ink" />
            </span>
            <span className="border border-secondary-ink/30 bg-secondary-ink/10 px-2 py-0.5 font-label text-[10px] caps-10 text-secondary-ink">
              + AUTO ALMANAC
            </span>
          </div>

          {latestSave && (
            <Button size="sm" variant="secondary" onClick={() => onContinueSave(latestSave.id)}>
              Continue {latestSave.name} ▸
            </Button>
          )}
        </div>

        {/* INLINE PARAMETER STRIP */}
        <div className="flex flex-col gap-2 border border-line tone-surface-60 px-3.5 py-2.5 font-ui">
          <div className="flex flex-wrap items-center gap-4">
            <span className="w-28 shrink-0 text-[10px] font-bold caps-12 text-accent">Start in world</span>

            <span className="inline-flex items-center gap-1.5 text-[10.5px] caps-8 text-faint">
              PLACE
              <Popover
                align="start"
                trigger={
                  <span className="inline-block border border-accent/45 bg-card px-2 py-0.5 text-[11.5px] normal-case tracking-normal text-ink hover:bg-accent/15">
                    {placeSummary}
                  </span>
                }
                className="max-h-64 w-72 overflow-y-auto p-1.5"
              >
                <button
                  type="button"
                  onClick={() => setStartingPlace(null)}
                  className={cn('block w-full px-2 py-1 text-left text-[11px]', !startingPlace ? 'bg-accent/15 text-accent' : 'text-dim hover:text-ink')}
                >
                  — None —
                </button>
                {Object.keys(places).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setStartingPlace(k)}
                    className={cn('block w-full px-2 py-1 text-left text-[11px]', startingPlace === k ? 'bg-accent/15 text-accent' : 'text-dim hover:text-ink')}
                  >
                    {placeBreadcrumb(k)}
                  </button>
                ))}
              </Popover>
            </span>

            <span className="inline-flex items-center gap-1.5 text-[10.5px] caps-8 text-faint">
              MAP
              <Select
                value={startingMap ?? ''}
                options={[{ value: '', label: 'auto' }, ...mapUses.map((u) => ({ value: u.map, label: u.map }))]}
                onChange={(v) => setStartingMap(v || null)}
                className="h-6 w-36 text-[11px]"
              />
            </span>

            <span className="inline-flex items-center gap-1.5 text-[10.5px] caps-8 text-faint">
              CLOCK
              <span className="inline-flex items-center gap-1 border border-accent/45 bg-card px-2 py-0.5 text-[11.5px] normal-case text-ink">
                <span>Day</span>
                <InlineNumber value={day} min={1} onSave={(v) => setClock(v, hour, minute)} />
                <span>·</span>
                <InlineNumber value={hour} min={0} max={23} onSave={(v) => setClock(day, v, minute)} />
                <span>:</span>
                <InlineNumber value={minute} min={0} max={59} onSave={(v) => setClock(day, hour, v)} />
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span className="w-28 shrink-0 text-[10px] font-bold caps-12 text-accent">SETTING &amp; HOOK</span>

            {launch.timePeriod || launch.setting ? (
              <span className="inline-flex items-center gap-1.5 text-[10.5px] caps-8 text-faint">
                ERA
                <span className="border border-line-strong bg-card px-2 py-0.5 text-[11px] normal-case text-dim">
                  {[launch.timePeriod, launch.setting].filter(Boolean).join(' · ')}
                </span>
              </span>
            ) : null}

            <span className="inline-flex items-center gap-1.5 text-[10.5px] caps-8 text-faint">
              OPENING TRIGGER
              <Popover
                align="start"
                trigger={
                  <span
                    className={cn(
                      'inline-block border px-2 py-0.5 text-[11px] normal-case',
                      triggerLabels.length ? 'border-tint-purple-ink/45 bg-tint-purple/10 text-tint-purple-ink' : 'border-line-strong bg-card text-dim'
                    )}
                  >
                    {triggerLabels.length ? triggerLabels.join(', ') : 'none'}
                  </span>
                }
                className="max-h-56 w-64 overflow-y-auto p-1.5"
              >
                {!triggerActions.length ? (
                  <div className="p-2 text-[11px] text-faint">No Trigger Actions defined yet.</div>
                ) : (
                  triggerActions.map((a) => {
                    const active = openingActionIds.includes(a.id)
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() =>
                          setOpeningActionIds((prev) => (prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]))
                        }
                        className={cn(
                          'flex w-full items-center justify-between px-2 py-1 text-left text-[11px]',
                          active ? 'bg-accent/15 text-accent' : 'text-dim hover:text-ink'
                        )}
                      >
                        <span className="truncate">{a.name}</span>
                        {active && <span>✓</span>}
                      </button>
                    )
                  })
                )}
              </Popover>
            </span>
          </div>
        </div>

        {/* TWO-COLUMN SPLIT */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.45fr_0.95fr]">
          {/* LEFT: QUICK START & LOADOUT */}
          <div className="flex flex-col gap-2.5">
            <div className="inline-flex w-fit items-center gap-2 border border-accent/45 bg-accent/10 px-2.5 py-1 font-label text-[10.5px] font-bold caps-12 text-accent">
              <span className="h-1.5 w-1.5 bg-accent" />
              QUICK START &amp; LOADOUT
            </div>

            <div className="flex flex-col gap-3 border border-line tone-surface-60 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-label text-[10px] caps-12 text-faint">YOUR CHARACTER &amp; STARTING PARTY</span>
                <div className="flex items-center gap-2">
                  {sheets.length > 0 ? (
                    <SheetSelect value={playerId} onChange={(id) => setPlayerId(id)} className="h-7 w-44 text-[11px]" />
                  ) : (
                    <Button size="sm" variant="primary" icon={<Plus className="h-3 w-3" />} onClick={() => void handleQuickCreatePlayer()}>
                      Quick Create Sheet
                    </Button>
                  )}
                  {availableCompanions.length > 0 && (
                    <Popover
                      align="end"
                      trigger={
                        <span className="inline-flex items-center gap-1 border border-dashed border-line-strong px-2 py-1 font-ui text-[10.5px] text-dim hover:border-accent/50 hover:text-accent">
                          <UserPlus className="h-3 w-3" /> Add Party Member
                        </span>
                      }
                      className="max-h-56 w-56 overflow-y-auto p-1.5"
                    >
                      {availableCompanions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setCompanions((prev) => [...prev, s.id])}
                          className="block w-full px-2 py-1 text-left font-ui text-[11px] text-dim hover:bg-card hover:text-ink"
                        >
                          + {s.title}
                        </button>
                      ))}
                    </Popover>
                  )}
                </div>
              </div>

              {playerId && renderMemberCard(playerId, true)}
              {companions.map((id) => renderMemberCard(id, false))}

              {/* STORY OPENING */}
              <div className="mt-1 flex items-center justify-between">
                <span className="font-label text-[10px] caps-12 text-faint">STORY OPENING (SESSION 1)</span>
                <button
                  type="button"
                  onClick={() => setEditingOpening((v) => !v)}
                  className="border border-line-strong bg-card px-2 py-0.5 font-ui text-[10px] text-dim hover:text-ink"
                >
                  {editingOpening ? 'Done' : 'Edit'}
                </button>
              </div>
              <div className="border border-line tone-card-80 p-3">
                {editingOpening ? (
                  <div className="flex flex-col gap-2">
                    <LinkTextarea rolls={false}
                      value={premise}
                      onValue={(v) => setPremise(v)}
                      rows={3}
                      placeholder="What is happening the moment Session 1 begins? Use {player}, {party}, [with {companions}], {place}, {world}…"
                    />
                    <div className="flex flex-wrap items-center gap-1 font-ui text-[10px]">
                      <span className="text-faint caps">Variables:</span>
                      {(['{player}', '{party}', '{companions}', '{place}', '{world}'] as const).map((tok) => (
                        <button
                          key={tok}
                          type="button"
                          onClick={() => setPremise((p) => (p ? `${p} ${tok}` : tok))}
                          className="border border-line-strong tone-well-50 px-1.5 py-0.5 text-secondary-ink hover:border-secondary-ink cursor-pointer"
                        >
                          {tok}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[12.5px] leading-relaxed text-ink/85">
                    {resolvedPremise || 'No opening hook written yet. Click Edit to write one, or start directly.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: IN WORDS */}
          <aside className="flex flex-col gap-3.5 border border-line tone-surface-60 p-4 h-fit">
            <div className="flex items-center gap-1.5 font-label text-[10.5px] font-bold caps-14 text-accent">
              <Sparkles className="h-3.5 w-3.5" /> IN WORDS
            </div>

            <div className="flex flex-col gap-2 text-[12.5px] leading-relaxed text-ink/80">
              <div>
                Start as <strong className="text-ink">{partyNames}</strong>
                {startingPlace ? (
                  <>
                    {' '}
                    at <span className="font-ui text-[11.5px] text-secondary-ink">{placeSummary}</span>
                  </>
                ) : null}
                {startingMap ? (
                  <>
                    {' '}
                    on <strong className="text-ink">{startingMap}</strong>
                  </>
                ) : null}
                .
              </div>
              <div>
                Clock begins at <span className="font-ui text-[11.5px] text-accent">{formatAlmanacClock(startingTime)}</span> (<strong>Session 1</strong>).
              </div>
              <div>
                {triggerLabels.length ? (
                  <>
                    Opening trigger <span className="font-ui text-[11.5px] text-tint-purple-ink">{triggerLabels.join(', ')}</span> is queued on start.
                  </>
                ) : (
                  'No opening trigger fires.'
                )}
              </div>
            </div>

            {startingPlace && (
              <div className="border-l-2 border-secondary-ink bg-secondary-ink/[0.04] px-3 py-2 text-[11.5px] leading-relaxed text-dim">
                <div className="font-label text-[10px] font-bold caps-8 text-secondary-ink">Room-Scoped Sight (Anti-Clairvoyancy)</div>
                Starting in <span className="font-ui text-secondary-ink">@world:{world.id}/place/{startingPlace}</span> scopes agent perception to this exact room. Agents will only learn who is in adjacent or parent rooms when you step out or inspect them.
              </div>
            )}

            <div className="h-px bg-line" />

            <div className="flex flex-col gap-1.5">
              <span className="font-label text-[10px] caps-12 text-faint">Model</span>
              <ModelReadyControl />
            </div>

            <div className="h-px bg-line" />

            <Button
              size="md"
              variant="primary"
              disabled={!playerId || starting}
              icon={<Play className="h-3.5 w-3.5 fill-current" />}
              onClick={() => void handleBegin()}
              className="w-full justify-center"
            >
              {starting ? 'STARTING...' : 'BEGIN ADVENTURE'}
            </Button>
            <div className="text-center font-ui text-[10.5px] text-faint">
              Creates <strong className="text-ink">{saveName || `Save ${saveCount + 1}`}</strong> + its dedicated <strong className="text-secondary-ink">Almanac</strong>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
