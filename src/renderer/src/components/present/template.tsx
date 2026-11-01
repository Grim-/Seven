import { useEffect, useRef, useState } from 'react'
import { registerPresentation, type PresentationProps } from '../../registries/presentations'
import { engine, main, on } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { errorText } from '../../lib/format'
import { cn } from '../../lib/cn'
import { AlertBox } from '../ui'
import { failed } from '../../lib/notify'

export function TemplateView({ fields, stage, fill = false }: PresentationProps & { fill?: boolean }) {
  const pageId = typeof fields.page === 'string' ? fields.page : null
  const html = typeof fields.html === 'string' ? fields.html : ''
  const values = fields.values && typeof fields.values === 'object' ? fields.values : {}
  const frame = useRef<HTMLIFrameElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [height, setHeight] = useState(160)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    main('present.page', { html })
      .then((token) => live && setSrc(`seven-widget://page/${token}`))
      .catch((err) => live && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      live = false
    }
  }, [html])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      const d = e.data as { type?: string; height?: number; name?: string; payload?: unknown }
      if (d?.type === 'seven:height' && typeof d.height === 'number') setHeight(Math.min(stage ? 2000 : fill ? 4000 : 900, Math.max(40, Math.ceil(d.height))))
      if (d?.type === 'seven:action' && pageId && typeof d.name === 'string') {
        engine('modules.pageAction', { pageId, name: d.name, payload: d.payload ?? null })
          .then((r) => r.message && toast.success(r.message))
          .catch(failed('That did not work'))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [stage, pageId, fill])

  const send = () => frame.current?.contentWindow?.postMessage({ type: 'seven:fields', fields: values }, '*')
  useEffect(send, [values])

  if (error) return <AlertBox>{error}</AlertBox>
  if (!src) return null
  return (
    <iframe
      ref={frame}
      src={src}
      title={typeof fields.name === 'string' ? fields.name : 'Presentation'}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      onLoad={send}
      style={{ height: stage ? '70vh' : height }}
      className={cn('w-full border-0 bg-transparent')}
    />
  )
}

registerPresentation('template', TemplateView)

export function ModulePageView({ pageId, version, part = null }: { pageId: string; version: number; part?: string | null }) {
  const [view, setView] = useState<{ html: string; values: unknown; module: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    let moduleId: string | null = null
    const load = () =>
      void engine('modules.pageView', { pageId, part })
        .then((v) => {
          if (!live) return
          moduleId = v?.module ?? null
          setView(v)
          setError(null)
        })
        .catch((err) => live && setError(errorText(err)))
    load()
    const off = on('module.view', ({ id }) => id === moduleId && load())
    return () => {
      live = false
      off()
    }
  }, [pageId, version, part])
  if (error) return <AlertBox>{error}</AlertBox>
  if (!view) return null
  return <TemplateView fields={{ html: view.html, values: view.values, module: view.module, page: pageId }} where="panel" draft={false} stage={false} fill />
}
