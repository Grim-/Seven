import { useEffect, useMemo, useState } from 'react'
import { Activity, Minus, Plus, SlidersHorizontal } from 'lucide-react'
import { showName } from '@shared/ids'
import type { CharacterSheet, WidgetSource } from '@shared/types'
import { Buffs, Stats, resourcesOf } from '@shared/game/components'
import { GameEntity, type Catalog, type EntityRecord } from '@shared/game/core'
import { BUFF_TEMPLATES } from '@shared/game/defs'
import { engine, on } from '../../lib/ipc'
import { onLibraryChange } from '../../lib/library'
import { failed } from '../../lib/notify'
import { noteFailure } from '../../store/problems'
import { cn } from '../../lib/cn'
import { GameBar } from '../../game/ui/GameBar'
import { useGameCatalog } from '../game/useGameCatalog'
import { useGameDefs } from '../game/useGameDefs'
import { ResourceBars } from '../game/ResourceBars'
import { CharacterAvatar } from '../chat/CharacterAvatar'
import { EmptyState, Field, Select, Toggle } from '../ui'
import { MissingWidget, registerWidgetUi, type WidgetBodyProps, type WidgetEditorProps } from '../../registries/widgets'

function useLiveSheet(id: string): { sheet: CharacterSheet | null; loading: boolean } {
  const [sheet, setSheet] = useState<CharacterSheet | null>(null)
  const [loading, setLoading] = useState(Boolean(id))
  useEffect(() => {
    if (!id) {
      setSheet(null)
      setLoading(false)
      return
    }
    let live = true
    const load = () =>
      void engine('sheets.get', { id })
        .then((s) => {
          if (!live) return
          setSheet(s)
          setLoading(false)
        })
        .catch((err) => {
          noteFailure('dashboards', 'Could not load character sheet')(err)
          if (!live) return
          setSheet(null)
          setLoading(false)
        })
    load()
    const offLib = onLibraryChange(load)
    const offPage = on('page.changed', (e) => {
      if (e.id === id) load()
    })
    return () => {
      live = false
      offLib()
      offPage()
    }
  }, [id])
  return { sheet, loading }
}

function useLiveRecord(sheet: CharacterSheet | null): EntityRecord | null {
  const [saveRecord, setSaveRecord] = useState<EntityRecord | null>(null)
  useEffect(() => {
    const saveId = sheet?.save
    const sheetId = sheet?.id
    if (!saveId || !sheetId) {
      setSaveRecord(null)
      return
    }
    let live = true
    const load = () =>
      void engine('saves.get', { id: saveId })
        .then((save) => {
          if (!live) return
          setSaveRecord(save.characters[sheetId]?.game ?? null)
        })
        .catch(noteFailure('dashboards', 'Could not load live save state', () => live && setSaveRecord(null)))
    load()
    const off = on('saves.changed', load)
    return () => {
      live = false
      off()
    }
  }, [sheet?.id, sheet?.save])
  return (sheet?.save ? saveRecord : null) ?? sheet?.game ?? null
}

