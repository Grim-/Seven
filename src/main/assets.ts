import { isAssetId } from '@shared/ids'
import { net, protocol } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { isSealed, isVaultLocked } from '@shared/sealed'
import { dataDir } from './paths'
import { mainSecure } from './vault'

export const ASSET_SCHEME = 'seven-asset'

export function assetScheme(): Electron.CustomScheme {
  return { scheme: ASSET_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
}

function sealedFile(file: string): boolean {
  const fd = fs.openSync(file, 'r')
  try {
    const head = Buffer.alloc(4)
    return fs.readSync(fd, head, 0, 4, 0) === 4 && isSealed(head)
  } finally {
    fs.closeSync(fd)
  }
}

function serveSealed(file: string, mime: string, rangeHeader: string | null): Response {
  const size = mainSecure.size(file)
  const base = { 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' }
  const m = rangeHeader ? /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim()) : null
  if (!m || (m[1] === '' && m[2] === '')) {
    const body = mainSecure.readBytes(file)
    return new Response(new Uint8Array(body), { status: 200, headers: { ...base, 'Content-Length': String(body.length) } })
  }
  let start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1])
  let end = m[1] === '' ? size - 1 : m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  start = Math.max(0, start)
  end = Math.min(end, start + 4 * 1024 * 1024 - 1)
  const body = mainSecure.readRange(file, start, end)
  return new Response(new Uint8Array(body), { status: 206, headers: { ...base, 'Content-Length': String(body.length), 'Content-Range': `bytes ${start}-${start + body.length - 1}/${size}` } })
}

export function handleAssets(): void {
  const root = path.join(dataDir, 'data', 'assets')
  protocol.handle(ASSET_SCHEME, (request) => {
    const url = new URL(request.url)
    const id = url.hostname
    const name = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    if (!isAssetId(id) || !name || name.includes('/') || name.includes('\\') || name === '..' || name === '.') {
      return new Response('Not found', { status: 404 })
    }
    try {
      const meta = JSON.parse(mainSecure.readText(path.join(root, id, 'meta.json'))) as { file: string; mime: string; stored?: string }
      if (meta.file !== name) return new Response('Not found', { status: 404 })
      const file = path.join(root, id, meta.stored ?? meta.file)
      const rel = path.relative(root, file)
      if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(file)) return new Response('Not found', { status: 404 })
      if (!sealedFile(file)) return net.fetch(pathToFileURL(file).toString(), { headers: request.headers })
      return serveSealed(file, meta.mime || 'application/octet-stream', request.headers.get('range'))
    } catch (err) {
      if (isVaultLocked(err)) return new Response('Locked', { status: 423 })
      return new Response('Not found', { status: 404 })
    }
  })
}
