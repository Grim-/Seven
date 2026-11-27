import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Activity, Aperture, Eye, ImagePlus, Plus, UserRound } from 'lucide-react'
import type { CharacterSheet } from '@shared/types'
import { showName } from '@shared/ids'
import { actorEntry, splitNpcRef } from '@shared/worldNpcs'
import { Button, InlineTitle, SaveState, Segmented, Select, moved, useReorder, useAutosavedState } from '../../ui'
import { engine, on } from '../../../lib/ipc'
import { toast } from '../../../store/toasts'
import { useAgents } from '../../../store/agents'
import { Markdown } from '../../chat/Markdown'
import { AssetMedia } from '../../pictures/AssetMedia'
import { generateImage } from '../../pictures/GenerateImageModal'
import { InsideSlateContext } from '../../entries/EntryCard'
import { pickPicture } from '../PicturePicker'
import { rollAll } from '../useRolls'
import { AddFieldBar } from './AddFieldBar'
import { FieldCard } from './FieldCard'
import { SheetHeader } from './SheetHeader'
import { failed } from '../../../lib/notify'
import { cn } from '../../../lib/cn'
import { sheetImageContext, useRegisterImageContext } from '../../../lib/imagePromptContext'
import { sheetFacets, type SheetDraft, type SheetFacet } from './facets'
import { StoryTab } from './story/StoryTab'
import { useModuleList } from '../../../registries/useModuleList'
import { useOpenedAt } from '../../../lib/library'

type Draft = SheetDraft
const CORE = 'sheet'