function StatList({
  entity,
  catalog,
  filterIds,
  editable,
  onSetBase
}: {
  entity: GameEntity
  catalog: Catalog
  filterIds: string[]
  editable: boolean
  onSetBase: (statId: string, value: number) => void
}) {
  const stats = entity.comp(Stats)
  if (!stats) {
    return <div className="font-ui text-[11px] text-faint">This character has no Stats component yet.</div>
  }
  const allDefs = catalog.stats()
  const chosen = filterIds.length
    ? filterIds.map((id) => catalog.stat(id)).filter((d): d is NonNullable<typeof d> => Boolean(d))
    : allDefs

  if (!chosen.length) {
    return <div className="font-ui text-[11px] text-faint">No matching stats defined in the game catalog.</div>
  }

  return (
    <div className="flex flex-col gap-1.5">
      {chosen.map((def) => {
        const base = stats.baseValue(def.id)
        const now = stats.value(def.id)
        const roundedNow = Math.round(now * 100) / 100
        const roundedBase = Math.round(base * 100) / 100
        const delta = roundedNow - roundedBase
        const span = def.max - def.min
        const showBar = span > 0 && span <= 1000
        const step = span > 0 && span <= 2 ? 0.1 : 1
        const clamp = (n: number) => Math.round(Math.min(def.max, Math.max(def.min, n)) * 100) / 100

        return (
          <div key={def.id} className="flex flex-col gap-1 border border-line/35 tone-panel-45 px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-label text-[11px] font-semibold caps-12 text-ink/90" title={`${def.label} (${def.domain})`}>
                {def.label}
              </span>
              {delta !== 0 && (
                <span
                  className={cn('font-ui text-[10.5px]', delta > 0 ? 'text-secondary' : 'text-alert')}
                  title={`Base ${roundedBase} modified to ${roundedNow}`}
                >
                  {roundedBase} → {roundedNow}
                </span>
              )}
              {editable ? (
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    title={`Decrease ${def.label}`}
                    onClick={() => onSetBase(def.id, clamp(base - step))}
                    className="flex h-5 w-5 items-center justify-center border border-line/50 text-dim hover:border-accent hover:text-accent"
                  >
                    <Minus className="h-2.5 w-2.5" />
                  </button>
                  <span className="min-w-8 text-center font-data text-[12px] font-bold tabular-nums text-accent">
                    {roundedNow}
                  </span>
                  <button
                    type="button"
                    title={`Increase ${def.label}`}
                    onClick={() => onSetBase(def.id, clamp(base + step))}
                    className="flex h-5 w-5 items-center justify-center border border-line/50 text-dim hover:border-accent hover:text-accent"
                  >
                    <Plus className="h-2.5 w-2.5" />
                  </button>
                </div>
              ) : (
                <span className="font-data text-[12.5px] font-bold tabular-nums text-accent">{roundedNow}</span>
              )}
            </div>
            {showBar && (
              <GameBar value={Math.max(0, roundedNow - def.min)} max={span} colour={def.colour} size="xs" />
            )}
          </div>
        )
      })}
    </div>
  )
}

