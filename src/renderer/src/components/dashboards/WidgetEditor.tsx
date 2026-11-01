import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dashboard, ViewOptions, Widget, WidgetSource } from '@shared/types'
import { VIEW_LABELS, optionsFor } from '@shared/widgets'
import { AlertBox, Button, Field, Input, Modal, Select, useAutosave, DoneEditing } from '../ui'
import { usePage } from '../../store/data'
import { widgetUi, widgetUiOf } from '../../registries/widgets'
import { useWidgetInfo } from '../../store/widgetInfo'
import { OptionInput } from './optionInputs'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { useBusy } from '../../lib/useBusy'

export function WidgetEditor({ dashboard, widget, onClose }: { dashboard: Dashboard; widget: Widget | null; onClose: () => void }) {
  const providers = useWidgetInfo((s) => s.providers)
  const addable = providers.filter((p) => widgetUiOf(p.kind)?.Editor && widgetUiOf(p.kind)?.blank)
  const [source, setSource] = useState<WidgetSource>(() => widget?.source ?? (addable[0] ? widgetUiOf(addable[0].kind)?.blank?.(addable[0]) : undefined) ?? { kind: '' })
  const [title, setTitle] = useState(widget?.title ?? '')
  const [view, setView] = useState(widget?.view ?? 'table')
  const [options, setOptions] = useState<ViewOptions>(widget?.options ?? {})
  const [error, setError] = useState<string | null>(null)
  const [busy, run] = useBusy()

  const ui = widgetUi(source)
  const info = providers.find((p) => p.kind === source.kind)
  const views = info?.views ?? [view]
  const collection = usePage(ui.fieldsPage?.(source) ?? null)
  const fields = collection ? collection.fields : []
  const activeView = views.includes(view) ? view : views[0]
  const defs = useMemo(() => optionsFor(activeView), [activeView])

  const changeSource = (next: WidgetSource) => {
    if ((ui.fieldsPage?.(next) ?? null) !== (ui.fieldsPage?.(source) ?? null)) setOptions({})
    setSource(next)
  }

  const changeKind = (kind: string) => {
    const next = providers.find((p) => p.kind === kind)
    setSource((next && widgetUiOf(kind)?.blank?.(next)) ?? { kind })
    setView(next?.defaultView ?? view)
    setOptions({})
  }

  const cleanOptions = () => Object.fromEntries(Object.entries(options).filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && !v.length)))
  const autosave = useAutosave<{ dashboardId: string; widgetId: string; title: string; view: typeof activeView; options: ViewOptions; source: WidgetSource }>((payload) => engine('widgets.update', payload))
  const first = useRef(true)
  useEffect(() => {
    if (!widget) return
    if (first.current) {
      first.current = false
      return
    }
    autosave.queue({ dashboardId: dashboard.id, widgetId: widget.id, title: title.trim() || widget.title, view: activeView, options: cleanOptions(), source })
  }, [title, activeView, JSON.stringify(options), JSON.stringify(source)])
  const done = () => void autosave.flush().then(onClose)

  const add = () => {
    setError(null)
    void run(async () => {
      await engine('widgets.add', { dashboardId: dashboard.id, title: title.trim() || null, source, view: activeView, options: cleanOptions() })
      onClose()
    }, (err) => setError(errorText(err)))
  }

  const Editor = ui.Editor

  return (
    <Modal
      open
      title={widget ? `Settings · ${widget.title}` : `Add to ${dashboard.name}`}
      onClose={widget ? done : onClose}
      footer={
        widget ? (
          <DoneEditing saver={autosave} onDone={onClose} size="md" />
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy} onClick={add}>
              Add
            </Button>
          </>
        )
      }
    >
      <div className="flex max-h-[64vh] flex-col gap-3 overflow-y-auto pr-1">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Shown on the widget" />
        </Field>
        {!widget && (
          <Field label="Shows">
            <Select value={source.kind} options={addable.map((p) => ({ value: p.kind, label: p.label }))} onChange={changeKind} />
          </Field>
        )}
        {Editor && info && <Editor source={source} info={info} onChange={changeSource} />}
        {views.length > 1 && (
          <Field label="View">
            <Select value={activeView} options={views.map((v) => ({ value: v, label: VIEW_LABELS[v] ?? v }))} onChange={setView} />
          </Field>
        )}
        {defs
          .filter((d) => !d.type.needsFields || fields.length)
          .map((def) => (
            <Field key={def.key} label={def.label} hint={def.hint}>
              <OptionInput def={def} value={options[def.key]} fields={fields} onChange={(v) => setOptions((o) => ({ ...o, [def.key]: v }))} />
            </Field>
          ))}
        {error && <AlertBox>{error}</AlertBox>}
      </div>
    </Modal>
  )
}