export function SheetEditor({ start, compact: compactProp, only, campaign = null }: { start: CharacterSheet; compact?: boolean; only?: string[]; campaign?: string | null }) {
  const insideSlate = useContext(InsideSlateContext)
  const compact = compactProp ?? insideSlate
  const [liveSheet, setLiveSheet] = useState<CharacterSheet>(start)
  const saver = useAutosavedState<Draft>(
    {
      title: start.title,
      fields: start.fields,
      values: start.values,
      dnd: start.dnd,
      story: start.story,
      mind: start.mind ?? null,
      relationships: start.relationships ?? []
    },
    (d) =>
      engine('sheets.save', {
        id: start.id,
        title: d.title,
        fields: d.fields.filter((x) => x.trim()),
        values: d.values,
        dnd: d.dnd,
        story: d.story,
        mind: d.mind ?? null,
        relationships: d.relationships ?? []
      })
  )
  const sheet = saver.value
  const latestDraftRef = useRef(sheet)
  latestDraftRef.current = sheet
  const latestLiveRef = useRef(liveSheet)
  latestLiveRef.current = liveSheet
  const statusRef = useRef(saver.status)
  statusRef.current = saver.status

  const facets = useModuleList(sheetFacets)
  const [picked, setTab] = useState<string | null>(null)
  useOpenedAt('sheet', start.id, setTab)
  const [opened, setOpened] = useState<string[]>([])
  const [image, setImage] = useState(start.image)
  const [adding, setAdding] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [changedFields, setChangedFields] = useState<string[]>([])
  const [changedTabs, setChangedTabs] = useState<string[]>([])
  const agents = useAgents((s) => s.list)
  const wornBy = useMemo(() => agents.filter((a) => a.sheet === start.id).map((a) => a.name), [agents, start.id])
  const sheetContext = useMemo(
    () => sheetImageContext({ ...liveSheet, ...sheet, title: showName(sheet.title) }),
    [liveSheet, sheet]
  )
  useRegisterImageContext(sheetContext)

  // Live reactive sync when an agent tool call or external action edits this character sheet
  useEffect(() => {
    let highlightTimer: ReturnType<typeof setTimeout> | null = null
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let alive = true

    const syncFromBackend = () => {
      if (statusRef.current === 'saving') return
      void engine('sheets.get', { id: start.id })
        .then((fresh) => {
          if (!alive || !fresh || statusRef.current === 'saving') return
          const prev = latestDraftRef.current
          const prevLive = latestLiveRef.current

          const diffFields: string[] = []
          const allKeys = new Set([...prev.fields, ...fresh.fields, ...Object.keys(prev.values), ...Object.keys(fresh.values)])
          for (const k of allKeys) {
            if ((prev.values[k] ?? '') !== (fresh.values[k] ?? '') || prev.fields.includes(k) !== fresh.fields.includes(k)) {
              diffFields.push(k)
            }
          }

          const diffTabs: string[] = []
          if (diffFields.length > 0 || prev.title !== fresh.title || JSON.stringify(prev.story ?? null) !== JSON.stringify(fresh.story ?? null)) diffTabs.push(CORE)
          if (JSON.stringify(prev.dnd ?? null) !== JSON.stringify(fresh.dnd ?? null)) diffTabs.push('dnd')
          if (JSON.stringify(prevLive.game ?? null) !== JSON.stringify(fresh.game ?? null)) diffTabs.push('game')
          if (JSON.stringify(prev.mind ?? null) !== JSON.stringify(fresh.mind ?? null)) diffTabs.push('mind')
          if (JSON.stringify(prev.relationships ?? []) !== JSON.stringify(fresh.relationships ?? [])) diffTabs.push('relations')
          const imageChanged = prevLive.image !== fresh.image

          if (diffTabs.length === 0 && !imageChanged) return

          setLiveSheet(fresh)
          setImage(fresh.image)
          saver.reset({
            title: fresh.title,
            fields: fresh.fields,
            values: fresh.values,
            dnd: fresh.dnd,
            story: fresh.story,
            mind: fresh.mind ?? null,
            relationships: fresh.relationships ?? []
          })

          if (diffFields.length > 0 || diffTabs.length > 0) {
            setChangedFields(diffFields)
            setChangedTabs(diffTabs)
            if (highlightTimer) clearTimeout(highlightTimer)
            highlightTimer = setTimeout(() => {
              if (!alive) return
              setChangedFields([])
              setChangedTabs([])
            }, 2800)
          }
        })
        .catch(() => undefined)
    }

    const scheduleSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(syncFromBackend, 90)
    }

    const offs = [
      on('page.changed', ({ id: changedId }) => {
        if (
          changedId === start.id ||
          changedId === `sheet/${start.id}` ||
          changedId === `sheets/${start.id}` ||
          changedId.endsWith(`/${start.id}`)
        ) {
          scheduleSync()
        }
      }),
      on('npcs.changed', scheduleSync),
      on('saves.changed', scheduleSync),
      on('dnd.changed', scheduleSync),
      on('game.changed', scheduleSync),
      on('stories.changed', scheduleSync)
    ]

    return () => {
      alive = false
      if (highlightTimer) clearTimeout(highlightTimer)
      if (debounceTimer) clearTimeout(debounceTimer)
      offs.forEach((off) => off())
    }
  }, [start.id])

  const change = (next: Draft) => saver.set(next)
  const reorder = useReorder((from, to) => change({ ...sheet, fields: moved(sheet.fields, from, to) }))

  const setValue = (field: string, text: string) => change({ ...sheet, values: { ...sheet.values, [field]: text } })
  const rename = (from: string, to: string) => {
    if (!to || to === from) return
    if (sheet.fields.includes(to)) return toast.error('There is already a field called that', to)
    const values = { ...sheet.values, [to]: sheet.values[from] ?? '' }
    delete values[from]
    change({ ...sheet, fields: sheet.fields.map((x) => (x === from ? to : x)), values })
  }
  const add = (name: string) => {
    if (!sheet.fields.includes(name)) change({ ...sheet, fields: [...sheet.fields, name] })
  }
  const finish = (field: string) => {
    const text = sheet.values[field] ?? ''
    if (/#random/i.test(text)) void rollAll(text).then((rolled) => rolled !== text && setValue(field, rolled))
  }
  const kept = Object.keys(sheet.values).filter((k) => !sheet.fields.includes(k) && sheet.values[k]?.trim())
  const setPicture = (id: string | null) => {
    setImage(id)
    void engine('sheets.setImage', { id: start.id, image: id }).catch(failed('Could not set the portrait'))
  }
  const togglePreview = () => {
    if (preview !== null) return setPreview(null)
    const entry = actorEntry(start.id)
    void saver.flush().then(() =>
      engine('library.read', { entry: `${entry.kind}/${entry.id}` })
        .then(setPreview)
        .catch(failed('Could not build it'))
    )
  }

  const profileCards = (
    <section className="flex flex-col gap-2.5 border border-line/45 tone-panel-40 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/35 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-label text-[11px] font-bold caps-16 text-accent">
            Character Profile &amp; Persona
          </span>
          <span className="border border-ok/40 bg-ok/10 px-1.5 py-0.5 font-label text-[9.5px] caps text-ok">
            Always in prompt
          </span>
        </div>
        <span className="font-ui text-[11px] text-dim">{sheet.fields.length} cards · #random supported</span>
      </div>
      {adding && <AddFieldBar fields={sheet.fields} kept={kept} onAdd={add} onClose={() => setAdding(false)} />}
      <div
        className={cn(
          'grid gap-2.5',
          compact
            ? 'grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]'
            : 'grid-cols-[repeat(auto-fill,minmax(22rem,1fr))]'
        )}
      >
        {sheet.fields.map((field, i) => (
          <FieldCard
            key={field}
            name={field}
            value={sheet.values[field] ?? ''}
            highlighted={changedFields.includes(field)}
            drag={reorder.props(i)}
            dragOver={reorder.isOver(i)}
            onValue={(t) => setValue(field, t)}
            onRename={(to) => rename(field, to.trim())}
            onRemove={() => change({ ...sheet, fields: sheet.fields.filter((x) => x !== field) })}
            onDone={() => finish(field)}
          />
        ))}
        <button
          onClick={() => setAdding(true)}
          className="flex min-h-20 items-center justify-center gap-2 border border-dashed border-line/50 font-label text-[11px] caps-14 text-faint hover:border-accent hover:text-accent cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Add field
        </button>
      </div>
      {kept.length > 0 && !adding && (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-dim">
          Off the sheet, text kept:
          {kept.map((h) => (
            <button
              key={h}
              onClick={() => add(h)}
              className="border border-secondary/50 px-2 py-0.5 font-ui text-[11px] text-secondary hover:border-secondary hover:text-ink cursor-pointer"
            >
              ↩ {h}
            </button>
          ))}
        </div>
      )}
    </section>
  )

  const sheetTab = (
    <StoryTab
      sheet={liveSheet}
      story={sheet.story}
      mind={sheet.mind}
      profile={profileCards}
      compact={compact}
      campaign={campaign}
      onChange={(story) => change({ ...sheet, story })}
      onOpenFacet={setTab}
    />
  )
  const shows = (f: SheetFacet) => !f.has || f.has(liveSheet, sheet) || opened.includes(f.id)
  const shown = (facets ?? []).filter(shows)
  const addable = (facets ?? []).filter((f) => f.system && !shows(f))
  const addSystem = (id: string) => {
    const facet = addable.find((f) => f.id === id)
    if (!facet) return
    if (facet.attach) change(facet.attach(sheet))
    setOpened((list) => [...list, id])
    setTab(id)
  }
  const tabs: { value: string; label: string; body: ReactNode }[] = [
    { value: CORE, label: 'Sheet', body: sheetTab },
    ...shown.map((f) => ({
      value: f.id,
      label: f.label(sheet),
      body: <f.Tab sheet={liveSheet} draft={sheet} change={change} open={setTab} campaign={campaign} />
    }))
  ]
  const systems = shown.filter((f) => f.system).map((f) => f.label(sheet))
  const wanted = picked ?? facets?.find((f) => f.opensFirst?.(sheet))?.id ?? CORE
  const tab = tabs.some((t) => t.value === wanted) ? wanted : CORE

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col',
        compact ? 'gap-2.5' : 'overflow-y-auto border border-line/60 tone-panel-70'
      )}
    >
      {compact ? (
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line/40 pb-3">
          <button
            type="button"
            title={image ? 'Change portrait' : 'Add a portrait'}
            onClick={() => void pickPicture(image, { what: 'a character portrait', context: sheetContext }).then((r) => r && setPicture(r.id))}
            className="group/portrait relative h-16 w-16 shrink-0 overflow-hidden border border-line-strong tone-well-60 cursor-pointer"
          >
            {image ? (
              <AssetMedia id={image} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-faint group-hover/portrait:text-accent">
                <UserRound className="h-6 w-6" />
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center tone-panel-75 py-0.5 font-label text-[8.5px] caps-5 text-accent opacity-0 group-hover/portrait:opacity-100">
              <ImagePlus className="h-2.5 w-2.5" />
            </span>
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-label text-[9.5px] caps-20 text-accent-soft">{splitNpcRef(start.id) ? 'World NPC' : 'Character'}</span>
              {changedTabs.length > 0 && (
                <span className="flex items-center gap-1 border border-accent bg-accent/20 px-1.5 py-px font-label text-[8.5px] font-bold caps-14 text-accent animate-pulse">
                  <Activity className="h-2.5 w-2.5" />
                  LIVE EDIT
                </span>
              )}
              <SaveState status={saver.status} error={saver.error} />
            </div>
            <InlineTitle
              value={showName(sheet.title)}
              onSave={(title) => change({ ...sheet, title })}
              className="text-[19px] font-bold leading-tight tracking-wide text-ink"
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-ui text-[10px] text-dim">
              <span>{sheet.fields.length} fields</span>
              {wornBy.length > 0 && <span>Worn by {wornBy.join(', ')}</span>}
              {systems.length > 0 && <span className="text-secondary">{systems.join(' + ')}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              icon={<Aperture />}
              onClick={() =>
                void generateImage({
                  title: `Portrait for ${showName(sheet.title)}`,
                  sourceAssetId: image ?? undefined,
                  context: sheetContext
                }).then((r) => r && setPicture(r.id))
              }
              title="Generate character portrait using sheet fields"
            >
              Portrait
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Plus />}
              onClick={() => {
                setTab('sheet')
                setAdding(true)
              }}
            >
              Field
            </Button>
            <Button size="sm" variant="ghost" icon={<Eye />} onClick={togglePreview} title="View as an agent reads it">
              {preview !== null ? 'Sheet' : 'Read'}
            </Button>
          </div>
        </div>
      ) : (
        <SheetHeader
          id={start.id}
          title={showName(sheet.title)}
          image={image}
          fields={sheet.fields.length}
          wornBy={wornBy}
          status={saver.status}
          error={saver.error}
          previewing={preview !== null}
          onRename={(title) => change({ ...sheet, title })}
          onPortrait={() => void pickPicture(image, { what: 'a character portrait', context: sheetContext }).then((r) => r && setPicture(r.id))}
          onClearPortrait={() => setPicture(null)}
          onGeneratePortrait={() =>
            void generateImage({
              title: `Portrait for ${showName(sheet.title)}`,
              sourceAssetId: image ?? undefined,
              context: sheetContext
            }).then((r) => r && setPicture(r.id))
          }
          onAddField={() => {
            setTab('sheet')
            setAdding(true)
          }}
          onPreview={togglePreview}
        />
      )}

      {preview === null && !only && (
        <div className={cn('flex flex-wrap items-center gap-2.5', !compact && 'px-4 pt-3')}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={tabs.map(({ value, label }) => ({
              value,
              label: changedTabs.includes(value) ? `${label} ●` : label
            }))}
          />
          {!compact && (
            <span className="font-label text-[10px] caps-12 text-faint">
              System: {systems.length ? systems.join(' + ') : 'narrative'}
            </span>
          )}
          {addable.length > 0 && (
            <Select
              value=""
              options={[{ value: '', label: '+ Add system' }, ...addable.map((f) => ({ value: f.id, label: f.label(sheet) }))]}
              onChange={addSystem}
              className="h-7 w-36 text-[11px]"
            />
          )}
        </div>
      )}

      {preview !== null ? (
        <div className={cn('text-[13px]', compact ? 'py-2' : 'p-5')}>
          <Markdown text={preview} />
        </div>
      ) : only ? (
        only.flatMap((id) => tabs.filter((t) => t.value === id).map((t) => <div key={t.value}>{t.body}</div>))
      ) : (
        tabs.find((t) => t.value === tab)?.body
      )}
    </div>
  )
}
