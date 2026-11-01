import { isAssetId } from '@shared/ids'
import { protocol } from 'electron'
import path from 'node:path'
import crypto from 'node:crypto'
import { isVaultLocked } from '@shared/sealed'
import { mainSecure } from './vault'
import { dataDir } from './paths'

export const WIDGET_SCHEME = 'seven-widget'

const CDN = 'https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com'

function csp(network: boolean): string {
  const net = network ? ' https: wss:' : ''
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline' 'unsafe-eval' blob: ${CDN}${network ? ' https:' : ''}`,
    `style-src 'unsafe-inline' ${CDN} https://fonts.googleapis.com${network ? ' https:' : ''}`,
    `font-src data: ${CDN} https://fonts.gstatic.com${network ? ' https:' : ''}`,
    `img-src data: blob: seven-asset:${net}`,
    `media-src data: blob: seven-asset:${net}`,
    `connect-src ${CDN}${net}`,
    "worker-src blob:"
  ].join('; ')
}

const BRIDGE = `<script>
(function () {
  var w = { records: [], fields: [], collection: null, listeners: [] }
  w.onData = function (fn) { w.listeners.push(fn); if (w.collection) fn(w) }
  window.sevenWidget = w
  window.addEventListener('message', function (e) {
    var d = e.data
    if (!d || d.type !== 'seven:data') return
    w.records = d.records || []
    w.fields = d.fields || []
    w.collection = d.collection || null
    w.listeners.forEach(function (fn) { try { fn(w) } catch (err) { console.error(err) } })
  })
})()
</script>`

const KIT = `<style>
:root{--bg:#090a0d;--card:#11141c;--line:rgba(245,158,11,.35);--line-strong:rgba(245,158,11,.6);--accent:#ffc919;--accent-soft:#e39d07;--cyan:rgb(102,252,241);--alert:#ef4444;--ok:#34d399;--text:#fff;--dim:#a1a1aa;--faint:#52525b;--mono:ui-monospace,'Cascadia Mono',Consolas,monospace;--sans:'Segoe UI',Inter,system-ui,sans-serif}
body{font-family:var(--sans);color:var(--text)}
.s-panel{border:1px solid var(--line);background:rgba(0,0,0,.4);padding:10px 12px}
.s-panel+.s-panel{margin-top:8px}
.s-title{font:600 15px var(--sans);color:var(--text)}
.s-label{font:600 10.5px var(--mono);text-transform:uppercase;letter-spacing:.14em;color:var(--accent-soft)}
.s-dim{color:var(--dim)}.s-faint{color:var(--faint)}.s-mono{font-family:var(--mono)}
.s-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.s-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--min,120px),1fr));gap:8px}
.s-btn{height:28px;padding:0 10px;border:1px solid var(--line);background:rgba(0,0,0,.5);color:var(--accent);font:600 11px var(--mono);text-transform:uppercase;letter-spacing:.08em;cursor:pointer}
.s-btn:hover{border-color:var(--accent)}
.s-btn.primary{border-color:var(--accent);background:rgba(255,201,25,.15);color:var(--text)}
.s-btn.danger{color:var(--alert);border-color:rgba(239,68,68,.5)}
.s-input,.s-textarea,.s-select{box-sizing:border-box;border:1px solid var(--line);background:rgba(0,0,0,.6);color:var(--text);font:13px var(--sans);padding:6px 8px;outline:none}
.s-input:focus,.s-textarea:focus,.s-select:focus{border-color:var(--cyan)}
.s-textarea{width:100%;min-height:80px;resize:vertical}
.s-tabs{display:flex;gap:6px;flex-wrap:wrap}
.s-tab{height:28px;padding:0 10px;border:1px solid var(--line);background:rgba(0,0,0,.5);color:var(--accent);font:600 11px var(--mono);text-transform:uppercase;letter-spacing:.08em;cursor:pointer}
.s-tab.on{border-color:var(--accent);background:rgba(255,201,25,.15);color:var(--text)}
.s-chip{display:inline-flex;align-items:center;height:20px;padding:0 6px;border:1px solid rgba(255,201,25,.5);background:rgba(255,201,25,.1);color:var(--accent);font:600 11px var(--mono)}
.s-stat{border:1px solid var(--line);background:rgba(0,0,0,.4);padding:6px;text-align:center}
.s-stat b{display:block;font:600 18px var(--mono);color:var(--text)}
.s-stat span{font:600 10px var(--mono);text-transform:uppercase;letter-spacing:.12em;color:var(--accent-soft)}
.s-note{border:1px solid var(--line);border-left:2px solid var(--accent);background:rgba(255,201,25,.04);padding:8px 10px}
</style>`

