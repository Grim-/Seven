import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { ArrowLeft, ArrowRight, ExternalLink, Globe, RotateCw, X } from 'lucide-react'
import type { WebviewTag } from 'electron'
import { on } from '../../lib/ipc'
import { useApp } from '../../store/app'
import { useTools } from '../../store/tools'
import { registerSideTab } from '../../registries/side'
import { cn } from '../../lib/cn'
import { noteFailure } from '../../store/problems'

const HOME = 'https://duckduckgo.com/'
const PARTITION = 'persist:seven-browser'

function target(input: string | null): string {
  const text = (input ?? '').trim()
  if (!text) return HOME
  if (/^https?:\/\//i.test(text)) return text
  if (!/\s/.test(text) && /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(text)) return `https://${text}`
  return `https://duckduckgo.com/?q=${encodeURIComponent(text)}`
}

interface BrowserState {
  request: { url: string; n: number } | null
  last: string | null
  setLast: (url: string) => void
}

const useBrowser = create<BrowserState>((set) => ({
  request: null,
  last: null,
  setLast: (last) => set({ last })
}))

const webOn = () => useTools.getState().list.some((m) => m.id === 'web' && m.state === 'on')

export function showBrowser(url: string | null, switchView = false): void {
  if (!webOn()) return
  const app = useApp.getState()
  const prefs = app.settings?.sidePanel
  if (prefs) void app.updateSettings({ sidePanel: { ...prefs, open: true, tab: 'browser' } })
  if (switchView) app.setView('chat')
  if (url || !useBrowser.getState().last) useBrowser.setState((s) => ({ request: { url: target(url), n: (s.request?.n ?? 0) + 1 } }))
}

export function listenBrowser(): () => void {
  return on('browser.open', ({ url }) => showBrowser(url))
}

function BrowserTab() {
  const view = useRef<WebviewTag | null>(null)
  const ready = useRef(false)
  const request = useBrowser((s) => s.request)
  const [first] = useState(() => request?.url ?? useBrowser.getState().last ?? HOME)
  const [address, setAddress] = useState(first)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [nav, setNav] = useState({ back: false, forward: false })
  const [note, setNote] = useState('')
  const seen = useRef(request?.n ?? 0)

  useEffect(() => {
    const w = view.current
    if (!w) return
    const sync = () => {
      const url = w.getURL()
      if (!url) return
      setAddress(url)
      useBrowser.getState().setLast(url)
      setNav({ back: w.canGoBack(), forward: w.canGoForward() })
    }
    const onReady = () => {
      ready.current = true
      sync()
    }
    const start = () => setLoading(true)
    const stop = () => {
      setLoading(false)
      sync()
    }
    w.addEventListener('dom-ready', onReady)
    w.addEventListener('did-navigate', sync)
    w.addEventListener('did-navigate-in-page', sync)
    w.addEventListener('did-start-loading', start)
    w.addEventListener('did-stop-loading', stop)
    return () => {
      w.removeEventListener('dom-ready', onReady)
      w.removeEventListener('did-navigate', sync)
      w.removeEventListener('did-navigate-in-page', sync)
      w.removeEventListener('did-start-loading', start)
      w.removeEventListener('did-stop-loading', stop)
    }
  }, [])

  useEffect(() => {
    if (!request || request.n === seen.current) return
    seen.current = request.n
    setAddress(request.url)
    if (ready.current) void view.current?.loadURL(request.url).catch(noteFailure('browser', `Could not load ${request.url}`))
    else view.current?.setAttribute('src', request.url)
  }, [request])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const off = on('browser.status', ({ text }) => {
      setNote(text)
      if (timer) clearTimeout(timer)
      if (text) timer = setTimeout(() => setNote(''), 4000)
    })
    return () => {
      off()
      if (timer) clearTimeout(timer)
    }
  }, [])

  const go = (input: string) => {
    const url = target(input)
    setAddress(url)
    if (ready.current) void view.current?.loadURL(url).catch(noteFailure('browser', `Could not load ${url}`))
  }
  const button = 'flex h-6 w-6 shrink-0 items-center justify-center text-dim hover:text-accent disabled:opacity-30 disabled:hover:text-dim'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-line/40 px-1.5 py-1">
        <button title="Back" disabled={!nav.back} onClick={() => view.current?.goBack()} className={button}>
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <button title="Forward" disabled={!nav.forward} onClick={() => view.current?.goForward()} className={button}>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <button title={loading ? 'Stop' : 'Reload'} onClick={() => (loading ? view.current?.stop() : view.current?.reload())} className={button}>
          {loading ? <X className="h-3.5 w-3.5" /> : <RotateCw className="h-3.5 w-3.5" />}
        </button>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onFocus={(e) => {
            setEditing(true)
            e.currentTarget.select()
          }}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              go(address)
              e.currentTarget.blur()
            } else if (e.key === 'Escape') {
              setAddress(view.current?.getURL() || address)
              e.currentTarget.blur()
            }
          }}
          spellCheck={false}
          placeholder="Search or type an address"
          className={cn('h-6 min-w-0 flex-1 border tone-well-60 px-2 font-ui text-[11.5px] text-ink outline-none', editing ? 'border-accent/50' : 'border-line/40')}
        />
        <button title="Open in your own browser" onClick={() => view.current && void window.open(view.current.getURL(), '_blank')} className={button}>
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1 bg-page">
        <webview ref={view as unknown as React.Ref<HTMLWebViewElement>} src={first} partition={PARTITION} className="absolute inset-0 h-full w-full" />
        {loading && <span className="seven-pulse" />}
      </div>
      {note && <div className="shrink-0 border-t border-line/40 px-2.5 py-1 font-ui text-[10.5px] text-secondary-ink">{note}</div>}
    </div>
  )
}

registerSideTab({
  id: 'browser',
  label: 'Browser',
  icon: <Globe className="h-3.5 w-3.5" />,
  order: 40,
  visible: webOn,
  render: () => <BrowserTab />
})
