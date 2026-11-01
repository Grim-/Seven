import { parseHTML } from 'linkedom'
import { Readability } from '@mozilla/readability'
import { ToolError } from '../tools/types'

const MAX_BYTES = 3 * 1024 * 1024
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Seven'

export function privateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.localhost') || h === '::1' || h === '0.0.0.0') return true
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h)
  if (!m) return /^(fc|fd|fe80)/.test(h)
  const [a, b] = [Number(m[1]), Number(m[2])]
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0
}

export async function readBody(res: Response, signal: AbortSignal, limit = MAX_BYTES): Promise<Buffer> {
  if (!res.body) return Buffer.alloc(0)
  const reader = res.body.getReader()
  const parts: Uint8Array[] = []
  let total = 0
  for (;;) {
    if (signal.aborted) throw new ToolError('Cancelled')
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > limit) {
      await reader.cancel()
      break
    }
    parts.push(value)
  }
  return Buffer.concat(parts)
}

export function pageText(html: string, url: string): { title: string; text: string } {
  const { document } = parseHTML(html)
  for (const el of document.querySelectorAll('script, style, noscript, iframe, svg')) el.remove()
  const title = document.querySelector('title')?.textContent?.trim() ?? url
  try {
    const article = new Readability(document as unknown as Document).parse()
    const text = article?.textContent?.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim()
    if (text && text.length > 200) return { title: article?.title?.trim() || title, text }
  } catch {
    return { title, text: (document.body?.textContent ?? '').replace(/\s+/g, ' ').trim() }
  }
  return { title, text: (document.body?.textContent ?? '').replace(/\s+/g, ' ').trim() }
}

const BLOCKS = 'p, div, li, tr, br, h1, h2, h3, h4, h5, h6, article, section, ol, ul, table, dd, dt'

export function linkedText(html: string, url: string): string {
  const { document } = parseHTML(html)
  for (const el of document.querySelectorAll('script, style, noscript, iframe, svg, template')) el.remove()
  for (const a of document.querySelectorAll('a[href]')) {
    const label = (a.textContent ?? '').replace(/\s+/g, ' ').trim()
    let href = ''
    try {
      href = new URL(a.getAttribute('href') ?? '', url).href
    } catch {
      href = ''
    }
    a.replaceWith(document.createTextNode(label && /^https?:/.test(href) ? ` [${label}](${href}) ` : label))
  }
  for (const el of document.querySelectorAll(BLOCKS)) el.appendChild(document.createTextNode('\n'))
  return (document.body?.textContent ?? '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n[\s]*/g, '\n')
    .trim()
}

export async function fetchPage(address: string, signal: AbortSignal): Promise<{ title: string; url: string; text: string }> {
  let current: URL
  try {
    current = new URL(address.trim())
  } catch {
    throw new ToolError(`"${address}" is not a web address. Ask the user for a full address starting with https://.`)
  }
  let res: Response | null = null
  for (let hop = 0; hop < 6; hop++) {
    if (current.protocol !== 'https:' && current.protocol !== 'http:') throw new ToolError(`${current.href} is not a web page address. Only http and https addresses can be read; ask the user for one.`)
    if (privateHost(current.hostname)) throw new ToolError(`${current.href} is on this computer or the local network, which Seven doesn't read. Ask the user to paste the page text instead.`)
    res = await fetch(current, { signal, redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'text/html,text/plain,application/json;q=0.9,*/*;q=0.5' } })
    const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
    if (!location) break
    current = new URL(location, current)
  }
  if (!res) throw new ToolError('No response')
  if (!res.ok) throw new ToolError(`${current.href} answered ${res.status}, so it could not be read. Ask the user to check the address, or to paste the page text instead.`)
  const type = (res.headers.get('content-type') ?? '').toLowerCase()
  const body = (await readBody(res, signal)).toString('utf8')
  if (type.includes('html')) return { ...pageText(body, current.href), url: current.href }
  if (type.includes('text/') || type.includes('json') || type.includes('xml')) return { title: current.href, url: current.href, text: body }
  throw new ToolError(`${current.href} is not a web page (${type || 'unknown type'}). Ask the user to give it as a file, or paste its text, instead.`)
}