const TEMPLATE_BRIDGE = `${KIT}<script>
(function () {
  var t = { fields: null, listeners: [] }
  t.onFields = function (fn) { t.listeners.push(fn); if (t.fields) fn(t.fields) }
  t.action = function (name, payload) { parent.postMessage({ type: 'seven:action', name: String(name), payload: payload === undefined ? null : JSON.parse(JSON.stringify(payload)) }, '*') }
  window.sevenTemplate = t
  var re = /\\{\\{\\s*([A-Za-z][\\w]*)\\s*\\}\\}/g
  function val(fields, k) { var v = fields[k]; return v == null ? '' : Array.isArray(v) ? v.join(', ') : String(v) }
  function fill(fields) {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    var nodes = []
    while (walker.nextNode()) nodes.push(walker.currentNode)
    nodes.forEach(function (n) {
      if (n.__tpl === undefined) n.__tpl = n.nodeValue
      if (n.__tpl.indexOf('{{') < 0) return
      n.nodeValue = n.__tpl.replace(re, function (m, k) { return val(fields, k) })
    })
    document.querySelectorAll('*').forEach(function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        var key = '__tpl_' + a.name
        if (el[key] === undefined) el[key] = a.value
        if (el[key].indexOf('{{') < 0) return
        el.setAttribute(a.name, el[key].replace(re, function (m, k) { return val(fields, k) }))
      })
    })
  }
  function size() { parent.postMessage({ type: 'seven:height', height: document.documentElement.scrollHeight }, '*') }
  window.addEventListener('message', function (e) {
    var d = e.data
    if (!d || d.type !== 'seven:fields') return
    t.fields = d.fields || {}
    if (document.body) fill(t.fields)
    t.listeners.forEach(function (fn) { try { fn(t.fields) } catch (err) { console.error(err) } })
    setTimeout(size, 30)
  })
  window.addEventListener('load', function () { size(); if (window.ResizeObserver) new ResizeObserver(size).observe(document.documentElement) })
})()
</script>`

const pages = new Map<string, string>()

export function hostPage(html: string): string {
  const token = crypto.createHash('sha256').update(html).digest('hex').slice(0, 32)
  pages.delete(token)
  pages.set(token, html)
  while (pages.size > 200) pages.delete(pages.keys().next().value as string)
  return token
}

const BASE = `<style>html,body{margin:0;padding:0;background:transparent;color:#fff;font:13px/1.45 system-ui,sans-serif}</style>`

export function widgetScheme(): Electron.CustomScheme {
  return { scheme: WIDGET_SCHEME, privileges: { standard: true, secure: true } }
}

function page(html: string, network: boolean, bridge = BRIDGE): Response {
  const policy = csp(network)
  const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}">${BASE}${bridge}`
  const body = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}${head}`) : `<!doctype html><html><head>${head}</head><body>${html}</body></html>`
  return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': policy, 'cache-control': 'no-store' } })
}

const NOT_FOUND = () => new Response('Not found', { status: 404 })

export function handleWidgets(): void {
  const dashboards = path.join(dataDir, 'data', 'dashboards')
  const assets = path.join(dataDir, 'data', 'assets')
  protocol.handle(WIDGET_SCHEME, (request) => {
    const url = new URL(request.url)
    const host = url.hostname
    const id = url.pathname.replace(/^\/+/, '')
    try {
      if (host === 'asset') {
        if (!isAssetId(id)) return NOT_FOUND()
        const meta = JSON.parse(mainSecure.readText(path.join(assets, id, 'meta.json'))) as { file: string; mime: string; network?: boolean; stored?: string }
        const stored = meta.stored ?? meta.file
        if (meta.mime !== 'text/html' || path.basename(stored) !== stored) return NOT_FOUND()
        return page(mainSecure.readText(path.join(assets, id, stored)), meta.network === true)
      }
      if (host === 'page') {
        const html = /^[a-f0-9]{32}$/.test(id) ? pages.get(id) : undefined
        return html === undefined ? NOT_FOUND() : page(html, false, TEMPLATE_BRIDGE)
      }
      if (!/^[\p{L}\p{N}_]+$/u.test(host) || !/^w\d+$/.test(id)) return NOT_FOUND()
      const dashboard = JSON.parse(mainSecure.readText(path.join(dashboards, `${host}.json`))) as {
        widgets: { id: string; source: { html?: string }; options?: { network?: boolean } }[]
      }
      const widget = dashboard.widgets.find((w) => w.id === id)
      if (typeof widget?.source.html !== 'string') return NOT_FOUND()
      return page(widget.source.html, widget.options?.network === true)
    } catch (err) {
      if (isVaultLocked(err)) return new Response('Locked', { status: 423 })
      return NOT_FOUND()
    }
  })
}
