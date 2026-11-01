import { useEffect, useRef } from 'react'
import { Code } from 'lucide-react'
import { Field, Textarea } from '../ui'
import { PagePick } from '../data/PagePick'
import { usePage } from '../../store/data'
import { registerWidgetUi, type WidgetBodyProps, type WidgetEditorProps } from '../../registries/widgets'

function HtmlWidgetBody({ dashboard, widget }: WidgetBodyProps) {
  const frame = useRef<HTMLIFrameElement>(null)
  const collectionId = typeof widget.source.collectionId === 'string' ? widget.source.collectionId : null
  const collection = usePage(collectionId)
  const src = `seven-widget://${dashboard.id}/${widget.id}?v=${dashboard.version}`

  const post = () => {
    if (!collection || !frame.current?.contentWindow) return
    frame.current.contentWindow.postMessage(
      { type: 'seven:data', collection: { id: collection.id, name: collection.title }, fields: collection.fields, records: collection.records },
      '*'
    )
  }

  useEffect(post, [collection])

  return (
    <iframe
      ref={frame}
      src={src}
      title={widget.title}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      onLoad={post}
      className="h-full w-full border-0 bg-transparent"
    />
  )
}

function HtmlWidgetEditor({ source, onChange }: WidgetEditorProps) {
  return (
    <>
      <PagePick label="Data for the page (optional)" value={typeof source.collectionId === 'string' ? source.collectionId : ''} optional onChange={(id) => onChange({ ...source, collectionId: id || null })} />
      <Field label="HTML" hint="Runs in a sandbox with no network. With a page picked, read it from window.sevenWidget.onData(fn).">
        <Textarea mono value={typeof source.html === 'string' ? source.html : ''} onChange={(e) => onChange({ ...source, html: e.target.value })} className="min-h-40" />
      </Field>
    </>
  )
}

registerWidgetUi('html', {
  Body: HtmlWidgetBody,
  Editor: HtmlWidgetEditor,
  blank: () => ({ kind: 'html', html: '<div style="padding:12px">Hello</div>', collectionId: null }),
  createIcon: <Code />,
  flush: true
})
