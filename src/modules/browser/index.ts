import { linkView } from '../../engine/library/kinds'
import { parseHTML } from 'linkedom'
import type { ModuleFactory } from '../../engine/modules/sdk'
import { ToolError, optStr, str, type ToolContext, type ToolDef } from '../../engine/tools/types'
import type { FormAnswer, WebLogEntry } from '@shared/types'
import { privateHost } from '../../engine/web/page'
import { modules } from '../../engine/modules/registry'
import { data } from '../../engine/data/hub'
import { logWeb } from '../../engine/weblog'
import { linkFor } from '@shared/text'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Seven'
const MAX_PAGE = 3 * 1024 * 1024
const MAX_IMAGE = 25 * 1024 * 1024


function allowedSites(): string[] {
  const raw = modules.list().find((m) => m.id === 'web')?.values.allowedSites
  return String(raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/^www\./, ''))
    .filter(Boolean)
}

function allowed(host: string, list: string[]): boolean {
  const h = host.toLowerCase().replace(/^www\./, '')
  return list.some((s) => (s.startsWith('*.') ? h === s.slice(2) || h.endsWith(s.slice(1)) : h === s))
}

function parse(address: string): URL {
  let url: URL
  try {
    url = new URL(address.trim())
  } catch {
    throw new ToolError(`"${address}" is not a full address. Set url to one starting with https://, e.g. "https://example.com/page".`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new ToolError(`Only http and https addresses work, not ${url.protocol}. Set url to an address starting with https://.`)
  return url
}

async function approve(ctx: ToolContext, url: URL, what: string): Promise<WebLogEntry['outcome']> {
  if (privateHost(url.hostname)) {
    logWeb({ at: Date.now(), agentId: ctx.agentId, sessionId: ctx.sessionId, kind: 'read', target: url.href, outcome: 'blocked', note: 'local or private address' })
    throw new ToolError('Addresses on this computer or the local network are not allowed. Use a public web address instead.')
  }
  const list = allowedSites()
  if (allowed(url.hostname, list)) return 'auto'
  const answer = (await ctx.ui.ask('form', {
    title: `${what}?`,
    message: `The agent wants to ${what.toLowerCase()} from ${url.href}`,
    fields: [{ name: 'always', label: `Always allow ${url.hostname.replace(/^www\./, '')}`, type: 'boolean', required: false, default: false }]
  })) as FormAnswer
  if (answer?.action !== 'accept') {
    logWeb({ at: Date.now(), agentId: ctx.agentId, sessionId: ctx.sessionId, kind: 'read', target: url.href, outcome: 'denied' })
    throw new ToolError('The user said no. Do not try that address again; carry on without it, or ask the user what they want instead.')
  }
  if (answer.values.always === true) {
    const next = [...new Set([...list, url.hostname.replace(/^www\./, '')])].join(', ')
    setTimeout(() => void modules.setSettings('web', { allowedSites: next }).catch(() => undefined), 0)
  }
  return 'allowed'
}

async function get(url: URL, ctx: ToolContext, max: number): Promise<{ res: Response; body: Buffer; url: URL }> {
  let current = url
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(current, { signal: ctx.signal, redirect: 'manual', headers: { 'User-Agent': UA } })
    const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
    if (location) {
      current = new URL(location, current)
      if (privateHost(current.hostname)) throw new ToolError(`That address redirects to ${current.href}, which is on this computer or the local network and not allowed. Try a different address.`)
      continue
    }
    if (!res.ok) throw new ToolError(`${current.href} answered ${res.status}, so nothing was loaded. Check the address, or try a different page.`)
    const reader = res.body?.getReader()
    const parts: Uint8Array[] = []
    let total = 0
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > max) {
        await reader.cancel()
        throw new ToolError(`That is over ${Math.round(max / 1024 / 1024)} MB, too big to load. Pick something smaller, or a different page.`)
      }
      parts.push(value)
    }
    return { res, body: Buffer.concat(parts), url: current }
  }
  throw new ToolError('That address redirected too many times to load. Try a different address.')
}

function largest(srcset: string): string | null {
  const items = srcset
    .split(',')
    .map((s) => s.trim().split(/\s+/))
    .filter((p) => p[0])
    .map(([src, size]) => ({ src, n: Number.parseFloat(size ?? '1') || 1 }))
  return items.sort((a, b) => b.n - a.n)[0]?.src ?? null
}

