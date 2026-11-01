import { Menu, app, clipboard, session, shell, webContents, type WebContents } from 'electron'
import type { EngineSupervisor } from './engine-supervisor'
import { broadcast } from './app-window'

export const BROWSER_PARTITION = 'persist:seven-browser'

let engineRef: EngineSupervisor | null = null

function status(text: string): void {
  broadcast({ event: 'browser.status', payload: { text } })
}

function extFor(type: string, url: string): string {
  const fromType = /image\/(png|jpe?g|gif|webp|avif|bmp|svg)/.exec(type)?.[1]
  if (fromType) return fromType === 'jpeg' ? 'jpg' : fromType === 'svg' ? 'svg' : fromType
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.exec(url)?.[1]?.toLowerCase() ?? 'png'
}

async function saveImage(src: string): Promise<void> {
  if (!engineRef) return
  status('Saving image…')
  try {
    const res = await session.fromPartition(BROWSER_PARTITION).fetch(src)
    if (!res.ok) throw new Error(`the site answered ${res.status}`)
    const type = res.headers.get('content-type') ?? ''
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length > 25 * 1024 * 1024) throw new Error('it is over 25 MB')
    const base = decodeURIComponent(new URL(src).pathname.split('/').pop() || 'image').replace(/\.[a-z0-9]+$/i, '').replace(/[^\w .-]+/g, '_').slice(0, 60) || 'image'
    const name = `${base}.${extFor(type, src)}`
    await engineRef.request('data.assets.importBytes', { name, base64: bytes.toString('base64') })
    status(`Saved ${name} to Seven`)
  } catch (err) {
    status(`Could not save the image: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function menuFor(wc: WebContents, params: Electron.ContextMenuParams): void {
  const items: Electron.MenuItemConstructorOptions[] = []
  if (params.mediaType === 'image' && params.srcURL) {
    items.push({ label: 'Save image to Seven', click: () => void saveImage(params.srcURL) })
    items.push({ label: 'Copy image address', click: () => clipboard.writeText(params.srcURL) })
    items.push({ type: 'separator' })
  }
  if (params.linkURL) {
    items.push({ label: 'Open link here', click: () => void wc.loadURL(params.linkURL) })
    items.push({ label: 'Open link in your browser', click: () => void shell.openExternal(params.linkURL) })
    items.push({ label: 'Copy link address', click: () => clipboard.writeText(params.linkURL) })
    items.push({ type: 'separator' })
  }
  if (params.selectionText) items.push({ label: 'Copy', role: 'copy' })
  if (params.isEditable) items.push({ label: 'Paste', role: 'paste' })
  items.push({ label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() })
  items.push({ label: 'Forward', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() })
  items.push({ label: 'Reload', click: () => wc.reload() })
  Menu.buildFromTemplate(items).popup()
}

function webAddress(src: string | undefined): boolean {
  if (!src || src === 'about:blank') return true
  try {
    const url = new URL(src)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function guard(host: WebContents): void {
  host.on('will-attach-webview', (event, prefs, params) => {
    if (!webAddress(params.src) || params.partition !== BROWSER_PARTITION) {
      event.preventDefault()
      return
    }
    delete prefs.preload
    prefs.nodeIntegration = false
    prefs.nodeIntegrationInSubFrames = false
    prefs.contextIsolation = true
    prefs.sandbox = true
    prefs.webSecurity = true
    prefs.partition = BROWSER_PARTITION
  })
}

function guest(wc: WebContents): void {
  wc.setWindowOpenHandler((details) => {
    if (webAddress(details.url)) void wc.loadURL(details.url).catch(() => undefined)
    return { action: 'deny' }
  })
  wc.on('will-navigate', (event, url) => {
    if (!webAddress(url)) event.preventDefault()
  })
  wc.on('context-menu', (_e, params) => menuFor(wc, params))
}

export function setupBrowser(engine: EngineSupervisor): void {
  engineRef = engine
  const attach = (wc: WebContents) => (wc.getType() === 'webview' ? guest(wc) : guard(wc))
  webContents.getAllWebContents().forEach(attach)
  app.on('web-contents-created', (_e, wc) => attach(wc))
}