function CharacterStatsBody({ widget, compact }: WidgetBodyProps) {
  const sheetId = typeof widget.source.sheet === 'string' ? widget.source.sheet : ''
  const filterIds = Array.isArray(widget.source.stats) ? widget.source.stats.map(String).filter(Boolean) : []
  const showResources = widget.source.showResources !== false
  const showBuffs = widget.source.showBuffs !== false
  const canEditSource = widget.source.editable !== false

  const catalog = useGameCatalog()
  const buffDefs = useGameDefs(BUFF_TEMPLATES).list ?? []
  const { sheet, loading } = useLiveSheet(sheetId)
  const record = useLiveRecord(sheet)
  const entity = useMemo(() => (record && catalog ? GameEntity.fromRecord(record, catalog) : null), [record, catalog])

  if (!sheetId) {
    return <EmptyState title="Pick a character">Choose a character sheet in this widget's settings.</EmptyState>
  }
  if (loading || !catalog) {
    return <div className="font-ui text-[11px] text-dim">Loading stats…</div>
  }
  if (!sheet) return <MissingWidget what="character" />
  if (!entity) {
    return (
      <EmptyState title="Not in the game">
        Open {showName(sheet.title)}'s Game tab and join a character template to track stats here.
      </EmptyState>
    )
  }

  const resources = showResources ? resourcesOf(entity) : []
  const buffs = showBuffs ? (entity.comp(Buffs)?.held ?? []) : []
  const editable = canEditSource && !sheet.save

  const setBase = (statId: string, value: number) => {
    const stats = entity.comp(Stats)
    if (!stats) return
    stats.setBase(statId, value)
    void engine('game.saveCharacter', { sheet: sheet.id, record: entity.toRecord() }).catch(failed('Could not update stat'))
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line/40 pb-1.5">
        <CharacterAvatar sheetId={sheet.id} size={compact ? 24 : 30} openOnClick />
        <div className="min-w-0 flex-1">
          <div className="truncate font-label text-[11.5px] font-bold caps-14 text-ink">
            {showName(sheet.title)}
          </div>
          {sheet.save && <div className="font-label text-[9.5px] caps-5 text-tint-purple">In live save</div>}
        </div>
        {filterIds.length > 0 && (
          <span className="border border-line/50 px-1.5 py-0.5 font-ui text-[9.5px] text-dim">
            {filterIds.length} pinned
          </span>
        )}
      </div>

      {resources.length > 0 && <ResourceBars resources={resources} compact={compact} />}

      {buffs.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {buffs.map((b) => {
            const label = buffDefs.find((d) => d.id === b.id)?.name ?? b.id
            return (
              <span key={b.uid} className="border border-secondary-ink/40 bg-secondary-ink/10 px-1.5 py-0.5 font-ui text-[9.5px] text-secondary-ink">
                {label}
                {b.stacks > 1 ? ` ×${b.stacks}` : ''}
              </span>
            )
          })}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        <StatList entity={entity} catalog={catalog} filterIds={filterIds} editable={editable} onSetBase={setBase} />
      </div>
    </div>
  )
}

function CharacterStatsEditor({ source, onChange }: WidgetEditorProps) {
  const [sheets, setSheets] = useState<CharacterSheet[]>([])
  const catalog = useGameCatalog()
  useEffect(() => {
    const load = () => void engine('sheets.list').then(setSheets).catch(failed('Could not load character sheets'))
    load()
    return onLibraryChange(load)
  }, [])

  const sheetId = typeof source.sheet === 'string' ? source.sheet : ''
  const selectedStats = Array.isArray(source.stats) ? source.stats.map(String).filter(Boolean) : []
  const allStats = catalog?.stats() ?? []

  const toggleStat = (id: string) => {
    const next = selectedStats.includes(id) ? selectedStats.filter((x) => x !== id) : [...selectedStats, id]
    onChange({ ...source, stats: next })
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Character">
        <Select
          value={sheetId}
          options={[{ value: '', label: 'Select a character…' }, ...sheets.map((s) => ({ value: s.id, label: showName(s.title) }))]}
          onChange={(sheet) => onChange({ ...source, sheet })}
        />
      </Field>

      <Field
        label="Tracked stats"
        hint={selectedStats.length ? 'Only pinned stats are shown. Leave all unchecked to show every stat.' : 'Showing all stats (built-in and custom). Click any pill to pin a subset.'}
      >
        <div className="flex flex-wrap gap-1.5">
          {allStats.map((def) => {
            const on = selectedStats.includes(def.id)
            return (
              <button
                key={def.id}
                type="button"
                onClick={() => toggleStat(def.id)}
                className={cn(
                  'border px-2 py-0.5 font-label text-[10.5px] caps-5 transition-colors',
                  on ? 'border-accent bg-accent/20 text-accent' : 'border-line/50 text-dim hover:border-line hover:text-ink'
                )}
              >
                {def.label}
              </button>
            )
          })}
          {selectedStats.length > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...source, stats: [] })}
              className="border border-line/40 px-2 py-0.5 font-ui text-[10.5px] text-faint hover:text-ink"
            >
              Show all
            </button>
          )}
        </div>
      </Field>

      <div className="flex flex-wrap gap-4 pt-1">
        <Toggle checked={source.showResources !== false} onChange={(showResources) => onChange({ ...source, showResources })} label="Resources" />
        <Toggle checked={source.showBuffs !== false} onChange={(showBuffs) => onChange({ ...source, showBuffs })} label="Buffs" />
        <Toggle checked={source.editable !== false} onChange={(editable) => onChange({ ...source, editable })} label="Quick adjust" />
      </div>
    </div>
  )
}

registerWidgetUi('character_stats', {
  Body: CharacterStatsBody,
  Editor: CharacterStatsEditor,
  blank: (info) => ({
    kind: 'character_stats',
    sheet: info.choices?.[0]?.id ?? '',
    showResources: true,
    showBuffs: true,
    editable: true
  }),
  createIcon: <SlidersHorizontal className="h-3.5 w-3.5 text-dim" />,
  choices: {
    heading: 'Character stats',
    meta: 'stats',
    icon: <Activity className="h-3.5 w-3.5 text-dim" />,
    source: (id): WidgetSource => ({
      kind: 'character_stats',
      sheet: id,
      showResources: true,
      showBuffs: true,
      editable: true
    })
  },
  entry: (source) => (typeof source.sheet === 'string' && source.sheet ? `sheet/${source.sheet}` : null)
})