function extFor(type: string, url: string): string {
  const t = /image\/(png|jpe?g|gif|webp|avif|bmp|svg)/.exec(type)?.[1]
  if (t) return t === 'jpeg' ? 'jpg' : t
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.exec(url)?.[1]?.toLowerCase() ?? 'png'
}

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: ToolDef): void }): void {
      tools.add({
        name: 'browser_open',
        group: 'browser',
        needsWorkspace: false,
        command: true,
        activity: () => 'opening a page',
        description: "Show the user a page in the browser in Seven's side panel. You don't see the page; use web tools or browser_images to read it.",
        params: { type: 'object', properties: { url: { type: ['string', 'null'], description: 'Address, or null for a blank search page' } } },
        execute: async (params) => {
          const address = optStr(params, 'url')
          if (address) parse(address)
          this.openBrowser(address)
          return address ? `Opened ${address} in the browser.` : 'Opened the browser.'
        }
      })

      tools.add({
        name: 'browser_images',
        group: 'browser',
        needsWorkspace: false,
        maxRepeats: 3,
        activity: () => 'looking for pictures',
        description: 'List the pictures on a web page, with their addresses and descriptions, so you can save the right one with browser_save_image.',
        params: { type: 'object', properties: { url: { type: 'string' } } },
        execute: async (params, ctx) => {
          const url = parse(str(params, 'url'))
          const outcome = await approve(ctx, url, 'Look at the pictures')
          let page
          try {
            page = await get(url, ctx, MAX_PAGE)
          } catch (err) {
            logWeb({ at: Date.now(), agentId: ctx.agentId, sessionId: ctx.sessionId, kind: 'read', target: url.href, outcome: 'failed', note: String(err) })
            throw err instanceof ToolError ? err : new ToolError(`Could not load ${url.href}: ${err instanceof Error ? err.message : String(err)}. Check the address, or carry on without it.`)
          }
          logWeb({ at: Date.now(), agentId: ctx.agentId, sessionId: ctx.sessionId, kind: 'read', target: page.url.href, outcome, note: 'pictures' })
          const { document } = parseHTML(page.body.toString('utf8'))
          const found = new Map<string, string>()
          const add = (src: string | null | undefined, alt: string) => {
            if (!src || src.startsWith('data:')) return
            try {
              const abs = new URL(src, page.url).href
              if (!found.has(abs)) found.set(abs, alt.replace(/\s+/g, ' ').trim().slice(0, 120))
            } catch {
              return
            }
          }
          for (const m of document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]')) add(m.getAttribute('content'), 'page preview image')
          for (const img of document.querySelectorAll('img')) {
            const w = Number(img.getAttribute('width') ?? 0)
            const h = Number(img.getAttribute('height') ?? 0)
            if ((w && w < 48) || (h && h < 48)) continue
            const src = (img.getAttribute('srcset') && largest(img.getAttribute('srcset') ?? '')) || img.getAttribute('data-src') || img.getAttribute('src')
            add(src, img.getAttribute('alt') || img.getAttribute('title') || '')
          }
          if (!found.size) return `No pictures found on ${page.url.href}. Some sites load pictures with scripts; the user can right-click pictures in Seven's browser to save them.`
          return [...found.entries()]
            .slice(0, 40)
            .map(([src, alt], i) => `${i + 1}. ${alt || '(no description)'}: ${src}`)
            .join('\n')
        }
      })

      tools.add({
        name: 'browser_save_image',
        group: 'browser',
        needsWorkspace: false,
        maxRepeats: 5,
        activity: () => 'saving a picture',
        description: 'Save a picture from the web into the library by its address, so it can be shown, put on boards or used in pages. name is a short file name.',
        params: { type: 'object', properties: { url: { type: 'string' }, name: { type: ['string', 'null'] } } },
        execute: async (params, ctx) => {
          const url = parse(str(params, 'url'))
          const outcome = await approve(ctx, url, 'Save a picture')
          let got
          try {
            got = await get(url, ctx, MAX_IMAGE)
          } catch (err) {
            logWeb({ at: Date.now(), agentId: ctx.agentId, sessionId: ctx.sessionId, kind: 'read', target: url.href, outcome: 'failed', note: String(err) })
            throw err instanceof ToolError ? err : new ToolError(`Could not load ${url.href}: ${err instanceof Error ? err.message : String(err)}. Check the address, or carry on without it.`)
          }
          const type = (got.res.headers.get('content-type') ?? '').toLowerCase()
          if (type && !type.startsWith('image/')) throw new ToolError(`That address is ${type.split(';')[0]}, not a picture. browser_images lists the pictures on a page.`)
          logWeb({ at: Date.now(), agentId: ctx.agentId, sessionId: ctx.sessionId, kind: 'read', target: got.url.href, outcome, note: 'saved picture' })
          const base = (optStr(params, 'name') || decodeURIComponent(got.url.pathname.split('/').pop() || 'picture')).replace(/\.[a-z0-9]+$/i, '').replace(/[^\w .-]+/g, '_').trim().slice(0, 60) || 'picture'
          const asset = data.assets.registerBytes(`${base}.${extFor(type, got.url.href)}`, got.body, { tool: 'browser', sessionId: ctx.sessionId, original: got.url.href })
          return { text: `Saved ${linkFor('file', asset.name)} to the library.`, view: linkView(`file/${asset.id}`, { agentId: ctx.agentId }) }
        }
      })
    }
  }

export default factory
