import { useMemo, useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import type { CharacterSheet } from '@shared/types'
import { showName } from '@shared/ids'
import { Segmented, moved, useReorder, useAutosavedState } from '../../ui'
import { DndTab } from './dnd/DndTab'
import { StoryTab } from './story/StoryTab'
import { engine } from '../../../lib/ipc'
import { toast } from '../../../store/toasts'
import { useAgents } from '../../../store/agents'
import { Markdown } from '../../chat/Markdown'
import { pickPicture } from '../PicturePicker'
import { rollAll } from '../useRolls'
import { AddFieldBar } from './AddFieldBar'
import { FieldCard } from './FieldCard'
import { SheetHeader } from './SheetHeader'
import { failed } from '../../../lib/notify'
import { CharacterCards } from '../../cards/CharacterCards'
import { withPersona } from '@shared/dnd'
import { CharacterGameTab } from '../../game/character/CharacterGameTab'

type Draft = Pick<CharacterSheet, 'title' | 'fields' | 'values' | 'dnd' | 'story'>
type Tab = 'sheet' | 'dnd' | 'story' | 'cards' | 'game'

export function SheetEditor({ start }: { start: CharacterSheet }) {
  const saver = useAutosavedState<Draft>({ title: start.title, fields: start.fields, values: start.values, dnd: start.dnd, story: start.story }, (d) => engine('sheets.save', { id: start.id, title: d.title, fields: d.fields.filter((x) => x.trim()), values: d.values, dnd: d.dnd, story: d.story }))
  const sheet = saver.value
  const [tab, setTab] = useState<Tab>(start.dnd && !start.fields.some((f) => start.values[f]?.trim()) ? 'dnd' : 'sheet')
  const [image, setImage] = useState(start.image)
  const [adding, setAdding] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const agents = useAgents((s) => s.list)
  const wornBy = useMemo(() => agents.filter((a) => a.sheet === start.id).map((a) => a.name), [agents, start.id])
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
    void engine('data.pages.image', { id: start.id, image: id }).catch(failed('Could not set the portrait'))
  }
  const togglePreview = () => {
    if (preview !== null) return setPreview(null)
    void saver.flush().then(() =>
      engine('library.read', { entry: `sheet/${start.id}` })
        .then(setPreview)
        .catch(failed('Could not build it'))
    )
  }

  const sheetTab = (
    <>
      {adding && <AddFieldBar fields={sheet.fields} kept={kept} onAdd={add} onClose={() => setAdding(false)} />}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(28rem,1fr))] gap-3 p-4">
        {sheet.fields.map((field, i) => (
          <FieldCard
            key={field}
            name={field}
            value={sheet.values[field] ?? ''}
            drag={reorder.props(i)}
            dragOver={reorder.isOver(i)}
            onValue={(t) => setValue(field, t)}
            onRename={(to) => rename(field, to.trim())}
            onRemove={() => change({ ...sheet, fields: sheet.fields.filter((x) => x !== field) })}
            onDone={() => finish(field)}
          />
        ))}
        <button onClick={() => setAdding(true)} className="flex min-h-24 items-center justify-center gap-2 border border-dashed border-line/50 font-mono text-[11px] uppercase tracking-[0.14em] text-faint hover:border-accent hover:text-accent">
          <Plus className="h-4 w-4" /> Add field
        </button>
      </div>
      {kept.length > 0 && !adding && (
        <div className="flex flex-wrap items-center gap-2 px-5 pb-4 text-[12px] text-dim">
          Off the sheet, text kept:
          {kept.map((h) => (
            <button key={h} onClick={() => add(h)} className="border border-teal/50 px-2 py-0.5 font-mono text-[11px] text-teal hover:border-teal hover:text-white">
              ↩ {h}
            </button>
          ))}
        </div>
      )}
    </>
  )
  const tabs: { value: Tab; label: string; body: ReactNode }[] = [
    { value: 'sheet', label: 'Sheet', body: sheetTab },
    { value: 'dnd', label: sheet.dnd ? 'D&D' : 'D&D (none yet)', body: <DndTab dnd={sheet.dnd} onChange={(dnd) => change({ ...sheet, dnd, fields: dnd && !sheet.dnd ? withPersona(sheet.fields) : sheet.fields })} story={sheet.story} onStory={(story) => change({ ...sheet, story })} onOpenStory={() => setTab('story')} /> },
    { value: 'game', label: 'Game', body: <CharacterGameTab sheet={start} /> },
    { value: 'story', label: 'Story', body: <StoryTab story={sheet.story} onChange={(story) => change({ ...sheet, story })} /> },
    { value: 'cards', label: 'Cards', body: <CharacterCards sheet={start.id} /> }
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border border-line/60 bg-black/70">
      <SheetHeader id={start.id} title={showName(sheet.title)} image={image} fields={sheet.fields.length} wornBy={wornBy} status={saver.status} error={saver.error} previewing={preview !== null} onRename={(title) => change({ ...sheet, title })} onPortrait={() => void pickPicture(image).then((r) => r && setPicture(r.id))} onAddField={() => {
          setTab('sheet')
          setAdding(true)
        }} onPreview={togglePreview} />
      {preview === null && (
        <div className="px-4 pt-3">
          <Segmented value={tab} onChange={setTab} options={tabs.map(({ value, label }) => ({ value, label }))} />
        </div>
      )}
      {preview !== null ? (
        <div className="p-5 text-[13.5px]">
          <Markdown text={preview} />
        </div>
      ) : (
        tabs.find((t) => t.value === tab)?.body
      )}
    </div>
  )
}
